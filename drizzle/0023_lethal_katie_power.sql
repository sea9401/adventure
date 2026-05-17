CREATE TABLE "pvp_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" text NOT NULL,
	"attacker_id" text NOT NULL,
	"defender_id" text NOT NULL,
	"outcome" text NOT NULL,
	"attacker_rating_before" integer NOT NULL,
	"defender_rating_before" integer NOT NULL,
	"attacker_rating_after" integer NOT NULL,
	"defender_rating_after" integer NOT NULL,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pvp_matches_outcome_valid" CHECK ("pvp_matches"."outcome" IN ('a_win','d_win','draw'))
);
--> statement-breakpoint
CREATE TABLE "pvp_ratings" (
	"user_id" text NOT NULL,
	"season_id" text NOT NULL,
	"rating" integer DEFAULT 1000 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"daily_earned" integer DEFAULT 0 NOT NULL,
	"daily_reset_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pvp_ratings_user_id_season_id_pk" PRIMARY KEY("user_id","season_id")
);
--> statement-breakpoint
CREATE TABLE "pvp_seasons" (
	"id" text PRIMARY KEY NOT NULL,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"closed_at" timestamp,
	"rewards_granted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "pvp_matches" ADD CONSTRAINT "pvp_matches_season_id_pvp_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."pvp_seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pvp_matches" ADD CONSTRAINT "pvp_matches_attacker_id_users_id_fk" FOREIGN KEY ("attacker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pvp_matches" ADD CONSTRAINT "pvp_matches_defender_id_users_id_fk" FOREIGN KEY ("defender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pvp_ratings" ADD CONSTRAINT "pvp_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pvp_ratings" ADD CONSTRAINT "pvp_ratings_season_id_pvp_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."pvp_seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pvp_matches_attacker_idx" ON "pvp_matches" USING btree ("attacker_id","created_at");--> statement-breakpoint
CREATE INDEX "pvp_matches_defender_idx" ON "pvp_matches" USING btree ("defender_id","created_at");--> statement-breakpoint
CREATE INDEX "pvp_ratings_season_rating_idx" ON "pvp_ratings" USING btree ("season_id","rating" DESC);