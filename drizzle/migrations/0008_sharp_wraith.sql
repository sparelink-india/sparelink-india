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
ALTER TABLE "dealer" ADD CONSTRAINT "dealer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dealer_user_idx" ON "dealer" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dealer_gstin_idx" ON "dealer" USING btree ("gstin");