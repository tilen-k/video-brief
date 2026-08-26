ALTER TABLE "profiles" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "stripe_subscription_status" text;--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_stripe_customer_uidx" ON "profiles" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_stripe_subscription_uidx" ON "profiles" USING btree ("stripe_subscription_id");