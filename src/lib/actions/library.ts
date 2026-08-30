"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  DEFAULT_LENGTH_SCORE,
  DEFAULT_TONE_SCORE,
} from "@/domain/analysis/prefs";
import { getUserProfile } from "@/domain/analysis/get-user-profile";
import { DEFAULT_SUMMARY_LANGUAGE } from "@/domain/i18n/summary-languages";
import { resolveSummaryLanguage } from "@/domain/i18n/summary-language";
import { needsOnboarding } from "@/domain/auth/needs-onboarding";
import {
  listLibraryForUser,
  markAnalysisStartFailed,
  softDeleteUserVideo,
  startYoutubeIngest,
  type LibraryListItem,
} from "@/domain/ingest/ingest-youtube-video";
import { previewYoutubeVideo } from "@/domain/ingest/preview-youtube";
import { assertDurationAllowed } from "@/domain/usage/duration";
import {
  getClientIpFromHeaders,
  hashClientIp,
  refundGenerateSlot,
  reserveGenerateSlot,
  UsageError,
} from "@/domain/usage";
import { enqueueAnalyzeJob, assertQueueReady } from "@/lib/queue/analysis-queue";
import { errorFields, logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import {
  generateVideoInputSchema,
  previewYoutubeInputSchema,
  softDeleteLibraryVideoInputSchema,
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
    redirect("/auth/guest?next=/");
  }

  if (await needsOnboarding(user)) {
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

    return {
      preview: {
        youtubeId: preview.youtubeId,
        title: preview.title,
        channelTitle: preview.channelTitle,
        thumbnailUrl: preview.thumbnailUrl,
        durationSeconds: preview.durationSeconds,
        youtubeCategoryId: preview.youtubeCategoryId,
        showFamiliarity: preview.showFamiliarity,
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
  redirectTo?: string;
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
    redirect("/auth/guest?next=/");
  }

  if (await needsOnboarding(user)) {
    redirect("/onboarding");
  }

  const parsed = generateVideoInputSchema.safeParse({
    youtubeId: formData.get("youtubeId"),
    summaryLength: formData.get("summaryLength"),
    summaryTone: formData.get("summaryTone"),
    summaryLanguage: formData.get("summaryLanguage"),
    familiarity: formData.get("familiarity"),
    modelTier: formData.get("modelTier"),
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

  const requestedTier = parsed.data.modelTier ?? "advanced";

  try {
    assertDurationAllowed(requestedTier, metadata.durationSeconds);
  } catch (error) {
    if (error instanceof UsageError) {
      revalidatePath("/");
      return {
        error: error.message,
        errorCode: error.code,
      };
    }
    logger.error({ ...errorFields(error) }, "generateVideo.duration_err");
    return {
      error: "Couldn't check model limits for this video.",
      errorCode: "usage_unavailable",
    };
  }

  let slot;
  try {
    const requestHeaders = await headers();
    const clientIp = getClientIpFromHeaders(requestHeaders);
    let ipHash: string | null = null;
    if (clientIp) {
      try {
        ipHash = hashClientIp(clientIp);
      } catch (error) {
        logger.warn({ ...errorFields(error) }, "generateVideo.ip_hash_err");
        if (process.env.NODE_ENV !== "development") {
          return {
            error: "Couldn't check your usage limit. Try again in a moment.",
            errorCode: "usage_unavailable",
          };
        }
      }
    } else if (process.env.VERCEL === "1") {
      return {
        error: "Couldn't check your usage limit. Try again in a moment.",
        errorCode: "usage_unavailable",
      };
    }

    slot = await reserveGenerateSlot(user.id, {
      requestedTier,
      ipHash,
      durationSeconds: metadata.durationSeconds,
    });
  } catch (error) {
    if (error instanceof UsageError) {
      revalidatePath("/");
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

  try {
    assertDurationAllowed(slot.tier, metadata.durationSeconds);
  } catch (error) {
    try {
      await refundGenerateSlot(user.id, { usageQuotaKey: slot.usageQuotaKey });
    } catch (refundError) {
      logger.error(
        { ...errorFields(refundError) },
        "generateVideo.refund_after_duration_err",
      );
    }
    if (error instanceof UsageError) {
      revalidatePath("/");
      return {
        error: error.message,
        errorCode: error.code,
      };
    }
    logger.error({ ...errorFields(error) }, "generateVideo.effective_duration_err");
    return {
      error: "Couldn't check model limits for this video.",
      errorCode: "usage_unavailable",
    };
  }

  const summaryLength = parsed.data.summaryLength ?? DEFAULT_LENGTH_SCORE;
  const summaryTone = parsed.data.summaryTone ?? DEFAULT_TONE_SCORE;
  const familiarity = metadata.showFamiliarity
    ? (parsed.data.familiarity ?? null)
    : null;
  const modelTier = slot.tier;

  const acceptLanguage = (await headers()).get("accept-language");
  const profile = await getUserProfile(user.id, { acceptLanguage });
  const summaryLanguage = resolveSummaryLanguage(
    parsed.data.summaryLanguage ?? profile?.defaultSummaryLanguage,
    DEFAULT_SUMMARY_LANGUAGE,
  );

  let result;
  try {
    result = await startYoutubeIngest({
      userId: user.id,
      youtubeId: parsed.data.youtubeId,
      familiarity,
      summaryLength,
      summaryTone,
      summaryLanguage,
      modelTier,
      usageQuotaKey: slot.usageQuotaKey,
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
      await refundGenerateSlot(user.id, { usageQuotaKey: slot.usageQuotaKey });
    } catch (refundError) {
      logger.error(
        { ...errorFields(refundError) },
        "generateVideo.refund_after_ingest_err",
      );
    }
    revalidatePath("/");
    logger.error({ ...errorFields(error) }, "startYoutubeIngest failed");
    return {
      error: "Could not generate this video. Try again.",
      errorCode: "provider_error",
    };
  }

  if (result.priorUsageQuotaKey) {
    try {
      await refundGenerateSlot(user.id, {
        usageQuotaKey: result.priorUsageQuotaKey,
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
      await refundGenerateSlot(user.id, { usageQuotaKey: slot.usageQuotaKey });
    } catch (refundError) {
      logger.error(
        { ...errorFields(refundError) },
        "generateVideo.refund_after_enqueue_err",
      );
    }
    await markAnalysisStartFailed(user.id, result.userVideoId);
    revalidatePath("/");
    return {
      error: "Couldn't start analysis. Try generating again.",
      errorCode: "enqueue_failed",
    };
  }

  // Revalidate the workspace only — revalidating "/" while client-navigating
  // refreshes the library list under the still-visible config panel (layout jump).
  revalidatePath(`/v/${result.userVideoId}`);
  const redirectTo = slot.fellBackFrom
    ? `/v/${result.userVideoId}?notice=model_fallback`
    : `/v/${result.userVideoId}`;
  return { redirectTo };
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

  if (await needsOnboarding(user)) {
    return { ok: false, error: "onboarding" };
  }

  const items = await listLibraryForUser(user.id);
  return { ok: true, data: items };
}

export type SoftDeleteLibraryVideoResult =
  | { ok: true }
  | { ok: false; error: string; errorCode?: string };

export async function softDeleteLibraryVideo(
  input: { userVideoId: string },
): Promise<SoftDeleteLibraryVideoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/guest?next=/");
  }

  if (await needsOnboarding(user)) {
    redirect("/onboarding");
  }

  const parsed = softDeleteLibraryVideoInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid video",
      errorCode: "invalid_input",
    };
  }

  const result = await softDeleteUserVideo(user.id, parsed.data.userVideoId);
  if (!result.ok) {
    return {
      ok: false,
      error: "Video not found.",
      errorCode: "not_found",
    };
  }

  revalidatePath("/");
  revalidatePath(`/v/${parsed.data.userVideoId}`);
  return { ok: true };
}
