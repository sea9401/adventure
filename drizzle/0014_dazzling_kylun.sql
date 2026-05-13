CREATE TABLE "guild_join_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "accepting_requests" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "guild_join_requests" ADD CONSTRAINT "guild_join_requests_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_join_requests" ADD CONSTRAINT "guild_join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "guild_join_requests_user_pending_unique_idx" ON "guild_join_requests" USING btree ("user_id") WHERE "guild_join_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "guild_join_requests_guild_idx" ON "guild_join_requests" USING btree ("guild_id","created_at") WHERE "guild_join_requests"."status" = 'pending';