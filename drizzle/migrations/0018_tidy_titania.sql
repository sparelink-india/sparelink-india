CREATE TABLE "customer_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"contact_name" text,
	"business_name" text,
	"gstin" text,
	"customer_type" text DEFAULT 'b2c' NOT NULL,
	"billing_address_line1" text,
	"billing_address_line2" text,
	"billing_city" text,
	"billing_state" text,
	"billing_pincode" text,
	"shipping_address_line1" text,
	"shipping_address_line2" text,
	"shipping_city" text,
	"shipping_state" text,
	"shipping_pincode" text,
	"shipping_preference" text DEFAULT 'courier' NOT NULL,
	"transport_name" text,
	"transport_phone" text,
	"transport_gstin" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "manual_payment_submission" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"buyer_id" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"utr_reference" text NOT NULL,
	"payment_date" timestamp NOT NULL,
	"proof_file_url" text,
	"proof_file_name" text,
	"proof_file_type" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"admin_note" text,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "buyer_business_name" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "buyer_gstin" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "customer_type" text DEFAULT 'b2c' NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "shipping_method" text DEFAULT 'courier' NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "transport_name" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "transport_phone" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "transport_gstin" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "billing_address_line1" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "billing_address_line2" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "billing_city" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "billing_state" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "billing_pincode" text;--> statement-breakpoint
ALTER TABLE "customer_profile" ADD CONSTRAINT "customer_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payment_submission" ADD CONSTRAINT "manual_payment_submission_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payment_submission" ADD CONSTRAINT "manual_payment_submission_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payment_submission" ADD CONSTRAINT "manual_payment_submission_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_profile_user_idx" ON "customer_profile" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "customer_profile_gstin_idx" ON "customer_profile" USING btree ("gstin");--> statement-breakpoint
CREATE INDEX "customer_profile_business_name_idx" ON "customer_profile" USING btree ("business_name");--> statement-breakpoint
CREATE INDEX "manual_payment_order_idx" ON "manual_payment_submission" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "manual_payment_buyer_idx" ON "manual_payment_submission" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "manual_payment_status_idx" ON "manual_payment_submission" USING btree ("status");--> statement-breakpoint
CREATE INDEX "manual_payment_utr_idx" ON "manual_payment_submission" USING btree ("utr_reference");--> statement-breakpoint
CREATE INDEX "order_buyer_gstin_idx" ON "order" USING btree ("buyer_gstin");