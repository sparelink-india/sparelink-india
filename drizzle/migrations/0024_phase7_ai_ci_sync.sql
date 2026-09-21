ALTER TABLE "part" ADD COLUMN IF NOT EXISTS "approval_status" text DEFAULT 'APPROVED' NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "part_approval_status_idx" ON "part" USING btree ("approval_status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "catalogue_source_item" (
	"id" text PRIMARY KEY NOT NULL,
	"source_key" text NOT NULL,
	"source_sku" text NOT NULL,
	"source_id" text,
	"name" text,
	"manufacturer" text DEFAULT 'ci' NOT NULL,
	"brand" text,
	"category_name" text,
	"oe_code" text,
	"source_price_paise" integer,
	"source_image_url" text,
	"source_url" text,
	"source_hash" text,
	"source_status" text DEFAULT 'LIVE' NOT NULL,
	"approval_status" text DEFAULT 'PENDING_ADMIN_APPROVAL' NOT NULL,
	"part_id" text,
	"last_seen_at" timestamp,
	"source_price_changed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "catalogue_sync_run" (
	"id" text PRIMARY KEY NOT NULL,
	"source_key" text NOT NULL,
	"status" text DEFAULT 'RUNNING' NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"fetch_complete" boolean DEFAULT false NOT NULL,
	"fetched_count" integer DEFAULT 0 NOT NULL,
	"new_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"unchanged_count" integer DEFAULT 0 NOT NULL,
	"source_removed_count" integer DEFAULT 0 NOT NULL,
	"approval_pending_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"error_summary" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"triggered_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "catalogue_source_item" ADD CONSTRAINT "catalogue_source_item_part_id_part_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."part"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "catalogue_source_item_source_sku_uidx" ON "catalogue_source_item" USING btree ("source_key","manufacturer","source_sku");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "catalogue_source_item_part_idx" ON "catalogue_source_item" USING btree ("part_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "catalogue_source_item_status_idx" ON "catalogue_source_item" USING btree ("source_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "catalogue_source_item_approval_idx" ON "catalogue_source_item" USING btree ("approval_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "catalogue_sync_run_source_idx" ON "catalogue_sync_run" USING btree ("source_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "catalogue_sync_run_status_idx" ON "catalogue_sync_run" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "catalogue_sync_run_started_idx" ON "catalogue_sync_run" USING btree ("started_at");
