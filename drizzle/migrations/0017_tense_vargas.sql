CREATE TABLE "firm" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"ledger_reference" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "firm_name_unique" UNIQUE("name"),
	CONSTRAINT "firm_code_unique" UNIQUE("code"),
	CONSTRAINT "firm_ledger_reference_unique" UNIQUE("ledger_reference")
);
--> statement-breakpoint
CREATE TABLE "firm_order" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"firm_id" text NOT NULL,
	"allocation_number" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"fulfillment_status" text DEFAULT 'pending' NOT NULL,
	"payment_accounting_reference" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "firm_order_allocation_number_unique" UNIQUE("allocation_number"),
	CONSTRAINT "firm_order_payment_accounting_reference_unique" UNIQUE("payment_accounting_reference")
);
--> statement-breakpoint
CREATE TABLE "firm_order_item" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_order_id" text NOT NULL,
	"order_item_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "firm_order_item_order_item_id_unique" UNIQUE("order_item_id")
);
--> statement-breakpoint
ALTER TABLE "dealer_listing" ADD COLUMN "firm_id" text;--> statement-breakpoint
ALTER TABLE "firm_order" ADD CONSTRAINT "firm_order_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "firm_order" ADD CONSTRAINT "firm_order_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "firm_order_item" ADD CONSTRAINT "firm_order_item_firm_order_id_firm_order_id_fk" FOREIGN KEY ("firm_order_id") REFERENCES "public"."firm_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "firm_order_item" ADD CONSTRAINT "firm_order_item_order_item_id_order_item_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "firm_order_order_firm_unique" ON "firm_order" USING btree ("order_id","firm_id");--> statement-breakpoint
CREATE INDEX "firm_order_firm_status_idx" ON "firm_order" USING btree ("firm_id","fulfillment_status");--> statement-breakpoint
CREATE INDEX "firm_order_item_firm_order_idx" ON "firm_order_item" USING btree ("firm_order_id");--> statement-breakpoint
ALTER TABLE "dealer_listing" ADD CONSTRAINT "dealer_listing_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "firm" ("id", "name", "code", "ledger_reference") VALUES
  ('firm-ambaji-traders', 'Ambaji Traders', 'AMB', 'BUSY-AMB'),
  ('firm-hind-motors', 'Hind Motors', 'HIN', 'BUSY-HIN'),
  ('firm-india-sales', 'India Sales', 'IND', 'BUSY-IND')
ON CONFLICT ("code") DO NOTHING;
