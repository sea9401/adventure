CREATE TABLE "server_feed" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "share_feed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "server_feed" ADD CONSTRAINT "server_feed_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "server_feed_user_type_idx" ON "server_feed" USING btree ("user_id","type","created_at");