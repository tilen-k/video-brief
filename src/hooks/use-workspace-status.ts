"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { shouldPoll } from "@/domain/workspace/analysis-ui";
import type { WorkspaceVideo } from "@/domain/workspace/get-workspace-video";
import {
  pathForWorkspaceStatusError,
  type WorkspaceStatusClientError,
} from "@/domain/workspace/status-navigation";
import { getWorkspaceStatus } from "@/lib/actions/workspace";

class WorkspaceStatusError extends Error {
  readonly code: WorkspaceStatusClientError;

  constructor(code: WorkspaceStatusClientError) {
    super(code);
    this.name = "WorkspaceStatusError";
    this.code = code;
  }
}

export function useWorkspaceStatus(initial: WorkspaceVideo): WorkspaceVideo {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.setQueryData(["workspace", initial.userVideoId], initial);
  }, [initial, queryClient]);

  const query = useQuery({
    queryKey: ["workspace", initial.userVideoId],
    queryFn: async () => {
      const result = await getWorkspaceStatus(initial.userVideoId);
      if (!result.ok) {
        throw new WorkspaceStatusError(result.error);
      }
      return result.data;
    },
    initialData: initial,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => {
      if (q.state.error) {
        return false;
      }
      const status = q.state.data?.status ?? initial.status;
      return shouldPoll(status) ? 2000 : false;
    },
  });

  useEffect(() => {
    if (query.error instanceof WorkspaceStatusError) {
      const path = pathForWorkspaceStatusError(
        query.error.code,
        initial.userVideoId,
      );
      // Hard navigation avoids History API SecurityError during auth transitions.
      window.location.assign(path);
    }
  }, [initial.userVideoId, query.error]);

  return query.data ?? initial;
}