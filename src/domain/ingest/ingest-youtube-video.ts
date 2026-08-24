import { and, desc, eq, inArray } from "drizzle-orm";

import { createDb, type Db } from "@/db";
import {
  personalizedAnalyses,
  userVideos,
  type AnalysisStatus,
  type TranscriptSegment,
} from "@/db/schema";
import {
  TranscriptProviderError,
  type TranscriptProvider,
} from "@/lib/youtube/transcript-provider";
import { getPlanForUser } from "@/domain/usage/plan";
import {
  assertDurationAllowed,
  isRefundableErrorCode,
  refundMonthlyPasteSlot,
} from "@/domain/usage";
import { UsageError } from "@/domain/usage/errors";
import { errorFields, logger } from "@/lib/logger";
import { getDefaultTranscriptProvider } from "@/lib/youtube/youtubei-transcript-provider";

function sanitizeThumbnailUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const allowed =
      host === "i.ytimg.com" ||
      host.endsWith(".ytimg.com") ||
      host === "yt3.ggpht.com" ||
      host.endsWith(".ggpht.com");
    return allowed ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export type IngestYoutubeVideoInput = {
  userId: string;
  youtubeId: string;
  familiarity: number;
  summaryLength: number;
  /** Redis key from consumeMonthlyPasteSlot — persisted for refunds. */
  usageQuotaKey?: string | null;
};

export type IngestYoutubeVideoResult = {
  userVideoId: string;
  analysisId: string;
  status: AnalysisStatus;
  runId: string;
};

export type FetchYoutubeVideoInput = {
  userId: string;
  youtubeId: string;
  userVideoId: string;
  runId: string;
};

export type IngestYoutubeVideoDeps = {
  db?: Db;
  transcriptProvider?: TranscriptProvider;
  getPlan?: typeof getPlanForUser;
  refundSlot?: typeof refundMonthlyPasteSlot;
};

type MetadataFields = {
  title: string;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  youtubeCategoryId: string | null;
};

type TransactionClient = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function upsertUserVideoMetadata(
  tx: TransactionClient,
  userId: string,
  youtubeId: string,
  metadata: MetadataFields,
  transcriptSegments: TranscriptSegment[],
  transcriptLanguage: string,
) {
  const [row] = await tx
    .insert(userVideos)
    .values({
      userId,
      youtubeId,
      title: metadata.title,
      channelTitle: metadata.channelTitle,
      thumbnailUrl: sanitizeThumbnailUrl(metadata.thumbnailUrl),
      durationSeconds: metadata.durationSeconds,
      youtubeCategoryId: metadata.youtubeCategoryId,
      transcriptLanguage,
      transcriptSegments,
    })
    .onConflictDoUpdate({
      target: [userVideos.userId, userVideos.youtubeId],
      set: {
        title: metadata.title,
        channelTitle: metadata.channelTitle,
        thumbnailUrl: sanitizeThumbnailUrl(metadata.thumbnailUrl),
        durationSeconds: metadata.durationSeconds,
        youtubeCategoryId: metadata.youtubeCategoryId,
        transcriptLanguage,
        transcriptSegments,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

async function markFetchOutcome(
  tx: TransactionClient,
  userId: string,
  userVideoId: string,
  runId: string,
  outcome:
    | { status: "classifying" }
    | { status: "failed"; code: string; message: string },
) {
  const [row] = await tx
    .update(personalizedAnalyses)
    .set({
      status: outcome.status,
      errorCode: outcome.status === "failed" ? outcome.code : null,
      errorMessage: outcome.status === "failed" ? outcome.message : null,
      classification: null,
      sections: [],
      summary: null,
      ...(outcome.status === "failed" ? { usageQuotaKey: null } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(personalizedAnalyses.userVideoId, userVideoId),
        eq(personalizedAnalyses.userId, userId),
        eq(personalizedAnalyses.runId, runId),
        eq(personalizedAnalyses.status, "fetching"),
      ),
    )
    .returning({
      id: personalizedAnalyses.id,
      status: personalizedAnalyses.status,
      runId: personalizedAnalyses.runId,
    });

  return row ?? null;
}

async function loadUsageQuotaKey(
  tx: TransactionClient,
  userId: string,
  userVideoId: string,
): Promise<string | null> {
  const [row] = await tx
    .select({ usageQuotaKey: personalizedAnalyses.usageQuotaKey })
    .from(personalizedAnalyses)
    .where(
      and(
        eq(personalizedAnalyses.userVideoId, userVideoId),
        eq(personalizedAnalyses.userId, userId),
      ),
    )
    .limit(1);
  return row?.usageQuotaKey ?? null;
}

async function maybeRefundPasteSlot(
  userId: string,
  errorCode: string,
  refundedViaCas: boolean,
  refundSlot: typeof refundMonthlyPasteSlot,
  redisKey: string | null,
): Promise<void> {
  if (!refundedViaCas || !isRefundableErrorCode(errorCode) || !redisKey) {
    return;
  }
  await refundSlot(userId, { redisKey });
}

async function currentIngestResult(
  tx: TransactionClient,
  userId: string,
  userVideoId: string,
): Promise<IngestYoutubeVideoResult | null> {
  const [row] = await tx
    .select({
      analysisId: personalizedAnalyses.id,
      status: personalizedAnalyses.status,
      runId: personalizedAnalyses.runId,
    })
    .from(personalizedAnalyses)
    .where(
      and(
        eq(personalizedAnalyses.userVideoId, userVideoId),
        eq(personalizedAnalyses.userId, userId),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    userVideoId,
    analysisId: row.analysisId,
    status: row.status,
    runId: row.runId,
  };
}

/**
 * Create or refresh a stub library row and land on `pending`.
 * YouTube fetch runs later from the analysis worker.
 */
export async function startYoutubeIngest(
  input: IngestYoutubeVideoInput,
  deps: IngestYoutubeVideoDeps = {},
): Promise<IngestYoutubeVideoResult> {
  const db = deps.db ?? createDb();
  const { userId, youtubeId, familiarity, summaryLength, usageQuotaKey = null } =
    input;
  const runId = crypto.randomUUID();

  return db.transaction(async (tx) => {
    const [userVideo] = await tx
      .insert(userVideos)
      .values({
        userId,
        youtubeId,
        title: youtubeId,
      })
      .onConflictDoUpdate({
        target: [userVideos.userId, userVideos.youtubeId],
        set: {
          updatedAt: new Date(),
        },
      })
      .returning();

    const [analysis] = await tx
      .insert(personalizedAnalyses)
      .values({
        userId,
        userVideoId: userVideo.id,
        status: "pending",
        errorCode: null,
        errorMessage: null,
        classification: null,
        sections: [],
        summary: null,
        familiarity,
        summaryLength,
        runId,
        usageQuotaKey,
      })
      .onConflictDoUpdate({
        target: personalizedAnalyses.userVideoId,
        set: {
          status: "pending",
          errorCode: null,
          errorMessage: null,
          classification: null,
          sections: [],
          summary: null,
          familiarity,
          summaryLength,
          runId,
          usageQuotaKey,
          updatedAt: new Date(),
        },
      })
      .returning();

    return {
      userVideoId: userVideo.id,
      analysisId: analysis.id,
      status: "pending" as const,
      runId: analysis.runId,
    };
  });
}

export async function markAnalysisStartFailed(
  userId: string,
  userVideoId: string,
  deps: { db?: Db } = {},
): Promise<void> {
  const db = deps.db ?? createDb();
  await db
    .update(personalizedAnalyses)
    .set({
      status: "failed",
      errorCode: "analysis_failed",
      errorMessage: "Couldn't start analysis. Try pasting the link again.",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(personalizedAnalyses.userVideoId, userVideoId),
        eq(personalizedAnalyses.userId, userId),
        eq(personalizedAnalyses.status, "pending"),
      ),
    );
}

const IN_FLIGHT_STATUSES = [
  "pending",
  "fetching",
  "classifying",
  "generating",
] as const;

export async function failAnalysisRun(
  userId: string,
  userVideoId: string,
  runId: string,
  deps: { db?: Db } = {},
): Promise<void> {
  const db = deps.db ?? createDb();
  await db
    .update(personalizedAnalyses)
    .set({
      status: "failed",
      errorCode: "analysis_failed",
      errorMessage: "Couldn't understand this video. Paste the link again to retry.",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(personalizedAnalyses.userVideoId, userVideoId),
        eq(personalizedAnalyses.userId, userId),
        eq(personalizedAnalyses.runId, runId),
        inArray(personalizedAnalyses.status, [...IN_FLIGHT_STATUSES]),
      ),
    );
}

/**
 * Fetch metadata + English transcript and move pending/fetching → classifying | failed.
 * Re-pasting the same URL always refetches and refreshes the row.
 */
export async function fetchYoutubeVideo(
  input: FetchYoutubeVideoInput,
  deps: IngestYoutubeVideoDeps = {},
): Promise<IngestYoutubeVideoResult> {
  const db = deps.db ?? createDb();
  const provider = deps.transcriptProvider ?? getDefaultTranscriptProvider();
  const getPlan = deps.getPlan ?? getPlanForUser;
  const refundSlot = deps.refundSlot ?? refundMonthlyPasteSlot;
  const { userId, youtubeId, userVideoId, runId } = input;

  let fetchResult: Awaited<
    ReturnType<TranscriptProvider["getEnglishTranscript"]>
  >;

  try {
    fetchResult = await provider.getEnglishTranscript(youtubeId);
  } catch (error) {
    const providerError =
      error instanceof TranscriptProviderError
        ? error
        : new TranscriptProviderError(
            "provider_error",
            "Could not fetch the video transcript from YouTube",
            { cause: error },
          );

    logger.warn(
      {
        userVideoId,
        youtubeId,
        ...errorFields(providerError),
      },
      "ingest.fetch_err",
    );

    if (providerError.metadata) {
      const result = await db.transaction(async (tx) => {
        const redisKey = await loadUsageQuotaKey(tx, userId, userVideoId);
        const analysis = await markFetchOutcome(tx, userId, userVideoId, runId, {
          status: "failed",
          code: providerError.code,
          message: providerError.message,
        });
        if (!analysis) {
          const current = await currentIngestResult(tx, userId, userVideoId);
          if (current) {
            return { ...current, _refunded: false as const, redisKey: null };
          }
          throw providerError;
        }

        await upsertUserVideoMetadata(
          tx,
          userId,
          youtubeId,
          {
            title: providerError.metadata!.title,
            channelTitle: providerError.metadata!.channelTitle,
            thumbnailUrl: providerError.metadata!.thumbnailUrl,
            durationSeconds: providerError.metadata!.durationSeconds,
            youtubeCategoryId: providerError.metadata!.youtubeCategoryId,
          },
          [],
          "en",
        );

        return {
          userVideoId,
          analysisId: analysis.id,
          status: "failed" as const,
          runId: analysis.runId,
          _refunded: true as const,
          redisKey,
        };
      });

      await maybeRefundPasteSlot(
        userId,
        providerError.code,
        result._refunded,
        refundSlot,
        result.redisKey,
      );
      return {
        userVideoId: result.userVideoId,
        analysisId: result.analysisId,
        status: result.status,
        runId: result.runId,
      };
    }

    const redisKey = await db.transaction(async (tx) =>
      loadUsageQuotaKey(tx, userId, userVideoId),
    );

    const [failed] = await db
      .update(personalizedAnalyses)
      .set({
        status: "failed",
        errorCode: providerError.code,
        errorMessage: providerError.message,
        classification: null,
        sections: [],
        summary: null,
        usageQuotaKey: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(personalizedAnalyses.userVideoId, userVideoId),
          eq(personalizedAnalyses.userId, userId),
          eq(personalizedAnalyses.runId, runId),
          eq(personalizedAnalyses.status, "fetching"),
        ),
      )
      .returning();

    if (failed) {
      await maybeRefundPasteSlot(
        userId,
        providerError.code,
        true,
        refundSlot,
        redisKey,
      );
      return {
        userVideoId,
        analysisId: failed.id,
        status: "failed",
        runId: failed.runId,
      };
    }

    throw providerError;
  }

  try {
    const plan = await getPlan(userId);
    assertDurationAllowed(plan, fetchResult.metadata.durationSeconds);
  } catch (error) {
    const usageError =
      error instanceof UsageError
        ? error
        : new UsageError(
            "usage_unavailable",
            "Couldn't check plan limits for this video.",
            { cause: error },
          );

    const result = await db.transaction(async (tx) => {
      const redisKey = await loadUsageQuotaKey(tx, userId, userVideoId);
      const analysis = await markFetchOutcome(tx, userId, userVideoId, runId, {
        status: "failed",
        code: usageError.code,
        message: usageError.message,
      });
      if (!analysis) {
        const current = await currentIngestResult(tx, userId, userVideoId);
        if (current) {
          return { ...current, _refunded: false as const, redisKey: null };
        }
        throw usageError;
      }

      await upsertUserVideoMetadata(
        tx,
        userId,
        youtubeId,
        {
          title: fetchResult.metadata.title,
          channelTitle: fetchResult.metadata.channelTitle,
          thumbnailUrl: fetchResult.metadata.thumbnailUrl,
          durationSeconds: fetchResult.metadata.durationSeconds,
          youtubeCategoryId: fetchResult.metadata.youtubeCategoryId,
        },
        fetchResult.segments,
        fetchResult.language,
      );

      return {
        userVideoId,
        analysisId: analysis.id,
        status: "failed" as const,
        runId: analysis.runId,
        _refunded: true as const,
        redisKey,
      };
    });

    if (result._refunded && result.redisKey) {
      await refundSlot(userId, { redisKey: result.redisKey });
    }
    return {
      userVideoId: result.userVideoId,
      analysisId: result.analysisId,
      status: result.status,
      runId: result.runId,
    };
  }

  return db.transaction(async (tx) => {
    const analysis = await markFetchOutcome(tx, userId, userVideoId, runId, {
      status: "classifying",
    });
    if (!analysis) {
      const current = await currentIngestResult(tx, userId, userVideoId);
      if (current) {
        return current;
      }
      throw new TranscriptProviderError(
        "provider_error",
        "Could not update analysis after fetching the transcript",
      );
    }

    await upsertUserVideoMetadata(
      tx,
      userId,
      youtubeId,
      {
        title: fetchResult.metadata.title,
        channelTitle: fetchResult.metadata.channelTitle,
        thumbnailUrl: fetchResult.metadata.thumbnailUrl,
        durationSeconds: fetchResult.metadata.durationSeconds,
        youtubeCategoryId: fetchResult.metadata.youtubeCategoryId,
      },
      fetchResult.segments,
      fetchResult.language,
    );

    return {
      userVideoId,
      analysisId: analysis.id,
      status: "classifying" as const,
      runId: analysis.runId,
    };
  });
}

export type LibraryListItem = {
  userVideoId: string;
  youtubeId: string;
  title: string;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  status: AnalysisStatus;
  errorMessage: string | null;
  addedAt: Date;
  refreshedAt: Date;
};

export async function listLibraryForUser(
  userId: string,
  deps: { db?: Db } = {},
): Promise<LibraryListItem[]> {
  const db = deps.db ?? createDb();

  const rows = await db
    .select({
      userVideoId: userVideos.id,
      youtubeId: userVideos.youtubeId,
      title: userVideos.title,
      channelTitle: userVideos.channelTitle,
      thumbnailUrl: userVideos.thumbnailUrl,
      status: personalizedAnalyses.status,
      errorMessage: personalizedAnalyses.errorMessage,
      addedAt: userVideos.createdAt,
      refreshedAt: userVideos.updatedAt,
    })
    .from(userVideos)
    .leftJoin(
      personalizedAnalyses,
      eq(personalizedAnalyses.userVideoId, userVideos.id),
    )
    .where(eq(userVideos.userId, userId))
    .orderBy(desc(userVideos.updatedAt));

  return rows.map((row) => ({
    userVideoId: row.userVideoId,
    youtubeId: row.youtubeId,
    title: row.title,
    channelTitle: row.channelTitle,
    thumbnailUrl: row.thumbnailUrl,
    status: (row.status ?? "pending") as AnalysisStatus,
    errorMessage: row.errorMessage,
    addedAt: row.addedAt,
    refreshedAt: row.refreshedAt,
  }));
}
