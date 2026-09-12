CREATE TABLE "part_vehicle_compatibility" (
	"id" text PRIMARY KEY NOT NULL,
	"part_id" text NOT NULL,
	"vehicle_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "part_vehicle_compatibility" ADD CONSTRAINT "part_vehicle_compatibility_part_id_part_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."part"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_vehicle_compatibility" ADD CONSTRAINT "part_vehicle_compatibility_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "part_vehicle_compatibility_part_idx" ON "part_vehicle_compatibility" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "part_vehicle_compatibility_vehicle_idx" ON "part_vehicle_compatibility" USING btree ("vehicle_id");