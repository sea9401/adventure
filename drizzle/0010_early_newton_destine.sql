ALTER TABLE "users" ADD COLUMN "hunt_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "hunt_region" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "hunt_baseline_hp" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "hunt_baseline_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_claim_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_claim_result" jsonb;