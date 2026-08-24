import { and, eq, sql } from "drizzle-orm";

import { createDb, type Db } from "@/db";
import {
  personalizedAnalyses,
  userVideos,
  type AnalysisStatus,
  type ClassificationSnapshot,
  type GeneratedSection,
  type TranscriptSegment,
} from "@/db/schema";
import { analysisConfig } from "@/domain/analysis/config";
import { getUserProfile } from "@/domain/analysis/get-user-profile";
import { defaultSummaryLength } from "@/domain/analysis/prefs";
import { prefsToAsk } from "@/domain/analysis/prefs-to-ask";
import {
  clampSectionTimes,
  preferEducational,
} from "@/domain/analysis/prefer-educational";
import {
  classifyVideoSchema,
  generateSectionsSchema,
} from "@/domain/analysis/schemas";
import { selectTranscriptSubset } from "@/domain/analysis/select-transcript-subset";
import { fetchYoutubeVideo } from "@/domain/ingest/ingest-youtube-video";
import { getPlanForUser } from "@/domain/usage/plan";
import {
  getWorkspaceVideo,
  type WorkspaceVideo,
} from "@/domain/workspace/get-workspace-video";
import { getAIProviderForPlan } from "@/lib/ai/get-default-ai-provider";
import type { AIProvider } from "@/lib/ai/provider";
import { errorFields, logger } from "@/lib/logger";
import type { TranscriptProvider } from "@/lib/youtube/transcript-provider";

export const ANALYSIS_FAILED_CODE = "analysis_failed";
export const ANALYSIS_FAILED_MESSAGE =
  "Couldn't understand this video. Paste the link again to retry.";

const WORK_STATUSES: AnalysisStatus[] = [
  "pending",
  "fetching",
  "classifying",
  "generating",
];

export function timestampToEpochMs(value: Date | string): number {
  if (value instanceof Date) {
    const ms = value.getTime();
    if (Number.isNaN(ms)) {
      throw new Error("Invalid Date for analysis CAS");
    }
    return ms;
  }

  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid timestamp for analysis CAS: ${value}`);
  }
  return ms;
}

export type ContinueAnalysisDeps = {
  db?: Db;
  ai?: AIProvider;
  transcriptProvider?: TranscriptProvider;
};

type LoadedRow = {
  userVideoId: string;
  youtubeId: string;
  title: string;
  channelTitle: string | null;
  durationSeconds: number | null;
  youtubeCategoryId: string | null;
  transcriptSegments: TranscriptSegment[];
  analysisId: string;
  status: AnalysisStatus;
  errorCode: string | null;
  errorMessage: string | null;
  analysisUpdatedAt: Date | string;
  classification: ClassificationSnapshot | null;
  familiarity: WorkspaceVideo["familiarity"];
  summaryLength: WorkspaceVideo["summaryLength"];
};

async function persistAnalysis(
  db: Db,
  input: {
    analysisId: string;
    userId: string;
    loadedUpdatedAt: Date | string;
    fromStatus: AnalysisStatus;
    values: {
      status: AnalysisStatus;
      errorCode?: string | null;
      errorMessage?: string | null;
      classification?: ClassificationSnapshot | null;
      sections?: GeneratedSection[];
    };
  },
) {
  let loadedMs: number | null = null;
  try {
    loadedMs = timestampToEpochMs(input.loadedUpdatedAt);
  } catch (error) {
    logger.warn(
      {
        analysisId: input.analysisId,
        loadedUpdatedAt: String(input.loadedUpdatedAt),
        ...errorFields(error),
      },
      "analysis.persist_ts_parse",
    );
  }

  const casTime =
    loadedMs === null
      ? null
      : sql`floor(extract(epoch from ${personalizedAnalyses.updatedAt}) * 1000) = ${loadedMs}`;

  if (casTime === null) {
    logger.warn(
      { analysisId: input.analysisId },
      "analysis.persist_skip_bad_ts",
    );
    return [];
  }

  const written = await db
    .update(personalizedAnalyses)
    .set({
      ...input.values,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(personalizedAnalyses.id, input.analysisId),
        eq(personalizedAnalyses.userId, input.userId),
        eq(personalizedAnalyses.status, input.fromStatus),
        casTime,
      ),
    )
    .returning({ id: personalizedAnalyses.id });

  logger.info(
    {
      analysisId: input.analysisId,
      fromStatus: input.fromStatus,
      targetStatus: input.values.status,
      loadedMs,
      persistRows: written.length,
      casHit: written.length > 0,
    },
    "analysis.persist",
  );

  return written;
}

const inFlightContinues = new Map<string, Promise<WorkspaceVideo | null>>();

/**
 * Advance one pipeline stage (fetch | classify | generate).
 * Concurrent calls for the same user+video join one in-flight run.
 */
export async function continueAnalysis(
  userId: string,
  userVideoId: string,
  deps: ContinueAnalysisDeps = {},
): Promise<WorkspaceVideo | null> {
  const key = `${userId}:${userVideoId}`;
  const existing = inFlightContinues.get(key);
  if (existing) {
    logger.debug({ userVideoId }, "continueAnalysis.coalesce");
    return existing;
  }

  const run = runContinueAnalysis(userId, userVideoId, deps);
  inFlightContinues.set(key, run);
  try {
    return await run;
  } finally {
    inFlightContinues.delete(key);
  }
}

async function runContinueAnalysis(
  userId: string,
  userVideoId: string,
  deps: ContinueAnalysisDeps,
): Promise<WorkspaceVideo | null> {
  const db = deps.db ?? createDb();
  const ai =
    deps.ai ??
    getAIProviderForPlan(await getPlanForUser(userId, { db }));

  const [row] = await db
    .select({
      userVideoId: userVideos.id,
      youtubeId: userVideos.youtubeId,
      title: userVideos.title,
      channelTitle: userVideos.channelTitle,
      durationSeconds: userVideos.durationSeconds,
      youtubeCategoryId: userVideos.youtubeCategoryId,
      transcriptSegments: userVideos.transcriptSegments,
      analysisId: personalizedAnalyses.id,
      status: personalizedAnalyses.status,
      errorCode: personalizedAnalyses.errorCode,
      errorMessage: personalizedAnalyses.errorMessage,
      analysisUpdatedAt: personalizedAnalyses.updatedAt,
      classification: personalizedAnalyses.classification,
      familiarity: personalizedAnalyses.familiarity,
      summaryLength: personalizedAnalyses.summaryLength,
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
    logger.warn({ userVideoId }, "continueAnalysis.not_found");
    return null;
  }

  const loaded = row as LoadedRow;
  const log = logger.child({
    userVideoId,
    analysisId: loaded.analysisId,
    youtubeId: loaded.youtubeId,
  });

  if (!WORK_STATUSES.includes(loaded.status)) {
    log.debug({ status: loaded.status }, "continueAnalysis.skip");
    return getWorkspaceVideo(userId, userVideoId, { db });
  }

  log.info(
    {
      status: loaded.status,
      loadedUpdatedAt: loaded.analysisUpdatedAt,
      segmentCount: (loaded.transcriptSegments ?? []).length,
    },
    "continueAnalysis.start",
  );

  if (loaded.status === "pending" || loaded.status === "fetching") {
    return runFetch(userId, userVideoId, loaded, db, deps, log);
  }

  if (loaded.status === "classifying") {
    return runClassify(userId, userVideoId, loaded, db, ai, log);
  }

  return runGenerate(userId, userVideoId, loaded, db, ai, log);
}

async function failStage(
  db: Db,
  userId: string,
  userVideoId: string,
  row: LoadedRow,
  fromStatus: AnalysisStatus,
  reason: string,
  error?: unknown,
): Promise<WorkspaceVideo | null> {
  logger.warn(
    {
      userVideoId,
      analysisId: row.analysisId,
      reason,
      ...(error === undefined ? {} : errorFields(error)),
    },
    "continueAnalysis.fail",
  );

  const written = await persistAnalysis(db, {
    analysisId: row.analysisId,
    userId,
    loadedUpdatedAt: row.analysisUpdatedAt,
    fromStatus,
    values: {
      status: "failed",
      errorCode: ANALYSIS_FAILED_CODE,
      errorMessage: ANALYSIS_FAILED_MESSAGE,
    },
  });

  if (written.length === 0) {
    logger.warn({ userVideoId }, "continueAnalysis.fail_cas_miss");
  }

  return getWorkspaceVideo(userId, userVideoId, { db });
}

async function runFetch(
  userId: string,
  userVideoId: string,
  row: LoadedRow,
  db: Db,
  deps: ContinueAnalysisDeps,
  log: typeof logger,
): Promise<WorkspaceVideo | null> {
  if (row.status === "pending") {
    const claimed = await persistAnalysis(db, {
      analysisId: row.analysisId,
      userId,
      loadedUpdatedAt: row.analysisUpdatedAt,
      fromStatus: "pending",
      values: { status: "fetching" },
    });
    if (claimed.length === 0) {
      log.warn("continueAnalysis.fetch_claim_miss");
      return getWorkspaceVideo(userId, userVideoId, { db });
    }
  }

  try {
    await fetchYoutubeVideo(
      { userId, youtubeId: row.youtubeId, userVideoId },
      { db, transcriptProvider: deps.transcriptProvider },
    );
  } catch (error) {
    log.warn({ ...errorFields(error) }, "continueAnalysis.fetch_err");
    await db
      .update(personalizedAnalyses)
      .set({
        status: "failed",
        errorCode: ANALYSIS_FAILED_CODE,
        errorMessage: ANALYSIS_FAILED_MESSAGE,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(personalizedAnalyses.id, row.analysisId),
          eq(personalizedAnalyses.userId, userId),
          eq(personalizedAnalyses.status, "fetching"),
        ),
      );
  }

  return getWorkspaceVideo(userId, userVideoId, { db });
}

async function runClassify(
  userId: string,
  userVideoId: string,
  row: LoadedRow,
  db: Db,
  ai: AIProvider,
  log: typeof logger,
): Promise<WorkspaceVideo | null> {
  const segments = (row.transcriptSegments ?? []) as TranscriptSegment[];
  if (segments.length === 0) {
    return failStage(db, userId, userVideoId, row, "classifying", "empty_transcript");
  }

  const excerpt = selectTranscriptSubset(
    segments,
    row.durationSeconds,
    analysisConfig.transcript.classifyCharBudget,
  );

  let parsed;
  try {
    const raw = await ai.classifyVideo({
      title: row.title,
      channelTitle: row.channelTitle,
      durationSeconds: row.durationSeconds,
      youtubeCategoryId: row.youtubeCategoryId,
      transcriptExcerpt: excerpt,
    });
    parsed = classifyVideoSchema.parse(raw);
  } catch (error) {
    return failStage(db, userId, userVideoId, row, "classifying", "llm_or_zod", error);
  }

  const preferred = preferEducational(parsed);
  const classification: ClassificationSnapshot = {
    isEducational: preferred.isEducational,
    confidence: preferred.confidence,
    topic: preferred.topic ?? null,
  };
  const asked = prefsToAsk(classification);
  const nextStatus =
    asked.askFamiliarity || asked.askLength ? "awaiting" : "generating";

  const written = await persistAnalysis(db, {
    analysisId: row.analysisId,
    userId,
    loadedUpdatedAt: row.analysisUpdatedAt,
    fromStatus: "classifying",
    values: {
      status: nextStatus,
      errorCode: null,
      errorMessage: null,
      classification,
    },
  });

  if (written.length === 0) {
    log.warn("continueAnalysis.cas_miss");
  } else {
    log.info(
      {
        isEducational: classification.isEducational,
        nextStatus,
      },
      "continueAnalysis.classify_done",
    );
  }

  return getWorkspaceVideo(userId, userVideoId, { db });
}

async function runGenerate(
  userId: string,
  userVideoId: string,
  row: LoadedRow,
  db: Db,
  ai: AIProvider,
  log: typeof logger,
): Promise<WorkspaceVideo | null> {
  const segments = (row.transcriptSegments ?? []) as TranscriptSegment[];
  if (segments.length === 0) {
    return failStage(db, userId, userVideoId, row, "generating", "empty_transcript");
  }

  const classification = row.classification;
  if (!classification) {
    return failStage(db, userId, userVideoId, row, "generating", "missing_classification");
  }

  const profile = (await getUserProfile(userId, { db })) ?? {
    yearOfBirth: null,
    educationLevel: null,
    subjects: null,
    summaryStyle: null,
  };
  const transcriptSubset = selectTranscriptSubset(segments, row.durationSeconds);
  const effectiveLength =
    row.summaryLength ?? defaultSummaryLength(profile.summaryStyle);

  let parsed;
  try {
    const raw = await ai.generateSections({
      title: row.title,
      channelTitle: row.channelTitle,
      durationSeconds: row.durationSeconds,
      transcriptSubset,
      classification,
      profile,
      prefs: {
        familiarity: row.familiarity,
        summaryLength: effectiveLength,
      },
    });
    parsed = generateSectionsSchema.parse(raw);
  } catch (error) {
    return failStage(db, userId, userVideoId, row, "generating", "llm_or_zod", error);
  }

  const sections = clampSectionTimes(parsed.sections, row.durationSeconds);

  const written = await persistAnalysis(db, {
    analysisId: row.analysisId,
    userId,
    loadedUpdatedAt: row.analysisUpdatedAt,
    fromStatus: "generating",
    values: {
      status: "complete",
      errorCode: null,
      errorMessage: null,
      sections,
    },
  });

  if (written.length === 0) {
    log.warn("continueAnalysis.cas_miss");
  } else {
    log.info({ sectionCount: sections.length }, "continueAnalysis.generate_done");
  }

  return getWorkspaceVideo(userId, userVideoId, { db });
}
