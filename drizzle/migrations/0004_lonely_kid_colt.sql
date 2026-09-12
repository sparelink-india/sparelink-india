CREATE TABLE "vehicle" (
	"id" text PRIMARY KEY NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"variant" text,
	"year_from" timestamp,
	"year_to" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "vehicle_make_idx" ON "vehicle" USING btree ("make");--> statement-breakpoint
CREATE INDEX "vehicle_model_idx" ON "vehicle" USING btree ("model");