"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "nextjs-toploader/app";

import type { FamiliarityLevel, SummaryStyle } from "@/lib/validations/onboarding-options";
import type { WorkspaceVideo } from "@/domain/workspace/get-workspace-video";
import {
  pathForWorkspaceStatusError,
  type WorkspaceStatusClientError,
} from "@/domain/workspace/status-navigation";
import { submitVideoPrefs } from "@/lib/actions/workspace";

class SubmitVideoPrefsError extends Error {
  readonly code: WorkspaceStatusClientError;

  constructor(code: WorkspaceStatusClientError) {
    super(code);
    this.name = "SubmitVideoPrefsError";
    this.code = code;
  }
}

export type VideoPrefsPayload = {
  familiarity?: FamiliarityLevel;
  summaryLength?: SummaryStyle;
};

export function useSubmitVideoPrefs(userVideoId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prefs: VideoPrefsPayload) => {
      const result = await submitVideoPrefs({ userVideoId, ...prefs });
      if (!result.ok) {
        throw new SubmitVideoPrefsError(result.error);
      }
      return result.data;
    },
    retry: false,
    onSuccess: (data: WorkspaceVideo) => {
      queryClient.setQueryData(["workspace", data.userVideoId], data);
    },
    onError: (error) => {
      if (error instanceof SubmitVideoPrefsError) {
        router.replace(pathForWorkspaceStatusError(error.code, userVideoId));
      }
    },
  });
}
