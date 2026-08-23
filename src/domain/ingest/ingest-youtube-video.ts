import { and, desc, eq } from "drizzle-orm";

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
};

export type IngestYoutubeVideoResult = {
  userVideoId: string;
  analysisId: string;
  status: AnalysisStatus;
};

export type IngestYoutubeVideoDeps = {
  db?: Db;
  transcriptProvider?: TranscriptProvider;
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
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(personalizedAnalyses.userVideoId, userVideoId),
        eq(personalizedAnalyses.userId, userId),
        eq(personalizedAnalyses.status, "fetching"),
      ),
    )
    .returning();

  return row ?? null;
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
  };
}

/**
 * Create or refresh a stub library row and land on `pending`.
 * YouTube fetch runs later from the workspace.
 */
export async function startYoutubeIngest(
  input: IngestYoutubeVideoInput,
  deps: IngestYoutubeVideoDeps = {},
): Promise<IngestYoutubeVideoResult> {
  const db = deps.db ?? createDb();
  const { userId, youtubeId } = input;

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
      })
      .onConflictDoUpdate({
        target: personalizedAnalyses.userVideoId,
        set: {
          status: "pending",
          errorCode: null,
          errorMessage: null,
          classification: null,
          sections: [],
          updatedAt: new Date(),
        },
      })
      .returning();

    return {
      userVideoId: userVideo.id,
      analysisId: analysis.id,
      status: "pending" as const,
    };
  });
}

/**
 * Fetch metadata + English transcript and move pending/fetching → classifying | failed.
 * Re-pasting the same URL always refetches and refreshes the row.
 */
export async function fetchYoutubeVideo(
  input: IngestYoutubeVideoInput & { userVideoId: string },
  deps: IngestYoutubeVideoDeps = {},
): Promise<IngestYoutubeVideoResult> {
  const db = deps.db ?? createDb();
  const provider = deps.transcriptProvider ?? getDefaultTranscriptProvider();
  const { userId, youtubeId, userVideoId } = input;

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

    if (providerError.metadata) {
      return db.transaction(async (tx) => {
        const analysis = await markFetchOutcome(tx, userId, userVideoId, {
          status: "failed",
          code: providerError.code,
          message: providerError.message,
        });
        if (!analysis) {
          const current = await currentIngestResult(tx, userId, userVideoId);
          if (current) {
            return current;
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
        };
      });
    }

    const [failed] = await db
      .update(personalizedAnalyses)
      .set({
        status: "failed",
        errorCode: providerError.code,
        errorMessage: providerError.message,
        classification: null,
        sections: [],
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(personalizedAnalyses.userVideoId, userVideoId),
          eq(personalizedAnalyses.userId, userId),
          eq(personalizedAnalyses.status, "fetching"),
        ),
      )
      .returning();

    if (failed) {
      return {
        userVideoId,
        analysisId: failed.id,
        status: "failed",
      };
    }

    throw providerError;
  }

  return db.transaction(async (tx) => {
    const analysis = await markFetchOutcome(tx, userId, userVideoId, {
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
