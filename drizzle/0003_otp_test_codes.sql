CREATE TABLE "otp_test_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"destination" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "otp_test_codes_destination_idx" ON "otp_test_codes" USING btree ("destination","created_at");