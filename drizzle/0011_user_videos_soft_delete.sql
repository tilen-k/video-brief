DROP INDEX "user_videos_user_youtube_uidx";--> statement-breakpoint
ALTER TABLE "user_videos" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "user_videos_user_youtube_active_uidx" ON "user_videos" USING btree ("user_id","youtube_id") WHERE "user_videos"."deleted_at" is null;