ALTER TABLE "personalized_analyses" ADD COLUMN "summary_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "default_summary_language" text;--> statement-breakpoint
UPDATE "profiles" SET "default_summary_language" = 'en' WHERE "default_summary_language" IS NULL;