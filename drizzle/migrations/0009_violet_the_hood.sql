CREATE TABLE "dealer_listing" (
	"id" text PRIMARY KEY NOT NULL,
	"dealer_id" text NOT NULL,
	"part_id" text NOT NULL,
	"sku" text,
	"price_paise" integer NOT NULL,
	"mrp_paise" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dealer_listing" ADD CONSTRAINT "dealer_listing_dealer_id_dealer_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_listing" ADD CONSTRAINT "dealer_listing_part_id_part_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."part"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dealer_listing_dealer_idx" ON "dealer_listing" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "dealer_listing_part_idx" ON "dealer_listing" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "dealer_listing_status_idx" ON "dealer_listing" USING btree ("status");