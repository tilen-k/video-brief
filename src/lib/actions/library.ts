"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ingestYoutubeVideo } from "@/domain/ingest/ingest-youtube-video";
import { getOnboardingCompleted } from "@/domain/onboarding";
import { createClient } from "@/lib/supabase/server";
import { TranscriptProviderError } from "@/lib/youtube/transcript-provider";
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

  try {
    await ingestYoutubeVideo({
      userId: user.id,
      youtubeId: parsed.data.youtubeId,
    });
  } catch (error) {
    // Domain may have written failed/library rows — refresh the list.
    revalidatePath("/library");

    if (error instanceof TranscriptProviderError) {
      return {
        error: error.message,
        errorCode: error.code,
      };
    }
    console.error("ingestYoutubeVideo failed", error);
    return {
      error: "Could not add this video. Try again.",
      errorCode: "provider_error",
    };
  }

  revalidatePath("/library");
  return {};
}
