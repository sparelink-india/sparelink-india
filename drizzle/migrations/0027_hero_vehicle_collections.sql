-- Hero vehicle collections: the curated product set behind each hero vehicle
-- class hotspot.
--
-- A SEPARATE SYSTEM FROM VEHICLE COMPATIBILITY, and this is the whole point of
-- the file. A hero class is a marketing label on a picture ("Earthmover"), not a
-- vehicle row, so there is nothing to join against `vehicle` and nothing to put
-- in `part_vehicle_compatibility`. Curating a heavy-truck product set must never
-- assert that a part fits a specific vehicle, so the two tables share no
-- foreign key and no code path. `part_vehicle_compatibility` is the authority
-- for fitment; this table is the authority for what a marketing click shows.
--
-- ADDITIVE ONLY. Two new tables, two new indexes, no ALTER, no DROP, no
-- existing row touched. A storefront that ignores these tables behaves exactly
-- as it does today.
--
-- The hero has EIGHT class slots, not seven: Passenger Vehicle is drawn twice
-- (the red SUV and the white saloon) and each needs its own curated set, which
-- is why the slot is part of the primary key rather than a column.
--
-- `slot` is constrained to the eight approved ids by a CHECK rather than left
-- free text, so a typo becomes a rejected insert instead of a dead collection
-- nothing renders.
--
-- PLAIN TRANSACTIONAL INDEX, NOT CONCURRENTLY. The Drizzle migration runner
-- wraps each migration in a single transaction, and Postgres rejects CREATE
-- INDEX CONCURRENTLY inside one. Both tables are empty at creation, so the
-- build is instantaneous and the brief lock is not a concern.
CREATE TABLE IF NOT EXISTS "hero_vehicle_collection" (
	"slot" text PRIMARY KEY NOT NULL CHECK ("slot" IN ('heavy-commercial-vehicle', 'light-commercial-vehicle', 'passenger-red-suv', 'passenger-white-saloon', 'agriculture', 'earthmover', 'motorcycle', 'scooter')),
	"label" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hero_vehicle_collection_enabled_order_idx" ON "hero_vehicle_collection" USING btree ("is_enabled","display_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hero_vehicle_collection_item" (
	"slot" text NOT NULL,
	"part_id" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hero_vehicle_collection_item_slot_fkey" FOREIGN KEY ("slot") REFERENCES "hero_vehicle_collection"("slot") ON DELETE cascade,
	CONSTRAINT "hero_vehicle_collection_item_part_fkey" FOREIGN KEY ("part_id") REFERENCES "part"("id") ON DELETE cascade,
	CONSTRAINT "hero_vehicle_collection_item_pkey" PRIMARY KEY ("slot","part_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hero_vehicle_collection_item_order_idx" ON "hero_vehicle_collection_item" USING btree ("slot","display_order");
