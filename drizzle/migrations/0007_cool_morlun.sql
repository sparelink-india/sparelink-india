ALTER TABLE "part" ADD COLUMN "category_id" text;--> statement-breakpoint
ALTER TABLE "part" ADD CONSTRAINT "part_category_id_part_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."part_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "part_category_idx" ON "part" USING btree ("category_id");