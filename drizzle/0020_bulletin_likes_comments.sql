CREATE TABLE "bulletin_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"class_name" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulletin_likes" (
	"post_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bulletin_likes_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "bulletin_comments" ADD CONSTRAINT "bulletin_comments_post_id_bulletin_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."bulletin_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulletin_comments" ADD CONSTRAINT "bulletin_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulletin_likes" ADD CONSTRAINT "bulletin_likes_post_id_bulletin_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."bulletin_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulletin_likes" ADD CONSTRAINT "bulletin_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bulletin_comments_post_created_at_idx" ON "bulletin_comments" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "bulletin_comments_user_created_at_idx" ON "bulletin_comments" USING btree ("user_id","created_at");