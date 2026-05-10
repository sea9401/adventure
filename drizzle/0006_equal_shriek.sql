CREATE TABLE "coop_boss_attack_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"damage_dealt" integer NOT NULL,
	"damage_taken" integer NOT NULL,
	"died_early" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coop_boss_attack_log" ADD CONSTRAINT "coop_boss_attack_log_session_id_coop_boss_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."coop_boss_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coop_boss_attack_log" ADD CONSTRAINT "coop_boss_attack_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coop_boss_attack_log_session_idx" ON "coop_boss_attack_log" USING btree ("session_id","created_at");