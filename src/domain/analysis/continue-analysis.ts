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
import { defaultLengthScore } from "@/domain/analysis/prefs";
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
import {
  getWorkspaceVideo,
  type WorkspaceVideo,
} from "@/domain/workspace/get-workspace-video";
import { getDefaultAIProvider } from "@/lib/ai/get-default-ai-provider";
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
  expectedRunId?: string;
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
  familiarity: number;
  summaryLength: number;
  runId: string;
};

async function persistAnalysis(
  db: Db,
  input: {
    analysisId: string;
    userId: string;
    runId: string;
    loadedUpdatedAt: Date | string;
    fromStatus: AnalysisStatus;
    values: {
      status: AnalysisStatus;
      errorCode?: string | null;
      errorMessage?: string | null;
      classification?: ClassificationSnapshot | null;
      sections?: GeneratedSection[];
      summary?: string | null;
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
        eq(personalizedAnalyses.runId, input.runId),
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

/**
 * Advance one pipeline stage (fetch | classify | generate).
 */
export async function continueAnalysis(
  userId: string,
  userVideoId: string,
  deps: ContinueAnalysisDeps = {},
): Promise<WorkspaceVideo | null> {
  return runContinueAnalysis(userId, userVideoId, deps);
}

async function runContinueAnalysis(
  userId: string,
  userVideoId: string,
  deps: ContinueAnalysisDeps,
): Promise<WorkspaceVideo | null> {
  const db = deps.db ?? createDb();
  const ai = deps.ai ?? getDefaultAIProvider();

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
      runId: personalizedAnalyses.runId,
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

  if (deps.expectedRunId && loaded.runId !== deps.expectedRunId) {
    log.debug({ status: loaded.status }, "continueAnalysis.run_mismatch");
    return getWorkspaceVideo(userId, userVideoId, { db });
  }

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

async function snapshotOrThrowCas(
  db: Db,
  userId: string,
  userVideoId: string,
  runId: string,
  written: { id: string }[],
  logMessage: string,
): Promise<WorkspaceVideo | null> {
  const snapshot = await getWorkspaceVideo(userId, userVideoId, { db });
  if (written.length > 0) {
    return snapshot;
  }
  logger.warn({ userVideoId }, logMessage);
  if (
    snapshot &&
    snapshot.runId === runId &&
    WORK_STATUSES.includes(snapshot.status)
  ) {
    throw new Error("analysis persist lost the race");
  }
  return snapshot;
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
    runId: row.runId,
    loadedUpdatedAt: row.analysisUpdatedAt,
    fromStatus,
    values: {
      status: "failed",
      errorCode: ANALYSIS_FAILED_CODE,
      errorMessage: ANALYSIS_FAILED_MESSAGE,
    },
  });

  return snapshotOrThrowCas(
    db,
    userId,
    userVideoId,
    row.runId,
    written,
    "continueAnalysis.fail_cas_miss",
  );
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
      runId: row.runId,
      loadedUpdatedAt: row.analysisUpdatedAt,
      fromStatus: "pending",
      values: { status: "fetching" },
    });
    if (claimed.length === 0) {
      return snapshotOrThrowCas(
        db,
        userId,
        userVideoId,
        row.runId,
        claimed,
        "continueAnalysis.fetch_claim_miss",
      );
    }
  }

  try {
    await fetchYoutubeVideo(
      { userId, youtubeId: row.youtubeId, userVideoId, runId: row.runId },
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
          eq(personalizedAnalyses.runId, row.runId),
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

  const written = await persistAnalysis(db, {
    analysisId: row.analysisId,
    userId,
    runId: row.runId,
    loadedUpdatedAt: row.analysisUpdatedAt,
    fromStatus: "classifying",
    values: {
      status: "generating",
      errorCode: null,
      errorMessage: null,
      classification,
    },
  });

  if (written.length > 0) {
    log.info(
      {
        isEducational: classification.isEducational,
      },
      "continueAnalysis.classify_done",
    );
  }

  return snapshotOrThrowCas(
    db,
    userId,
    userVideoId,
    row.runId,
    written,
    "continueAnalysis.cas_miss",
  );
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
    row.summaryLength ?? defaultLengthScore(profile.summaryStyle);

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
    runId: row.runId,
    loadedUpdatedAt: row.analysisUpdatedAt,
    fromStatus: "generating",
    values: {
      status: "complete",
      errorCode: null,
      errorMessage: null,
      sections,
      summary: parsed.summary,
    },
  });

  if (written.length > 0) {
    log.info({ sectionCount: sections.length }, "continueAnalysis.generate_done");
  }

  return snapshotOrThrowCas(
    db,
    userId,
    userVideoId,
    row.runId,
    written,
    "continueAnalysis.cas_miss",
  );
}
