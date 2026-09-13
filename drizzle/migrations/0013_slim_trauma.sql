CREATE TABLE "enquiry_offer" (
	"id" text PRIMARY KEY NOT NULL,
	"enquiry_id" text NOT NULL,
	"dealer_id" text NOT NULL,
	"price_paise" integer NOT NULL,
	"quantity" integer NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enquiry_offer" ADD CONSTRAINT "enquiry_offer_enquiry_id_enquiry_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_offer" ADD CONSTRAINT "enquiry_offer_dealer_id_dealer_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enquiry_offer_enquiry_idx" ON "enquiry_offer" USING btree ("enquiry_id");--> statement-breakpoint
CREATE INDEX "enquiry_offer_dealer_idx" ON "enquiry_offer" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "enquiry_offer_status_idx" ON "enquiry_offer" USING btree ("status");