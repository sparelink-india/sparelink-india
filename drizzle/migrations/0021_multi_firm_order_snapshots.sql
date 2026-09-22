ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "gst_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "checkout_idempotency_key" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "order_checkout_idempotency_key_unique" ON "order" USING btree ("checkout_idempotency_key");
--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "part_brand" text;
--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "sku" text;
--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "firm_id" text;
--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "list_inclusive_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "discount_percent" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "discount_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "gst_rate" integer DEFAULT 18 NOT NULL;
--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "base_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "gst_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "line_discount_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "line_base_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "line_gst_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_item" ADD CONSTRAINT "order_item_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
ALTER TABLE "firm_order" ADD COLUMN IF NOT EXISTS "subtotal_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "firm_order" ADD COLUMN IF NOT EXISTS "gst_paise" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "firm_order" ADD COLUMN IF NOT EXISTS "payment_method" text DEFAULT 'cash_on_delivery' NOT NULL;
--> statement-breakpoint
ALTER TABLE "firm_order" ADD COLUMN IF NOT EXISTS "invoice_reference" text;
--> statement-breakpoint
UPDATE "order" SET "gst_paise" = GREATEST(0, "total_paise" - "subtotal_paise" - COALESCE("shipping_paise", 0))
WHERE "gst_paise" = 0 AND "total_paise" > "subtotal_paise";
