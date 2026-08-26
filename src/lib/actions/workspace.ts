"use server";

import { getWorkspaceVideo, type WorkspaceVideo } from "@/domain/workspace/get-workspace-video";
import type { WorkspaceStatusClientError } from "@/domain/workspace/status-navigation";
import { needsOnboarding } from "@/domain/auth/needs-onboarding";
import { createClient } from "@/lib/supabase/server";
import { userVideoIdSchema } from "@/lib/validations/workspace";

export type GetWorkspaceStatusResult =
  | { ok: true; data: WorkspaceVideo }
  | { ok: false; error: WorkspaceStatusClientError };

export async function getWorkspaceStatus(
  userVideoId: string,
): Promise<GetWorkspaceStatusResult> {
  const parsed = userVideoIdSchema.safeParse(userVideoId);
  if (!parsed.success) {
    return { ok: false, error: "not_found" };
  }

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

  const video = await getWorkspaceVideo(user.id, parsed.data);
  if (!video) {
    return { ok: false, error: "not_found" };
  }

  return { ok: true, data: video };
}
