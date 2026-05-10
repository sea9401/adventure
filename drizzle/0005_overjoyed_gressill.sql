CREATE TABLE "coop_boss_contributors" (
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"damage" integer DEFAULT 0 NOT NULL,
	"attack_count" integer DEFAULT 0 NOT NULL,
	"last_attack_at" timestamp,
	"claimed_at" timestamp,
	"claimed_tier" text,
	CONSTRAINT "coop_boss_contributors_session_id_user_id_pk" PRIMARY KEY("session_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "coop_boss_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"region_id" text NOT NULL,
	"boss_name" text NOT NULL,
	"hp" integer NOT NULL,
	"max_hp" integer NOT NULL,
	"spawned_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"defeated_at" timestamp,
	"next_spawn_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "coop_boss_contributors" ADD CONSTRAINT "coop_boss_contributors_session_id_coop_boss_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."coop_boss_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coop_boss_contributors" ADD CONSTRAINT "coop_boss_contributors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coop_boss_contributors_user_idx" ON "coop_boss_contributors" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coop_boss_active_region_idx" ON "coop_boss_sessions" USING btree ("region_id") WHERE "coop_boss_sessions"."defeated_at" IS NULL;--> statement-breakpoint
CREATE INDEX "coop_boss_next_spawn_idx" ON "coop_boss_sessions" USING btree ("next_spawn_at");