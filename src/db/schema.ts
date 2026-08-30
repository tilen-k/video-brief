import { isNull } from "drizzle-orm";
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

export const ANALYSIS_STATUSES = [
  "pending",
  "fetching",
  "generating",
  "complete",
  "failed",
] as const;

export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export type TranscriptSegment = {
  startMs: number;
  endMs?: number;
  text: string;
};

export type GeneratedSection = {
  title: string;
  startTime: number;
  endTime: number;
  body: string;
};

export const PLAN_IDS = ["free", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const MODEL_TIERS = ["basic", "advanced"] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    email: text("email"),
    displayName: text("display_name"),
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    summaryTone: integer("summary_tone").notNull().default(50),
    summaryLength: integer("summary_length").notNull().default(50),
    /** ISO 639-1 output language for summaries; null until lazy-seeded for guests. */
    defaultSummaryLanguage: text("default_summary_language"),
    plan: text("plan").$type<PlanId>().notNull().default("free"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripeSubscriptionStatus: text("stripe_subscription_status"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("profiles_stripe_customer_uidx").on(table.stripeCustomerId),
    uniqueIndex("profiles_stripe_subscription_uidx").on(
      table.stripeSubscriptionId,
    ),
  ],
);

/**
 * Per-user library entry: metadata + transcript snapshot.
 * Re-running Generate on the same URL refreshes the **active** row (no shared cache).
 * Soft-deleted rows keep history; re-add after delete inserts a new row.
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
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("user_videos_user_youtube_active_uidx")
      .on(table.userId, table.youtubeId)
      .where(isNull(table.deletedAt)),
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
    /** Topic familiarity 0–100 when category qualifies; otherwise null. */
    familiarity: integer("familiarity"),
    summaryLength: integer("summary_length").notNull().default(50),
    summaryTone: integer("summary_tone").notNull().default(50),
    modelTier: text("model_tier")
      .$type<ModelTier>()
      .notNull()
      .default("basic"),
    /** ISO 639-1 language for generated overview + section bodies. */
    summaryLanguage: text("summary_language").notNull().default("en"),
    summary: text("summary"),
    runId: uuid("run_id").notNull().defaultRandom(),
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

/** One row per Generate reservation. Refunds set refunded_at; counts ignore those. */
export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    runId: uuid("run_id").notNull(),
    tier: text("tier").$type<ModelTier>().notNull(),
    periodDay: text("period_day").notNull(),
    periodHour: text("period_hour").notNull(),
    ipHash: text("ip_hash"),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("usage_events_run_id_uidx").on(table.runId),
    index("usage_events_user_day_tier_active_idx")
      .on(table.userId, table.periodDay, table.tier)
      .where(isNull(table.refundedAt)),
    index("usage_events_day_tier_active_idx")
      .on(table.periodDay, table.tier)
      .where(isNull(table.refundedAt)),
    index("usage_events_hour_tier_active_idx")
      .on(table.periodHour, table.tier)
      .where(isNull(table.refundedAt)),
    index("usage_events_ip_day_tier_active_idx")
      .on(table.ipHash, table.periodDay, table.tier)
      .where(isNull(table.refundedAt)),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type UserVideo = typeof userVideos.$inferSelect;
export type NewUserVideo = typeof userVideos.$inferInsert;
export type PersonalizedAnalysis = typeof personalizedAnalyses.$inferSelect;
export type NewPersonalizedAnalysis = typeof personalizedAnalyses.$inferInsert;
export type UsageEvent = typeof usageEvents.$inferSelect;
export type NewUsageEvent = typeof usageEvents.$inferInsert;
