CREATE TABLE "guild_quest_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" integer NOT NULL,
	"week_start" timestamp NOT NULL,
	"quest_def_id" text NOT NULL,
	"grade" text NOT NULL,
	"status" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"target" integer NOT NULL,
	"activated_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "fame_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "fame_available" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "guild_quest_instances" ADD CONSTRAINT "guild_quest_instances_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "guild_quest_active_unique_idx" ON "guild_quest_instances" USING btree ("guild_id") WHERE "guild_quest_instances"."status" = 'active';--> statement-breakpoint
CREATE INDEX "guild_quest_guild_week_idx" ON "guild_quest_instances" USING btree ("guild_id","week_start");