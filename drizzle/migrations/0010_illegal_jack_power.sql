CREATE TABLE "inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"dealer_listing_id" text NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_dealer_listing_id_unique" UNIQUE("dealer_listing_id")
);
--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_dealer_listing_id_dealer_listing_id_fk" FOREIGN KEY ("dealer_listing_id") REFERENCES "public"."dealer_listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_listing_idx" ON "inventory" USING btree ("dealer_listing_id");