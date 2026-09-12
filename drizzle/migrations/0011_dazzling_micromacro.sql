CREATE TABLE "enquiry" (
	"id" text PRIMARY KEY NOT NULL,
	"buyer_id" text NOT NULL,
	"part_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"message" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "dealer" CASCADE;--> statement-breakpoint
DROP TABLE "dealer_listing" CASCADE;--> statement-breakpoint
DROP TABLE "inventory" CASCADE;--> statement-breakpoint
ALTER TABLE "enquiry" ADD CONSTRAINT "enquiry_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry" ADD CONSTRAINT "enquiry_part_id_part_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."part"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enquiry_buyer_idx" ON "enquiry" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "enquiry_part_idx" ON "enquiry" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "enquiry_status_idx" ON "enquiry" USING btree ("status");