CREATE TABLE "order" (
	"id" text PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"buyer_id" text NOT NULL,
	"status" text DEFAULT 'placed' NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"payment_method" text DEFAULT 'cash_on_delivery' NOT NULL,
	"subtotal_paise" integer NOT NULL,
	"shipping_paise" integer DEFAULT 0 NOT NULL,
	"total_paise" integer NOT NULL,
	"shipping_name" text NOT NULL,
	"shipping_phone" text NOT NULL,
	"shipping_address_line1" text NOT NULL,
	"shipping_address_line2" text,
	"shipping_city" text NOT NULL,
	"shipping_state" text NOT NULL,
	"shipping_pincode" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "order_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "order_item" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"dealer_listing_id" text NOT NULL,
	"dealer_id" text NOT NULL,
	"part_id" text NOT NULL,
	"part_number" text NOT NULL,
	"part_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_paise" integer NOT NULL,
	"total_paise" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_dealer_listing_id_dealer_listing_id_fk" FOREIGN KEY ("dealer_listing_id") REFERENCES "public"."dealer_listing"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_dealer_id_dealer_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_part_id_part_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."part"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_buyer_idx" ON "order" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "order_status_idx" ON "order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_created_at_idx" ON "order" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "order_item_order_idx" ON "order_item" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_item_dealer_idx" ON "order_item" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "order_item_listing_idx" ON "order_item" USING btree ("dealer_listing_id");