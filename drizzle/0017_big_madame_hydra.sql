ALTER TABLE "coop_boss_sessions" ADD COLUMN "regen_per_min" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "coop_boss_sessions" ADD COLUMN "last_regen_at" timestamp;