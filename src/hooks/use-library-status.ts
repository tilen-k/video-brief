"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { shouldPoll } from "@/domain/workspace/analysis-ui";
import type { LibraryListItem } from "@/domain/ingest/ingest-youtube-video";
import { getLibraryStatus } from "@/lib/actions/library";

export function useLibraryStatus(
  initialItems: LibraryListItem[],
): LibraryListItem[] {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.setQueryData(["library"], initialItems);
  }, [initialItems, queryClient]);

  const query = useQuery({
    queryKey: ["library"],
    queryFn: async () => {
      const result = await getLibraryStatus();
      if (!result.ok) {
        queryClient.removeQueries({ queryKey: ["library"] });
        if (result.error === "unauthenticated") {
          // Do not soft-navigate or refresh — races logout → guest remint
          // (Firefox SecurityError). Full-document /auth/signout handles remint.
          return [];
        }
        router.replace("/onboarding");
        return initialItems;
      }
      return result.data;
    },
    initialData: initialItems,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => {
      const items = q.state.data ?? initialItems;
      return items.some((item) => shouldPoll(item.status)) ? 2000 : false;
    },
  });

  return query.data ?? initialItems;
}
