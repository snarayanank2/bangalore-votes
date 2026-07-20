CREATE TYPE "public"."budget_kind" AS ENUM('geocode', 'otp_send', 'news_query');--> statement-breakpoint
CREATE TYPE "public"."candidate_status" AS ENUM('filed', 'contesting', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('email', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."corporation" AS ENUM('north', 'south', 'east', 'west', 'central');--> statement-breakpoint
CREATE TYPE "public"."eoi_path" AS ENUM('awareness', 'curation');--> statement-breakpoint
CREATE TYPE "public"."eoi_status" AS ENUM('new', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."extraction_status" AS ENUM('pending', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."flag_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."flag_target" AS ENUM('candidate_field', 'ward_field', 'ward_issue');--> statement-breakpoint
CREATE TYPE "public"."lang" AS ENUM('en', 'kn');--> statement-breakpoint
CREATE TYPE "public"."news_origin" AS ENUM('auto', 'curator');--> statement-breakpoint
CREATE TYPE "public"."news_status" AS ENUM('suggested', 'approved');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('auth', 'add_contact');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('citizen', 'curator', 'admin');--> statement-breakpoint
CREATE TYPE "public"."send_code" AS ENUM('W1', 'R1', 'L1', 'C1', 'C2', 'C3', 'F1');--> statement-breakpoint
CREATE TYPE "public"."send_status" AS ENUM('sent', 'failed', 'suppressed', 'held');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('official', 'curator');--> statement-breakpoint
CREATE TYPE "public"."suppression_reason" AS ENUM('bounce', 'complaint', 'stop');--> statement-breakpoint
CREATE TYPE "public"."translation_status" AS ENUM('pending', 'done', 'manual');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'banned', 'erased');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_user_id" integer,
	"actor_role" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"ward_id" integer,
	"field_key" text,
	"old_value" jsonb,
	"new_value" jsonb,
	"source_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booths" (
	"id" serial PRIMARY KEY NOT NULL,
	"ward_id" integer NOT NULL,
	"name_en" text NOT NULL,
	"name_kn" text,
	"address" text NOT NULL,
	"lat" text NOT NULL,
	"lng" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_counters" (
	"day" date NOT NULL,
	"kind" "budget_kind" NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "budget_counters_day_kind_pk" PRIMARY KEY("day","kind")
);
--> statement-breakpoint
CREATE TABLE "campaign_sends" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" "send_code" NOT NULL,
	"user_id" integer NOT NULL,
	"ward_id" integer NOT NULL,
	"channel" "channel" NOT NULL,
	"language" "lang" NOT NULL,
	"status" "send_status" NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_affidavits" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidate_id" integer NOT NULL,
	"media_id" integer NOT NULL,
	"origin_url" text,
	"extraction_status" "extraction_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidate_id" integer NOT NULL,
	"field_key" text NOT NULL,
	"value_en" text,
	"value_kn" text,
	"not_declared" boolean DEFAULT false NOT NULL,
	"authored_lang" "lang" DEFAULT 'en' NOT NULL,
	"translation_status" "translation_status" DEFAULT 'pending' NOT NULL,
	"source_url" text,
	"source_type" "source_type" DEFAULT 'curator' NOT NULL,
	"ai_extracted" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_news_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"candidate_id" integer NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"domain" text NOT NULL,
	"origin" "news_origin" NOT NULL,
	"status" "news_status" DEFAULT 'suggested' NOT NULL,
	"approved_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_stances" (
	"id" serial PRIMARY KEY NOT NULL,
	"ward_issue_id" integer NOT NULL,
	"candidate_id" integer NOT NULL,
	"value_en" text,
	"value_kn" text,
	"authored_lang" "lang" DEFAULT 'en' NOT NULL,
	"translation_status" "translation_status" DEFAULT 'pending' NOT NULL,
	"source_url" text,
	"source_type" "source_type" DEFAULT 'curator' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"ward_id" integer NOT NULL,
	"name_en" text NOT NULL,
	"name_kn" text,
	"party_en" text NOT NULL,
	"party_kn" text,
	"photo_media_id" integer,
	"status" "candidate_status" DEFAULT 'filed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "candidates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "curator_scopes" (
	"user_id" integer NOT NULL,
	"ward_id" integer NOT NULL,
	CONSTRAINT "curator_scopes_user_id_ward_id_pk" PRIMARY KEY("user_id","ward_id")
);
--> statement-breakpoint
CREATE TABLE "eoi_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"path" "eoi_path" NOT NULL,
	"name" text NOT NULL,
	"organisation" text,
	"contact" text NOT NULL,
	"wards_text" text,
	"message" text,
	"status" "eoi_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flag_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"ward_id" integer NOT NULL,
	"target_type" "flag_target" NOT NULL,
	"target_ref" text NOT NULL,
	"status" "flag_status" DEFAULT 'pending' NOT NULL,
	"resolution_reason" text,
	"resolved_by" integer,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flag_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"flag_item_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"detail" text NOT NULL,
	"suggested_value" text,
	"source_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geocode_cache" (
	"normalized_address" text PRIMARY KEY NOT NULL,
	"ward_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_vote_selections" (
	"set_id" integer NOT NULL,
	"ward_issue_id" integer NOT NULL,
	CONSTRAINT "issue_vote_selections_set_id_ward_issue_id_pk" PRIMARY KEY("set_id","ward_issue_id")
);
--> statement-breakpoint
CREATE TABLE "issue_vote_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"ward_id" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" serial PRIMARY KEY NOT NULL,
	"bytes" "bytea" NOT NULL,
	"content_type" text NOT NULL,
	"sha256" text NOT NULL,
	"size" integer NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"destination" text NOT NULL,
	"channel" "channel" NOT NULL,
	"purpose" "otp_purpose" DEFAULT 'auth' NOT NULL,
	"user_id" integer,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_wards" (
	"partner_id" integer NOT NULL,
	"ward_id" integer NOT NULL,
	CONSTRAINT "partner_wards_partner_id_ward_id_pk" PRIMARY KEY("partner_id","ward_id")
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"contact" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partners_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppressions" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact" text NOT NULL,
	"channel" "channel" NOT NULL,
	"reason" "suppression_reason" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text,
	"phone" text,
	"home_ward_id" integer,
	"language" "lang" DEFAULT 'en' NOT NULL,
	"role" "role" DEFAULT 'citizen' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"src_attribution" text,
	"consent_at" timestamp,
	"consent_version" text,
	"future_tools_opt_in" boolean DEFAULT false NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"whatsapp_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "ward_issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"ward_id" integer NOT NULL,
	"title_en" text,
	"title_kn" text,
	"authored_lang" "lang" DEFAULT 'en' NOT NULL,
	"translation_status" "translation_status" DEFAULT 'pending' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ward_readiness" (
	"ward_id" integer PRIMARY KEY NOT NULL,
	"completeness_snapshot" jsonb,
	"signed_off_by" integer,
	"signed_off_at" timestamp,
	"cleared_at" timestamp,
	"comms_hold_override" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wards" (
	"id" integer PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_kn" text NOT NULL,
	"corporation" "corporation" NOT NULL,
	"zone" text NOT NULL,
	"boundary_ref" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booths" ADD CONSTRAINT "booths_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_sends" ADD CONSTRAINT "campaign_sends_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_affidavits" ADD CONSTRAINT "candidate_affidavits_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_affidavits" ADD CONSTRAINT "candidate_affidavits_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_fields" ADD CONSTRAINT "candidate_fields_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_news_links" ADD CONSTRAINT "candidate_news_links_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_stances" ADD CONSTRAINT "candidate_stances_ward_issue_id_ward_issues_id_fk" FOREIGN KEY ("ward_issue_id") REFERENCES "public"."ward_issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_stances" ADD CONSTRAINT "candidate_stances_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_photo_media_id_media_id_fk" FOREIGN KEY ("photo_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curator_scopes" ADD CONSTRAINT "curator_scopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curator_scopes" ADD CONSTRAINT "curator_scopes_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flag_items" ADD CONSTRAINT "flag_items_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flag_submissions" ADD CONSTRAINT "flag_submissions_flag_item_id_flag_items_id_fk" FOREIGN KEY ("flag_item_id") REFERENCES "public"."flag_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flag_submissions" ADD CONSTRAINT "flag_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_vote_selections" ADD CONSTRAINT "issue_vote_selections_set_id_issue_vote_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."issue_vote_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_vote_selections" ADD CONSTRAINT "issue_vote_selections_ward_issue_id_ward_issues_id_fk" FOREIGN KEY ("ward_issue_id") REFERENCES "public"."ward_issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_vote_sets" ADD CONSTRAINT "issue_vote_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_vote_sets" ADD CONSTRAINT "issue_vote_sets_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_wards" ADD CONSTRAINT "partner_wards_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_wards" ADD CONSTRAINT "partner_wards_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_home_ward_id_wards_id_fk" FOREIGN KEY ("home_ward_id") REFERENCES "public"."wards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ward_issues" ADD CONSTRAINT "ward_issues_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ward_readiness" ADD CONSTRAINT "ward_readiness_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "send_once_uq" ON "campaign_sends" USING btree ("code","user_id","channel");--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_field_uq" ON "candidate_fields" USING btree ("candidate_id","field_key");--> statement-breakpoint
CREATE UNIQUE INDEX "news_link_uq" ON "candidate_news_links" USING btree ("candidate_id","url");--> statement-breakpoint
CREATE UNIQUE INDEX "stance_uq" ON "candidate_stances" USING btree ("ward_issue_id","candidate_id");--> statement-breakpoint
CREATE INDEX "candidates_ward_idx" ON "candidates" USING btree ("ward_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flag_dedupe_uq" ON "flag_items" USING btree ("target_ref","status");--> statement-breakpoint
CREATE UNIQUE INDEX "active_set_uq" ON "issue_vote_sets" USING btree ("user_id") WHERE active;--> statement-breakpoint
CREATE INDEX "otp_destination_idx" ON "otp_codes" USING btree ("destination","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "suppression_uq" ON "suppressions" USING btree ("contact","channel");--> statement-breakpoint
CREATE INDEX "ward_issues_ward_idx" ON "ward_issues" USING btree ("ward_id");