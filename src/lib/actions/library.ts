"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { startYoutubeIngest } from "@/domain/ingest/ingest-youtube-video";
import { getOnboardingCompleted } from "@/domain/onboarding";
import {
  consumeMonthlyPasteSlot,
  refundMonthlyPasteSlot,
  UsageError,
} from "@/domain/usage";
import { errorFields, logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { addVideoInputSchema } from "@/lib/validations/library";

export type AddVideoActionState = {
  error?: string;
  errorCode?: string;
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
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "That doesn’t look like a YouTube video URL",
      errorCode: "invalid_url",
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

  let result;
  try {
    result = await startYoutubeIngest({
      userId: user.id,
      youtubeId: parsed.data.youtubeId,
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

  revalidatePath("/library");
  redirect(`/library/${result.userVideoId}`);
}
