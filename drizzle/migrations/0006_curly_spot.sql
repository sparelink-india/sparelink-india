CREATE TABLE "part_category" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "part_category_name_unique" UNIQUE("name"),
	CONSTRAINT "part_category_slug_unique" UNIQUE("slug")
);
