-- Phase 6 ERP completion: pricing rules, party credit ledger, goods receipt → stock.
-- Safe additive migration. Does not invent commercial values or outstanding balances.

CREATE TABLE IF NOT EXISTS "pricing_category" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pricing_category_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pricing_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"scope" text NOT NULL,
	"pricing_category_id" text,
	"customer_user_id" text,
	"dealer_id" text,
	"discount_percent" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"notes" text,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pricing_rule_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"pricing_rule_id" text NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"old_values" text,
	"new_values" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "party_ledger_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"dealer_id" text NOT NULL,
	"entry_type" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"balance_after_paise" integer NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"external_reference" text,
	"notes" text,
	"idempotency_key" text,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "party_ledger_entry_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goods_receipt" (
	"id" text PRIMARY KEY NOT NULL,
	"receipt_number" text NOT NULL,
	"purchase_order_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"warehouse_code" text DEFAULT 'MAIN' NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"idempotency_key" text,
	"notes" text,
	"received_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "goods_receipt_receipt_number_unique" UNIQUE("receipt_number"),
	CONSTRAINT "goods_receipt_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goods_receipt_item" (
	"id" text PRIMARY KEY NOT NULL,
	"goods_receipt_id" text NOT NULL,
	"purchase_order_item_id" text NOT NULL,
	"dealer_listing_id" text,
	"part_id" text,
	"part_number" text NOT NULL,
	"part_name" text NOT NULL,
	"quantity_received" integer NOT NULL,
	"stock_adjustment_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchase_order_item" ADD COLUMN IF NOT EXISTS "received_quantity" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "stock_adjustment" ADD COLUMN IF NOT EXISTS "goods_receipt_id" text;
--> statement-breakpoint
ALTER TABLE "stock_adjustment" ADD COLUMN IF NOT EXISTS "goods_receipt_item_id" text;
--> statement-breakpoint
ALTER TABLE "stock_adjustment" ADD COLUMN IF NOT EXISTS "reference_type" text;
--> statement-breakpoint
ALTER TABLE "stock_adjustment" ADD COLUMN IF NOT EXISTS "reference_id" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pricing_rule" ADD CONSTRAINT "pricing_rule_pricing_category_id_pricing_category_id_fk" FOREIGN KEY ("pricing_category_id") REFERENCES "public"."pricing_category"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pricing_rule" ADD CONSTRAINT "pricing_rule_customer_user_id_user_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pricing_rule" ADD CONSTRAINT "pricing_rule_dealer_id_dealer_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealer"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pricing_rule" ADD CONSTRAINT "pricing_rule_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pricing_rule" ADD CONSTRAINT "pricing_rule_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pricing_rule_audit" ADD CONSTRAINT "pricing_rule_audit_pricing_rule_id_pricing_rule_id_fk" FOREIGN KEY ("pricing_rule_id") REFERENCES "public"."pricing_rule"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pricing_rule_audit" ADD CONSTRAINT "pricing_rule_audit_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "party_ledger_entry" ADD CONSTRAINT "party_ledger_entry_dealer_id_dealer_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealer"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "party_ledger_entry" ADD CONSTRAINT "party_ledger_entry_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_purchase_order_id_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_order"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "goods_receipt" ADD CONSTRAINT "goods_receipt_received_by_user_id_user_id_fk" FOREIGN KEY ("received_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "goods_receipt_item" ADD CONSTRAINT "goods_receipt_item_goods_receipt_id_goods_receipt_id_fk" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipt"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "goods_receipt_item" ADD CONSTRAINT "goods_receipt_item_purchase_order_item_id_purchase_order_item_id_fk" FOREIGN KEY ("purchase_order_item_id") REFERENCES "public"."purchase_order_item"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "goods_receipt_item" ADD CONSTRAINT "goods_receipt_item_dealer_listing_id_dealer_listing_id_fk" FOREIGN KEY ("dealer_listing_id") REFERENCES "public"."dealer_listing"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "goods_receipt_item" ADD CONSTRAINT "goods_receipt_item_part_id_part_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."part"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "goods_receipt_item" ADD CONSTRAINT "goods_receipt_item_stock_adjustment_id_stock_adjustment_id_fk" FOREIGN KEY ("stock_adjustment_id") REFERENCES "public"."stock_adjustment"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_adjustment" ADD CONSTRAINT "stock_adjustment_goods_receipt_id_goods_receipt_id_fk" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipt"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pricing_rule_scope_idx" ON "pricing_rule" ("scope");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pricing_rule_customer_idx" ON "pricing_rule" ("customer_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pricing_rule_dealer_idx" ON "pricing_rule" ("dealer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pricing_rule_category_idx" ON "pricing_rule" ("pricing_category_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pricing_rule_active_idx" ON "pricing_rule" ("is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pricing_rule_audit_rule_idx" ON "pricing_rule_audit" ("pricing_rule_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "party_ledger_dealer_idx" ON "party_ledger_entry" ("dealer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "party_ledger_created_idx" ON "party_ledger_entry" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "party_ledger_ref_idx" ON "party_ledger_entry" ("reference_type","reference_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "goods_receipt_po_idx" ON "goods_receipt" ("purchase_order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "goods_receipt_supplier_idx" ON "goods_receipt" ("supplier_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "goods_receipt_status_idx" ON "goods_receipt" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "goods_receipt_item_receipt_idx" ON "goods_receipt_item" ("goods_receipt_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "goods_receipt_item_po_item_idx" ON "goods_receipt_item" ("purchase_order_item_id");
