ALTER TABLE "personalized_analyses" ADD COLUMN "model_tier" text DEFAULT 'basic' NOT NULL;--> statement-breakpoint
ALTER TABLE "personalized_analyses" ADD CONSTRAINT "personalized_analyses_model_tier_check" CHECK ("model_tier" IN ('basic', 'advanced'));--> statement-breakpoint
UPDATE "personalized_analyses" AS pa
SET "model_tier" = 'advanced'
FROM "profiles" AS p
WHERE pa."user_id" = p."id"
  AND p."plan" = 'pro'
  AND pa."status" IN ('pending', 'fetching', 'generating');
