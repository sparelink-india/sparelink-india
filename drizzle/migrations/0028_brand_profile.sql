-- Brand presentation overrides.
--
-- WHY A TABLE AT ALL, WHEN THE BRIEF SAYS NOT TO INVENT PERSISTENCE.
--
-- Brand MEMBERSHIP is config: PUBLIC_BRANDS in lib/public-brands.ts is the
-- authority for which nine brands appear on /brands and in the homepage grid.
-- That is not changed here and cannot be changed from the admin screen. An
-- overlay row whose id is not in the registry is discarded by lib/brand-admin.ts
-- rather than rendered, so this table can never introduce a tenth brand.
--
-- What DOES need persistence is the admin's edits to presentation: the display
-- name, an approved description, a logo, the relationship label, the search
-- query, ordering and visibility. Vercel's filesystem is read-only at runtime,
-- so a config registry cannot be edited at all; the database is the only
-- writable store, and an editor that cannot persist is not an editor.
--
-- NO FOREIGN KEY, AND THAT IS DELIBERATE. The registry is a code constant, not a
-- table, so there is nothing to reference. Inventing an anchor table to hang a
-- foreign key off would be a second brand taxonomy, which is the one outcome
-- this phase must avoid, and the migration would fail against production
-- because that table does not exist there.
--
-- Instead membership is enforced by a CHECK constraint listing the nine approved
-- ids. That is the same guarantee a foreign key would give, it cannot be
-- satisfied by inventing rows, and it fails loudly in the database rather than
-- relying on application code alone.
--
-- THIS IS AN OVERLAY, NOT A COPY. Every column is nullable and there are no rows
-- yet, so every brand renders from its registry value exactly as it does today.
-- An absent column means "use the registry"; an explicit NULL means "clear this
-- field". The registry is never written to, so there is no risk of the two
-- drifting into a state where the config and the table disagree about which
-- brands exist.
--
-- NOTHING HERE TOUCHES part.brand. That is free text on 9,017 catalogue rows and
-- is what Typesense facets on. Rewriting it to match a display name would break
-- search facets and any listing whose brand string differs by a space, and could
-- not be undone from an audit record. Brand presentation and catalogue data are
-- kept separate on purpose, and there is no reference from here to `part`.
--
-- ADDITIVE ONLY. One new table, one new index, no ALTER, no DROP, no existing
-- row touched. A build that never reads this table behaves identically.
CREATE TABLE IF NOT EXISTS "brand_profile" (
	"id" text PRIMARY KEY NOT NULL CHECK ("id" IN ('01', 'meko', 'starlinks', '03', 'pensol', 'superseal', 'menon-brakes', 'shivaji-industries', 'akar')),
	"display_name" text,
	"description" text,
	"logo_url" text,
	"relationship" text CHECK ("relationship" IS NULL OR "relationship" IN ('distributor', 'trader')),
	"search_query" text,
	"display_order" integer,
	"is_visible" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brand_profile_visible_order_idx" ON "brand_profile" USING btree ("is_visible","display_order");
