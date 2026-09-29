import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/require-role";
import { getDb } from "@/lib/db";
import { eq } from "drizzle-orm";
import { brandProfile } from "@/drizzle/schema";
import { readResolvedBrands } from "@/lib/brand-profile";
import { PUBLIC_BRANDS } from "@/lib/public-brands";
import { PUBLIC_BRAND_IDS, validateBrandOverrides } from "@/lib/brand-admin";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/brands
 *
 * The registry merged with whatever overrides exist, so an admin can see which
 * values come from code and which they have changed.
 *
 * The table is read defensively. It has no rows in a fresh deployment and the
 * migration is additive, so an empty or missing table must degrade to "show the
 * registry" rather than take the admin screen down.
 */
export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const { brands, ignoredOverlayIds } = await readResolvedBrands();

  return NextResponse.json({
    brands,
    registryIds: PUBLIC_BRAND_IDS,
    registryNames: PUBLIC_BRANDS.map((b) => ({ id: b.id, name: b.name })),
    ignoredOverlayIds,
  });
}

/**
 * PUT /api/admin/brands - set a brand's overrides.
 *
 * UPSERT, SCOPED BY THE REGISTRY ID. Membership cannot be changed here: an id
 * that is not one of the nine is rejected before the database is touched, and
 * the table's CHECK constraint enforces the same set independently.
 *
 * THIS NEVER WRITES part.brand. A brand's display name and the catalogue's
 * brand value are separate on purpose, so a presentation change cannot rewrite
 * 9,017 rows or disturb a search facet.
 */
export async function PUT(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "A brand is required." }, { status: 400 });
  }
  if (!PUBLIC_BRAND_IDS.includes(id)) {
    return NextResponse.json(
      {
        error:
          "That brand is not in the public registry. Membership is defined in code and cannot be added here.",
      },
      { status: 404 },
    );
  }

  const validated = validateBrandOverrides(body ?? {});
  if (!validated.ok) {
    return NextResponse.json(
      { error: "The brand could not be saved.", details: validated.errors },
      { status: 400 },
    );
  }

  try {
    await getDb()
      .insert(brandProfile)
      .values({
        id,
        displayName: validated.value.displayName ?? null,
        description: validated.value.description ?? null,
        logoUrl: validated.value.logoUrl ?? null,
        relationship: validated.value.relationship ?? null,
        searchQuery: validated.value.searchQuery ?? null,
        displayOrder: validated.value.displayOrder ?? null,
        isVisible: validated.value.isVisible ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: brandProfile.id,
        set: {
          displayName: validated.value.displayName ?? null,
          description: validated.value.description ?? null,
          logoUrl: validated.value.logoUrl ?? null,
          relationship: validated.value.relationship ?? null,
          searchQuery: validated.value.searchQuery ?? null,
          displayOrder: validated.value.displayOrder ?? null,
          isVisible: validated.value.isVisible ?? null,
          updatedAt: new Date(),
        },
      });
  } catch {
    return NextResponse.json(
      { error: "The brand could not be saved." },
      { status: 500 },
    );
  }

  await writeAuditLog({
    actorUserId: auth.session.user.id,
    action: "brand.update",
    entityType: "brand_profile",
    entityId: id,
    metadata: {
      overridden_fields: Object.keys(validated.value),
      note: "Presentation override only. part.brand was not modified.",
    },
  });

  const { brands } = await readResolvedBrands();
  return NextResponse.json({
    saved: { id, ...validated.value },
    brand: brands.find((b) => b.id === id) ?? null,
  });
}

/**
 * DELETE /api/admin/brands?id=...
 *
 * Removing the row IS the reset, because absent means "use the registry" rather
 * than storing a copy of the registry value. So there is no soft-delete column
 * and no way to end up with a half-restored brand.
 */
export async function DELETE(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "A brand is required." }, { status: 400 });
  }
  if (!PUBLIC_BRAND_IDS.includes(id)) {
    return NextResponse.json({ error: "That brand is not in the registry." }, { status: 404 });
  }

  const deleted = await getDb()
    .delete(brandProfile)
    .where(eq(brandProfile.id, id))
    .returning({ id: brandProfile.id });

  if (deleted.length === 0) {
    /* Not an error: the brand is already at its registry values, which is the
       state the caller asked for. */
    return NextResponse.json({ reset: { id, changed: false } });
  }

  await writeAuditLog({
    actorUserId: auth.session.user.id,
    action: "brand.reset",
    entityType: "brand_profile",
    entityId: id,
    metadata: { note: "Overrides removed; registry values restored." },
  });

  const registry = PUBLIC_BRANDS.find((b) => b.id === id);
  return NextResponse.json({
    reset: { id, changed: true },
    registryName: registry?.name ?? null,
  });
}
