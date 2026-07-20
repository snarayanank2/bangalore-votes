DROP INDEX "flag_dedupe_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "flag_dedupe_uq" ON "flag_items" USING btree ("target_ref") WHERE status = 'pending';