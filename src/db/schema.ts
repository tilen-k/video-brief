import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { SummaryStyle } from "@/lib/validations/onboarding-options";

export const ANALYSIS_STATUSES = [
  "pending",
  "fetching",
  "classifying",
  "generating",
  "complete",
  "failed",
] as const;

export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export type { SummaryStyle };

export type TranscriptSegment = {
  startMs: number;
  endMs?: number;
  text: string;
};

export type ClassificationConfidence = "high" | "medium" | "low";

export type ClassificationSnapshot = {
  isEducational: boolean;
  confidence: ClassificationConfidence;
  topic: string | null;
};

export type GeneratedSection = {
  title: string;
  startTime: number;
  endTime: number;
  body: string;
};

export const PLAN_IDS = ["free", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  yearOfBirth: integer("year_of_birth"),
  educationLevel: text("education_level"),
  subjects: jsonb("subjects").$type<string[] | null>(),
  summaryStyle: text("summary_style").$type<SummaryStyle | null>(),
  plan: text("plan").$type<PlanId>().notNull().default("free"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Per-user library entry: metadata + English transcript snapshot.
 * Re-pasting the same URL refreshes this row (no shared cache).
 */
export const userVideos = pgTable(
  "user_videos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    youtubeId: text("youtube_id").notNull(),
    title: text("title").notNull(),
    channelTitle: text("channel_title"),
    thumbnailUrl: text("thumbnail_url"),
    durationSeconds: integer("duration_seconds"),
    youtubeCategoryId: text("youtube_category_id"),
    transcriptLanguage: text("transcript_language").notNull().default("en"),
    transcriptSegments: jsonb("transcript_segments")
      .$type<TranscriptSegment[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("user_videos_user_youtube_uidx").on(
      table.userId,
      table.youtubeId,
    ),
    index("user_videos_user_updated_idx").on(table.userId, table.updatedAt),
  ],
);

/** Per-user analysis state (1:1 with user_videos). */
export const personalizedAnalyses = pgTable(
  "personalized_analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    userVideoId: uuid("user_video_id")
      .notNull()
      .references(() => userVideos.id, { onDelete: "cascade" }),
    status: text("status").$type<AnalysisStatus>().notNull().default("pending"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    classification: jsonb("classification").$type<ClassificationSnapshot | null>(),
    familiarity: integer("familiarity").notNull().default(50),
    summaryLength: integer("summary_length").notNull().default(50),
    summary: text("summary"),
    runId: uuid("run_id").notNull().defaultRandom(),
    /** Redis monthly counter key consumed at paste; used for pre-LLM refunds. */
    usageQuotaKey: text("usage_quota_key"),
    sections: jsonb("sections")
      .$type<GeneratedSection[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("personalized_analyses_user_video_uidx").on(table.userVideoId),
    index("personalized_analyses_user_id_idx").on(table.userId),
    index("personalized_analyses_user_status_idx").on(table.userId, table.status),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type UserVideo = typeof userVideos.$inferSelect;
export type NewUserVideo = typeof userVideos.$inferInsert;
export type PersonalizedAnalysis = typeof personalizedAnalyses.$inferSelect;
export type NewPersonalizedAnalysis = typeof personalizedAnalyses.$inferInsert;
