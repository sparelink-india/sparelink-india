CREATE TABLE "dealer" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"business_name" text NOT NULL,
	"gstin" text,
	"phone" text,
	"email" text,
	"address" text,
	"city" text,
	"state" text,
	"pincode" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dealer_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
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
CREATE TABLE "inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"dealer_listing_id" text NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_dealer_listing_id_unique" UNIQUE("dealer_listing_id")
);
--> statement-breakpoint
ALTER TABLE "dealer" ADD CONSTRAINT "dealer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_listing" ADD CONSTRAINT "dealer_listing_dealer_id_dealer_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_listing" ADD CONSTRAINT "dealer_listing_part_id_part_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."part"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_dealer_listing_id_dealer_listing_id_fk" FOREIGN KEY ("dealer_listing_id") REFERENCES "public"."dealer_listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dealer_user_idx" ON "dealer" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dealer_gstin_idx" ON "dealer" USING btree ("gstin");--> statement-breakpoint
CREATE INDEX "dealer_listing_dealer_idx" ON "dealer_listing" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "dealer_listing_part_idx" ON "dealer_listing" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "dealer_listing_status_idx" ON "dealer_listing" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inventory_listing_idx" ON "inventory" USING btree ("dealer_listing_id");