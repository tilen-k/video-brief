"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserProfile } from "@/domain/analysis/get-user-profile";
import {
  DEFAULT_FAMILIARITY_SCORE,
  defaultLengthScore,
} from "@/domain/analysis/prefs";
import {
  listLibraryForUser,
  markAnalysisStartFailed,
  startYoutubeIngest,
  type LibraryListItem,
} from "@/domain/ingest/ingest-youtube-video";
import { getOnboardingCompleted } from "@/domain/onboarding";
import {
  consumeMonthlyPasteSlot,
  refundMonthlyPasteSlot,
  UsageError,
} from "@/domain/usage";
import { enqueueAnalyzeJob, assertQueueReady } from "@/lib/queue/analysis-queue";
import { errorFields, logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { addVideoInputSchema } from "@/lib/validations/library";

export type AddVideoActionState = {
  error?: string;
  errorCode?: string;
  addedUserVideoId?: string;
};

export async function addVideo(
  _prev: AddVideoActionState,
  formData: FormData,
): Promise<AddVideoActionState> {
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

  const parsed = addVideoInputSchema.safeParse({
    url: formData.get("url"),
    familiarity: formData.get("familiarity"),
    summaryLength: formData.get("summaryLength"),
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
    await assertQueueReady();
  } catch (error) {
    logger.error({ ...errorFields(error) }, "addVideo.queue_unready");
    return {
      error: "Couldn't start analysis. Try again in a moment.",
      errorCode: "queue_unready",
    };
  }

  let slot;
  try {
    slot = await consumeMonthlyPasteSlot(user.id);
  } catch (error) {
    if (error instanceof UsageError) {
      return {
        error: error.message,
        errorCode: error.code,
      };
    }
    logger.error({ ...errorFields(error) }, "addVideo.usage_err");
    return {
      error: "Couldn't check your usage limit. Try again in a moment.",
      errorCode: "usage_unavailable",
    };
  }

  const profile = await getUserProfile(user.id);
  const familiarity = parsed.data.familiarity ?? DEFAULT_FAMILIARITY_SCORE;
  const summaryLength =
    parsed.data.summaryLength ?? defaultLengthScore(profile?.summaryStyle);

  let result;
  try {
    result = await startYoutubeIngest({
      userId: user.id,
      youtubeId: parsed.data.youtubeId,
      familiarity,
      summaryLength,
      usageQuotaKey: slot.redisKey,
    });
  } catch (error) {
    try {
      await refundMonthlyPasteSlot(user.id, { redisKey: slot.redisKey });
    } catch (refundError) {
      logger.error(
        { ...errorFields(refundError) },
        "addVideo.refund_after_ingest_err",
      );
    }
    revalidatePath("/library");
    logger.error({ ...errorFields(error) }, "startYoutubeIngest failed");
    return {
      error: "Could not add this video. Try again.",
      errorCode: "provider_error",
    };
  }

  try {
    await enqueueAnalyzeJob({
      userId: user.id,
      userVideoId: result.userVideoId,
      runId: result.runId,
    });
  } catch (error) {
    // No refund on enqueue failure — slot already reserved (user choice).
    logger.error({ ...errorFields(error) }, "addVideo.enqueue_failed");
    await markAnalysisStartFailed(user.id, result.userVideoId);
    revalidatePath("/library");
    return {
      error: "Couldn't start analysis. Try pasting the link again.",
      errorCode: "enqueue_failed",
    };
  }

  revalidatePath("/library");
  return { addedUserVideoId: result.userVideoId };
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
