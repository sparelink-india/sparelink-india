CREATE TABLE IF NOT EXISTS "supplier" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"phone" text,
	"email" text,
	"address" text,
	"city" text,
	"state" text,
	"pincode" text,
	"gstin" text,
	"pan" text,
	"payment_terms" text,
	"firm_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_adjustment" (
	"id" text PRIMARY KEY NOT NULL,
	"inventory_id" text NOT NULL,
	"dealer_listing_id" text NOT NULL,
	"actor_user_id" text,
	"previous_quantity" integer NOT NULL,
	"new_quantity" integer NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"warehouse_code" text DEFAULT 'MAIN' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_order" (
	"id" text PRIMARY KEY NOT NULL,
	"so_number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"firm_id" text,
	"dealer_id" text,
	"buyer_user_id" text,
	"party_name" text NOT NULL,
	"party_phone" text,
	"delivery_address" text,
	"notes" text,
	"subtotal_paise" integer DEFAULT 0 NOT NULL,
	"gst_paise" integer DEFAULT 0 NOT NULL,
	"total_paise" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" text,
	"converted_order_id" text,
	"quotation_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sales_order_so_number_unique" UNIQUE("so_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_order_item" (
	"id" text PRIMARY KEY NOT NULL,
	"sales_order_id" text NOT NULL,
	"dealer_listing_id" text,
	"part_id" text,
	"part_number" text NOT NULL,
	"part_name" text NOT NULL,
	"sku" text,
	"quantity" integer NOT NULL,
	"unit_price_paise" integer NOT NULL,
	"gst_rate" integer DEFAULT 18 NOT NULL,
	"line_gst_paise" integer DEFAULT 0 NOT NULL,
	"line_total_paise" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_order" (
	"id" text PRIMARY KEY NOT NULL,
	"po_number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"supplier_id" text NOT NULL,
	"firm_id" text,
	"warehouse_code" text DEFAULT 'MAIN' NOT NULL,
	"expected_delivery_date" timestamp,
	"notes" text,
	"subtotal_paise" integer DEFAULT 0 NOT NULL,
	"gst_paise" integer DEFAULT 0 NOT NULL,
	"total_paise" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_order_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_order_item" (
	"id" text PRIMARY KEY NOT NULL,
	"purchase_order_id" text NOT NULL,
	"dealer_listing_id" text,
	"part_id" text,
	"part_number" text NOT NULL,
	"part_name" text NOT NULL,
	"sku" text,
	"quantity" integer NOT NULL,
	"unit_cost_paise" integer NOT NULL,
	"gst_rate" integer DEFAULT 18 NOT NULL,
	"line_gst_paise" integer DEFAULT 0 NOT NULL,
	"line_total_paise" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotation" (
	"id" text PRIMARY KEY NOT NULL,
	"quotation_number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"firm_id" text,
	"dealer_id" text,
	"party_name" text NOT NULL,
	"party_phone" text,
	"valid_until" timestamp,
	"notes" text,
	"subtotal_paise" integer DEFAULT 0 NOT NULL,
	"gst_paise" integer DEFAULT 0 NOT NULL,
	"total_paise" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" text,
	"converted_sales_order_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quotation_quotation_number_unique" UNIQUE("quotation_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotation_item" (
	"id" text PRIMARY KEY NOT NULL,
	"quotation_id" text NOT NULL,
	"dealer_listing_id" text,
	"part_id" text,
	"part_number" text NOT NULL,
	"part_name" text NOT NULL,
	"sku" text,
	"quantity" integer NOT NULL,
	"unit_price_paise" integer NOT NULL,
	"gst_rate" integer DEFAULT 18 NOT NULL,
	"line_gst_paise" integer DEFAULT 0 NOT NULL,
	"line_total_paise" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supplier" ADD CONSTRAINT "supplier_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_adjustment" ADD CONSTRAINT "stock_adjustment_inventory_id_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_adjustment" ADD CONSTRAINT "stock_adjustment_dealer_listing_id_dealer_listing_id_fk" FOREIGN KEY ("dealer_listing_id") REFERENCES "public"."dealer_listing"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_adjustment" ADD CONSTRAINT "stock_adjustment_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_dealer_id_dealer_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealer"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_buyer_user_id_user_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_converted_order_id_order_id_fk" FOREIGN KEY ("converted_order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sales_order_item" ADD CONSTRAINT "sales_order_item_sales_order_id_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_order"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sales_order_item" ADD CONSTRAINT "sales_order_item_dealer_listing_id_dealer_listing_id_fk" FOREIGN KEY ("dealer_listing_id") REFERENCES "public"."dealer_listing"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sales_order_item" ADD CONSTRAINT "sales_order_item_part_id_part_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."part"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_purchase_order_id_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_order"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_dealer_listing_id_dealer_listing_id_fk" FOREIGN KEY ("dealer_listing_id") REFERENCES "public"."dealer_listing"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_part_id_part_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."part"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotation" ADD CONSTRAINT "quotation_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotation" ADD CONSTRAINT "quotation_dealer_id_dealer_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealer"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotation" ADD CONSTRAINT "quotation_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotation_item" ADD CONSTRAINT "quotation_item_quotation_id_quotation_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotation"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotation_item" ADD CONSTRAINT "quotation_item_dealer_listing_id_dealer_listing_id_fk" FOREIGN KEY ("dealer_listing_id") REFERENCES "public"."dealer_listing"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotation_item" ADD CONSTRAINT "quotation_item_part_id_part_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."part"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_firm_idx" ON "supplier" USING btree ("firm_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_active_idx" ON "supplier" USING btree ("is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_adjustment_inventory_idx" ON "stock_adjustment" USING btree ("inventory_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_adjustment_listing_idx" ON "stock_adjustment" USING btree ("dealer_listing_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_adjustment_created_idx" ON "stock_adjustment" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_order_status_idx" ON "sales_order" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_order_firm_idx" ON "sales_order" USING btree ("firm_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_order_dealer_idx" ON "sales_order" USING btree ("dealer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_order_item_so_idx" ON "sales_order_item" USING btree ("sales_order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_order_status_idx" ON "purchase_order" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_order_supplier_idx" ON "purchase_order" USING btree ("supplier_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_order_firm_idx" ON "purchase_order" USING btree ("firm_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_order_item_po_idx" ON "purchase_order_item" USING btree ("purchase_order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotation_status_idx" ON "quotation" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotation_dealer_idx" ON "quotation" USING btree ("dealer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotation_item_quotation_idx" ON "quotation_item" USING btree ("quotation_id");
--> statement-breakpoint
INSERT INTO "warehouse" ("id", "code", "name", "is_active", "created_at", "updated_at")
VALUES ('warehouse-main', 'MAIN', 'Main Warehouse', true, now(), now())
ON CONFLICT ("code") DO NOTHING;
