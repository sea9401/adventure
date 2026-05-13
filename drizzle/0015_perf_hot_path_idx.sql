CREATE INDEX "bulletin_posts_user_created_at_idx" ON "bulletin_posts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "coop_boss_contributors_session_damage_idx" ON "coop_boss_contributors" USING btree ("session_id","damage" DESC);--> statement-breakpoint
CREATE INDEX "messages_user_created_at_idx" ON "messages" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "presence_last_seen_at_idx" ON "presence" USING btree ("last_seen_at");