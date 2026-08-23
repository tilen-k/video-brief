"use server";

import { revalidatePath } from "next/cache";

import { continueAnalysis as continueAnalysisDomain } from "@/domain/analysis/continue-analysis";
import { submitVideoPrefs as submitVideoPrefsDomain } from "@/domain/analysis/submit-video-prefs";
import { getOnboardingCompleted } from "@/domain/onboarding";
import {
  getWorkspaceVideo,
  type WorkspaceVideo,
} from "@/domain/workspace/get-workspace-video";
import type { WorkspaceStatusClientError } from "@/domain/workspace/status-navigation";
import { errorFields, logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import {
  submitVideoPrefsInputSchema,
  userVideoIdSchema,
} from "@/lib/validations/workspace";

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

  if (!(await getOnboardingCompleted(user.id))) {
    return { ok: false, error: "onboarding" };
  }

  const video = await getWorkspaceVideo(user.id, parsed.data);
  if (!video) {
    return { ok: false, error: "not_found" };
  }

  return { ok: true, data: video };
}

export type ContinueAnalysisResult = GetWorkspaceStatusResult;

export async function continueAnalysis(
  userVideoId: string,
): Promise<ContinueAnalysisResult> {
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

  if (!(await getOnboardingCompleted(user.id))) {
    return { ok: false, error: "onboarding" };
  }

  try {
    const video = await continueAnalysisDomain(user.id, parsed.data);
    if (!video) {
      return { ok: false, error: "not_found" };
    }

    revalidatePath("/library");
    revalidatePath(`/library/${parsed.data}`);
    return { ok: true, data: video };
  } catch (error) {
    logger.error(
      { userVideoId: parsed.data, ...errorFields(error) },
      "continueAnalysis.unhandled",
    );
    const snapshot = await getWorkspaceVideo(user.id, parsed.data);
    if (snapshot) {
      return { ok: true, data: snapshot };
    }
    return { ok: false, error: "not_found" };
  }
}

export type SubmitVideoPrefsResult = GetWorkspaceStatusResult;

export async function submitVideoPrefs(
  input: unknown,
): Promise<SubmitVideoPrefsResult> {
  const parsed = submitVideoPrefsInputSchema.safeParse(input);
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

  if (!(await getOnboardingCompleted(user.id))) {
    return { ok: false, error: "onboarding" };
  }

  try {
    const video = await submitVideoPrefsDomain(user.id, parsed.data.userVideoId, {
      familiarity: parsed.data.familiarity,
      summaryLength: parsed.data.summaryLength,
    });
    if (!video) {
      return { ok: false, error: "not_found" };
    }

    revalidatePath("/library");
    revalidatePath(`/library/${parsed.data.userVideoId}`);
    return { ok: true, data: video };
  } catch (error) {
    logger.error(
      { userVideoId: parsed.data.userVideoId, ...errorFields(error) },
      "submitVideoPrefs.unhandled",
    );
    const snapshot = await getWorkspaceVideo(user.id, parsed.data.userVideoId);
    if (snapshot) {
      return { ok: true, data: snapshot };
    }
    return { ok: false, error: "not_found" };
  }
}
