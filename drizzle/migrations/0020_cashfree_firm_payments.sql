ALTER TABLE "firm_order" ADD COLUMN IF NOT EXISTS "payment_status" text DEFAULT 'unpaid' NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "firm_order_id" text;
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "firm_id" text;
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "payment_session_id" text;
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "gateway_status" text;
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "paid_at" timestamp;
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "failed_at" timestamp;
--> statement-breakpoint
UPDATE "payment" AS p
SET
	"firm_order_id" = fo.id,
	"firm_id" = fo.firm_id
FROM "firm_order" AS fo
WHERE p."order_id" = fo."order_id"
	AND p."firm_order_id" IS NULL
	AND (
		SELECT COUNT(*)::integer
		FROM "firm_order" AS fo_count
		WHERE fo_count."order_id" = p."order_id"
	) = 1;
--> statement-breakpoint
ALTER TABLE "payment" ALTER COLUMN "firm_order_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment" ALTER COLUMN "firm_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment" DROP CONSTRAINT IF EXISTS "payment_order_id_unique";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment" ADD CONSTRAINT "payment_firm_order_id_firm_order_id_fk" FOREIGN KEY ("firm_order_id") REFERENCES "public"."firm_order"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment" ADD CONSTRAINT "payment_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_firm_order_id_unique" ON "payment" USING btree ("firm_order_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_idempotency_key_unique" ON "payment" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_order_idx" ON "payment" USING btree ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_firm_idx" ON "payment" USING btree ("firm_id");
