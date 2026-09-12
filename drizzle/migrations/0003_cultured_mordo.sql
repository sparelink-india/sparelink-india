CREATE TABLE "part" (
	"id" text PRIMARY KEY NOT NULL,
	"part_number" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"brand" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "part_part_number_unique" UNIQUE("part_number")
);
--> statement-breakpoint
CREATE INDEX "part_brand_idx" ON "part" USING btree ("brand");