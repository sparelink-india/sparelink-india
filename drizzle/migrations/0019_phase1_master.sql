ALTER TABLE "part" ADD COLUMN IF NOT EXISTS "oem_number" text;
--> statement-breakpoint
ALTER TABLE "part" ADD COLUMN IF NOT EXISTS "alternate_part_numbers" text;
--> statement-breakpoint
ALTER TABLE "part" ADD COLUMN IF NOT EXISTS "barcode" text;
--> statement-breakpoint
ALTER TABLE "part" ADD COLUMN IF NOT EXISTS "product_type" text DEFAULT 'aftermarket' NOT NULL;
--> statement-breakpoint
ALTER TABLE "part" ADD COLUMN IF NOT EXISTS "warranty_months" integer;
--> statement-breakpoint
ALTER TABLE "part" ADD COLUMN IF NOT EXISTS "specifications" text;
--> statement-breakpoint
ALTER TABLE "part" ADD COLUMN IF NOT EXISTS "slug" text;
--> statement-breakpoint
ALTER TABLE "part" ADD COLUMN IF NOT EXISTS "seo_title" text;
--> statement-breakpoint
ALTER TABLE "part" ADD COLUMN IF NOT EXISTS "seo_description" text;
--> statement-breakpoint
ALTER TABLE "part" ADD COLUMN IF NOT EXISTS "is_published" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "dealer" ADD COLUMN IF NOT EXISTS "owner_name" text;
--> statement-breakpoint
ALTER TABLE "dealer" ADD COLUMN IF NOT EXISTS "pan" text;
--> statement-breakpoint
ALTER TABLE "dealer" ADD COLUMN IF NOT EXISTS "billing_address" text;
--> statement-breakpoint
ALTER TABLE "dealer" ADD COLUMN IF NOT EXISTS "approval_status" text DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "dealer" ADD COLUMN IF NOT EXISTS "credit_limit_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "dealer" ADD COLUMN IF NOT EXISTS "payment_terms" text;
--> statement-breakpoint
ALTER TABLE "dealer" ADD COLUMN IF NOT EXISTS "price_group" text DEFAULT 'standard' NOT NULL;
--> statement-breakpoint
ALTER TABLE "dealer" ADD COLUMN IF NOT EXISTS "discount_group" text;
--> statement-breakpoint
ALTER TABLE "dealer" ADD COLUMN IF NOT EXISTS "rejection_reason" text;
--> statement-breakpoint
ALTER TABLE "dealer" ADD COLUMN IF NOT EXISTS "approved_at" timestamp;
--> statement-breakpoint
ALTER TABLE "dealer" ADD COLUMN IF NOT EXISTS "approved_by" text;
--> statement-breakpoint
ALTER TABLE "firm" ADD COLUMN IF NOT EXISTS "legal_name" text;
--> statement-breakpoint
ALTER TABLE "firm" ADD COLUMN IF NOT EXISTS "address" text;
--> statement-breakpoint
ALTER TABLE "firm" ADD COLUMN IF NOT EXISTS "phone" text;
--> statement-breakpoint
ALTER TABLE "firm" ADD COLUMN IF NOT EXISTS "email" text;
--> statement-breakpoint
ALTER TABLE "firm" ADD COLUMN IF NOT EXISTS "gstin" text;
--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "reserved_quantity" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "warehouse_code" text DEFAULT 'MAIN' NOT NULL;
--> statement-breakpoint
ALTER TABLE "manual_payment_submission" ADD COLUMN IF NOT EXISTS "firm_order_id" text;
--> statement-breakpoint
ALTER TABLE "manual_payment_submission" ADD COLUMN IF NOT EXISTS "firm_id" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "firm_payment_config" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"account_name" text,
	"account_number" text,
	"ifsc_code" text,
	"bank_name" text,
	"branch" text,
	"upi_id" text,
	"qr_image_url" text,
	"payment_instructions" text,
	"cod_enabled" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_address" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"label" text DEFAULT 'Home' NOT NULL,
	"contact_name" text NOT NULL,
	"phone" text NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"pincode" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_vehicle" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"vehicle_type" text DEFAULT 'car' NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"year" integer,
	"variant" text,
	"registration_number" text,
	"vin" text,
	"catalog_vehicle_id" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wishlist" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"part_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "retailer_document" (
	"id" text PRIMARY KEY NOT NULL,
	"dealer_id" text NOT NULL,
	"document_type" text NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "return_request" (
	"id" text PRIMARY KEY NOT NULL,
	"request_number" text NOT NULL,
	"order_id" text NOT NULL,
	"order_item_id" text,
	"buyer_id" text NOT NULL,
	"firm_id" text,
	"request_type" text NOT NULL,
	"reason" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"photo_urls" text,
	"video_urls" text,
	"document_urls" text,
	"admin_note" text,
	"resolution_note" text,
	"resolved_at" timestamp,
	"resolved_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "warranty_claim" (
	"id" text PRIMARY KEY NOT NULL,
	"claim_number" text NOT NULL,
	"order_id" text NOT NULL,
	"order_item_id" text,
	"buyer_id" text NOT NULL,
	"firm_id" text,
	"part_id" text,
	"issue_description" text NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"photo_urls" text,
	"video_urls" text,
	"document_urls" text,
	"admin_note" text,
	"resolution_note" text,
	"resolved_at" timestamp,
	"resolved_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_ticket" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_number" text NOT NULL,
	"user_id" text NOT NULL,
	"order_id" text,
	"firm_id" text,
	"category" text NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"photo_urls" text,
	"video_urls" text,
	"document_urls" text,
	"assigned_to" text,
	"internal_notes" text,
	"resolution_note" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "warehouse" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"state" text,
	"pincode" text,
	"firm_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_shipment" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"firm_order_id" text,
	"courier_name" text,
	"tracking_number" text,
	"tracking_url" text,
	"shipping_label_url" text,
	"expected_delivery_date" timestamp,
	"shipped_at" timestamp,
	"delivered_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "firm_payment_config" ADD CONSTRAINT "firm_payment_config_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_address" ADD CONSTRAINT "customer_address_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_vehicle" ADD CONSTRAINT "customer_vehicle_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_part_id_part_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."part"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "return_request" ADD CONSTRAINT "return_request_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "warranty_claim" ADD CONSTRAINT "warranty_claim_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_shipment" ADD CONSTRAINT "order_shipment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "firm_payment_config_firm_id_unique" ON "firm_payment_config" USING btree ("firm_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wishlist_user_part_unique" ON "wishlist" USING btree ("user_id","part_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "return_request_request_number_unique" ON "return_request" USING btree ("request_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "warranty_claim_claim_number_unique" ON "warranty_claim" USING btree ("claim_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "support_ticket_ticket_number_unique" ON "support_ticket" USING btree ("ticket_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "warehouse_code_unique" ON "warehouse" USING btree ("code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "part_oem_number_idx" ON "part" USING btree ("oem_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dealer_approval_status_idx" ON "dealer" USING btree ("approval_status");
--> statement-breakpoint
-- Existing dealers remain pending until explicitly approved by an admin.
