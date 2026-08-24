import { and, eq } from "drizzle-orm";

import { createDb, type Db } from "@/db";
import {
  personalizedAnalyses,
  profiles,
  userVideos,
  type AnalysisStatus,
  type ClassificationSnapshot,
  type GeneratedSection,
} from "@/db/schema";

export type WorkspaceVideo = {
  userVideoId: string;
  youtubeId: string;
  title: string;
  channelTitle: string | null;
  status: AnalysisStatus;
  errorCode: string | null;
  errorMessage: string | null;
  classification: ClassificationSnapshot | null;
  familiarity: number;
  summaryLength: number;
  summary: string | null;
  runId: string;
  sections: GeneratedSection[];
};

function asSections(value: unknown): GeneratedSection[] {
  return Array.isArray(value) ? (value as GeneratedSection[]) : [];
}

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
      classification: personalizedAnalyses.classification,
      familiarity: personalizedAnalyses.familiarity,
      summaryLength: personalizedAnalyses.summaryLength,
      summary: personalizedAnalyses.summary,
      runId: personalizedAnalyses.runId,
      sections: personalizedAnalyses.sections,
    })
    .from(userVideos)
    .innerJoin(profiles, eq(profiles.id, userVideos.userId))
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
    classification: row.classification ?? null,
    familiarity: row.familiarity ?? 50,
    summaryLength: row.summaryLength ?? 50,
    summary: row.summary ?? null,
    runId: row.runId ?? "00000000-0000-0000-0000-000000000000",
    sections: asSections(row.sections),
  };
}
