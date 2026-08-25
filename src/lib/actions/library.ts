"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  DEFAULT_LENGTH_SCORE,
  DEFAULT_TONE_SCORE,
} from "@/domain/analysis/prefs";
import {
  listLibraryForUser,
  markAnalysisStartFailed,
  startYoutubeIngest,
  type LibraryListItem,
} from "@/domain/ingest/ingest-youtube-video";
import { previewYoutubeVideo } from "@/domain/ingest/preview-youtube";
import { getOnboardingCompleted } from "@/domain/onboarding";
import { assertDurationAllowed } from "@/domain/usage/duration";
import { getPlanForUser } from "@/domain/usage/plan";
import {
  consumeMonthlyGenerateSlot,
  refundMonthlyGenerateSlot,
  UsageError,
} from "@/domain/usage";
import { enqueueAnalyzeJob, assertQueueReady } from "@/lib/queue/analysis-queue";
import { errorFields, logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import {
  generateVideoInputSchema,
  previewYoutubeInputSchema,
} from "@/lib/validations/library";
import { TranscriptProviderError } from "@/lib/youtube/transcript-provider";

export type PreviewYoutubeActionState = {
  error?: string;
  errorCode?: string;
  preview?: {
    youtubeId: string;
    title: string;
    channelTitle: string | null;
    thumbnailUrl: string | null;
    durationSeconds: number | null;
    youtubeCategoryId: string | null;
    showFamiliarity: boolean;
    tooLong?: boolean;
  };
};

export async function previewYoutube(
  _prev: PreviewYoutubeActionState,
  formData: FormData,
): Promise<PreviewYoutubeActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/library");
  }

  if (!(await getOnboardingCompleted(user.id))) {
    redirect("/onboarding");
  }

  const parsed = previewYoutubeInputSchema.safeParse({
    url: formData.get("url"),
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "That doesn’t look like a YouTube video URL",
      errorCode: "invalid_url",
    };
  }

  try {
    const preview = await previewYoutubeVideo(parsed.data.youtubeId);
    let tooLong = false;
    try {
      const plan = await getPlanForUser(user.id);
      assertDurationAllowed(plan, preview.durationSeconds);
    } catch (error) {
      if (error instanceof UsageError && error.code === "too_long") {
        tooLong = true;
      } else {
        throw error;
      }
    }

    return {
      preview: {
        youtubeId: preview.youtubeId,
        title: preview.title,
        channelTitle: preview.channelTitle,
        thumbnailUrl: preview.thumbnailUrl,
        durationSeconds: preview.durationSeconds,
        youtubeCategoryId: preview.youtubeCategoryId,
        showFamiliarity: preview.showFamiliarity,
        tooLong,
      },
    };
  } catch (error) {
    if (error instanceof TranscriptProviderError) {
      return {
        error: error.message,
        errorCode: error.code,
      };
    }
    logger.error({ ...errorFields(error) }, "previewYoutube.failed");
    return {
      error: "Could not load this video. Try again.",
      errorCode: "provider_error",
    };
  }
}

export type GenerateVideoActionState = {
  error?: string;
  errorCode?: string;
};

export async function generateVideo(
  _prev: GenerateVideoActionState,
  formData: FormData,
): Promise<GenerateVideoActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/library");
  }

  if (!(await getOnboardingCompleted(user.id))) {
    redirect("/onboarding");
  }

  const parsed = generateVideoInputSchema.safeParse({
    youtubeId: formData.get("youtubeId"),
    summaryLength: formData.get("summaryLength"),
    summaryTone: formData.get("summaryTone"),
    familiarity: formData.get("familiarity"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      errorCode: "invalid_input",
    };
  }

  try {
    await assertQueueReady();
  } catch (error) {
    logger.error({ ...errorFields(error) }, "generateVideo.queue_unready");
    return {
      error: "Couldn't start analysis. Try again in a moment.",
      errorCode: "queue_unready",
    };
  }

  let metadata;
  try {
    metadata = await previewYoutubeVideo(parsed.data.youtubeId);
  } catch (error) {
    if (error instanceof TranscriptProviderError) {
      return {
        error: error.message,
        errorCode: error.code,
      };
    }
    logger.error({ ...errorFields(error) }, "generateVideo.metadata_err");
    return {
      error: "Could not load this video. Try again.",
      errorCode: "provider_error",
    };
  }

  try {
    const plan = await getPlanForUser(user.id);
    assertDurationAllowed(plan, metadata.durationSeconds);
  } catch (error) {
    if (error instanceof UsageError) {
      return {
        error: error.message,
        errorCode: error.code,
      };
    }
    logger.error({ ...errorFields(error) }, "generateVideo.duration_err");
    return {
      error: "Couldn't check plan limits for this video.",
      errorCode: "usage_unavailable",
    };
  }

  let slot;
  try {
    slot = await consumeMonthlyGenerateSlot(user.id);
  } catch (error) {
    if (error instanceof UsageError) {
      return {
        error: error.message,
        errorCode: error.code,
      };
    }
    logger.error({ ...errorFields(error) }, "generateVideo.usage_err");
    return {
      error: "Couldn't check your usage limit. Try again in a moment.",
      errorCode: "usage_unavailable",
    };
  }

  const summaryLength = parsed.data.summaryLength ?? DEFAULT_LENGTH_SCORE;
  const summaryTone = parsed.data.summaryTone ?? DEFAULT_TONE_SCORE;
  const familiarity = metadata.showFamiliarity
    ? (parsed.data.familiarity ?? null)
    : null;

  let result;
  try {
    result = await startYoutubeIngest({
      userId: user.id,
      youtubeId: parsed.data.youtubeId,
      familiarity,
      summaryLength,
      summaryTone,
      usageQuotaKey: slot.redisKey,
      metadata: {
        title: metadata.title,
        channelTitle: metadata.channelTitle,
        thumbnailUrl: metadata.thumbnailUrl,
        durationSeconds: metadata.durationSeconds,
        youtubeCategoryId: metadata.youtubeCategoryId,
      },
    });
  } catch (error) {
    try {
      await refundMonthlyGenerateSlot(user.id, { redisKey: slot.redisKey });
    } catch (refundError) {
      logger.error(
        { ...errorFields(refundError) },
        "generateVideo.refund_after_ingest_err",
      );
    }
    revalidatePath("/library");
    logger.error({ ...errorFields(error) }, "startYoutubeIngest failed");
    return {
      error: "Could not generate this video. Try again.",
      errorCode: "provider_error",
    };
  }

  if (result.priorUsageQuotaKey) {
    try {
      await refundMonthlyGenerateSlot(user.id, {
        redisKey: result.priorUsageQuotaKey,
      });
    } catch (refundError) {
      logger.error(
        { ...errorFields(refundError) },
        "generateVideo.refund_prior_slot_err",
      );
    }
  }

  try {
    await enqueueAnalyzeJob({
      userId: user.id,
      userVideoId: result.userVideoId,
      runId: result.runId,
    });
  } catch (error) {
    logger.error({ ...errorFields(error) }, "generateVideo.enqueue_failed");
    try {
      await refundMonthlyGenerateSlot(user.id, { redisKey: slot.redisKey });
    } catch (refundError) {
      logger.error(
        { ...errorFields(refundError) },
        "generateVideo.refund_after_enqueue_err",
      );
    }
    await markAnalysisStartFailed(user.id, result.userVideoId);
    revalidatePath("/library");
    return {
      error: "Couldn't start analysis. Try generating again.",
      errorCode: "enqueue_failed",
    };
  }

  revalidatePath("/library");
  redirect(`/library/${result.userVideoId}`);
}

export type GetLibraryStatusResult =
  | { ok: true; data: LibraryListItem[] }
  | { ok: false; error: "unauthenticated" | "onboarding" };

export async function getLibraryStatus(): Promise<GetLibraryStatusResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "unauthenticated" };
  }

  if (!(await getOnboardingCompleted(user.id))) {
    return { ok: false, error: "onboarding" };
  }

  const items = await listLibraryForUser(user.id);
  return { ok: true, data: items };
}
