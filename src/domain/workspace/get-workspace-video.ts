import { and, eq } from "drizzle-orm";

import { createDb, type Db } from "@/db";
import {
  personalizedAnalyses,
  userVideos,
  type AnalysisStatus,
} from "@/db/schema";

export type WorkspaceVideo = {
  userVideoId: string;
  youtubeId: string;
  title: string;
  channelTitle: string | null;
  status: AnalysisStatus;
  errorCode: string | null;
  errorMessage: string | null;
};

export async function getWorkspaceVideo(
  userId: string,
  userVideoId: string,
  deps: { db?: Db } = {},
): Promise<WorkspaceVideo | null> {
  const db = deps.db ?? createDb();

  const [row] = await db
    .select({
      userVideoId: userVideos.id,
      youtubeId: userVideos.youtubeId,
      title: userVideos.title,
      channelTitle: userVideos.channelTitle,
      status: personalizedAnalyses.status,
      errorCode: personalizedAnalyses.errorCode,
      errorMessage: personalizedAnalyses.errorMessage,
    })
    .from(userVideos)
    .leftJoin(
      personalizedAnalyses,
      and(
        eq(personalizedAnalyses.userVideoId, userVideos.id),
        eq(personalizedAnalyses.userId, userId),
      ),
    )
    .where(
      and(eq(userVideos.id, userVideoId), eq(userVideos.userId, userId)),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    userVideoId: row.userVideoId,
    youtubeId: row.youtubeId,
    title: row.title,
    channelTitle: row.channelTitle,
    status: (row.status ?? "pending") as AnalysisStatus,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
  };
}
