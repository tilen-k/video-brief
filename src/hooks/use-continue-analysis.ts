"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { shouldPoll } from "@/domain/workspace/analysis-ui";
import type { WorkspaceVideo } from "@/domain/workspace/get-workspace-video";
import {
  pathForWorkspaceStatusError,
  type WorkspaceStatusClientError,
} from "@/domain/workspace/status-navigation";
import { continueAnalysis } from "@/lib/actions/workspace";

class ContinueAnalysisError extends Error {
  readonly code: WorkspaceStatusClientError;

  constructor(code: WorkspaceStatusClientError) {
    super(code);
    this.name = "ContinueAnalysisError";
    this.code = code;
  }
}

const MAX_ATTEMPTS = 3;

export function useContinueAnalysis(video: WorkspaceVideo): void {
  const router = useRouter();
  const queryClient = useQueryClient();
  const startedFor = useRef<string | null>(null);
  const attemptsFor = useRef({ key: "", count: 0 });
  const [kickNonce, setKickNonce] = useState(0);

  const { mutate } = useMutation({
    mutationFn: async (userVideoId: string) => {
      const result = await continueAnalysis(userVideoId);
      if (!result.ok) {
        throw new ContinueAnalysisError(result.error);
      }
      return result.data;
    },
    retry: false,
    onSuccess: (data) => {
      queryClient.setQueryData(["workspace", data.userVideoId], data);
      if (shouldPoll(data.status)) {
        startedFor.current = null;
        setKickNonce((nonce) => nonce + 1);
      }
    },
    onError: (error) => {
      startedFor.current = null;
      setKickNonce((nonce) => nonce + 1);
      if (error instanceof ContinueAnalysisError) {
        router.replace(
          pathForWorkspaceStatusError(error.code, video.userVideoId),
        );
      }
    },
  });

  useEffect(() => {
    const workKey = `${video.userVideoId}:${video.status}`;

    if (!shouldPoll(video.status)) {
      startedFor.current = null;
      attemptsFor.current = { key: "", count: 0 };
      return;
    }

    if (startedFor.current === workKey) {
      return;
    }

    if (attemptsFor.current.key !== workKey) {
      attemptsFor.current = { key: workKey, count: 0 };
    }

    if (attemptsFor.current.count >= MAX_ATTEMPTS) {
      return;
    }

    startedFor.current = workKey;
    attemptsFor.current.count += 1;
    mutate(video.userVideoId);
  }, [kickNonce, mutate, video.status, video.userVideoId]);
}
