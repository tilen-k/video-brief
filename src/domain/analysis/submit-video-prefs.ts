import { and, eq } from "drizzle-orm";

import { createDb, type Db } from "@/db";
import {
  personalizedAnalyses,
  userVideos,
  type FamiliarityLevel,
  type SummaryStyle,
} from "@/db/schema";
import {
  getWorkspaceVideo,
  type WorkspaceVideo,
} from "@/domain/workspace/get-workspace-video";
import { logger } from "@/lib/logger";

export type SubmitVideoPrefsInput = {
  familiarity?: FamiliarityLevel;
  summaryLength?: SummaryStyle;
};

export type SubmitVideoPrefsDeps = {
  db?: Db;
};

/**
 * Persist optional per-video prefs from awaiting, then land on generating.
 * Omitted fields keep the previous value (or null). Empty submit is valid.
 */
export async function submitVideoPrefs(
  userId: string,
  userVideoId: string,
  prefs: SubmitVideoPrefsInput,
  deps: SubmitVideoPrefsDeps = {},
): Promise<WorkspaceVideo | null> {
  const db = deps.db ?? createDb();

  const [row] = await db
    .select({
      analysisId: personalizedAnalyses.id,
      status: personalizedAnalyses.status,
    })
    .from(userVideos)
    .innerJoin(
      personalizedAnalyses,
      and(
        eq(personalizedAnalyses.userVideoId, userVideos.id),
        eq(personalizedAnalyses.userId, userId),
      ),
    )
    .where(and(eq(userVideos.id, userVideoId), eq(userVideos.userId, userId)))
    .limit(1);

  if (!row) {
    logger.warn({ userVideoId }, "submitVideoPrefs.not_found");
    return null;
  }

  if (row.status !== "awaiting") {
    logger.debug({ userVideoId, status: row.status }, "submitVideoPrefs.skip");
    return getWorkspaceVideo(userId, userVideoId, { db });
  }

  const written = await db
    .update(personalizedAnalyses)
    .set({
      ...(prefs.familiarity !== undefined
        ? { familiarity: prefs.familiarity }
        : {}),
      ...(prefs.summaryLength !== undefined
        ? { summaryLength: prefs.summaryLength }
        : {}),
      status: "generating",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(personalizedAnalyses.id, row.analysisId),
        eq(personalizedAnalyses.userId, userId),
        eq(personalizedAnalyses.status, "awaiting"),
      ),
    )
    .returning({ id: personalizedAnalyses.id });

  logger.info(
    {
      userVideoId,
      analysisId: row.analysisId,
      wrote: written.length > 0,
      familiarity: prefs.familiarity ?? null,
      summaryLength: prefs.summaryLength ?? null,
    },
    "submitVideoPrefs.done",
  );

  return getWorkspaceVideo(userId, userVideoId, { db });
}
