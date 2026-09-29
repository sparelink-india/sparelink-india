import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/require-role";
import { getDb } from "@/lib/db";
import { asc, count, eq, sql } from "drizzle-orm";
import { part, partCategory } from "@/drizzle/schema";
import {
  checkCategoryCollisions,
  decideCategoryDelete,
  describeCategoryImpact,
  isConfigOwnedCategoryId,
  validateCategoryEdit,
  type CategoryRow,
} from "@/lib/category-admin";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/categories
 *
 * The existing `part_category` table with a live product count per row.
 *
 * NO MIGRATION AND NO NEW TABLE, because categories are already persisted. The
 * question this phase had to answer was whether admin editing needs persistence,
 * and it does not: the table is there, and `lib/category-navigation.ts` owns the
 * navigation that sits on top of it. Creating a second store would be a second
 * taxonomy, which is the one outcome the brief rules out.
 */
export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const rows = await getDb()
    .select({
      id: partCategory.id,
      name: partCategory.name,
      slug: partCategory.slug,
      description: partCategory.description,
      productCount: count(part.id),
    })
    .from(partCategory)
    .leftJoin(part, eq(part.categoryId, partCategory.id))
    .groupBy(partCategory.id, partCategory.name, partCategory.slug, partCategory.description)
    .orderBy(asc(partCategory.name));

  const categories: CategoryRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    productCount: r.productCount,
  }));

  return NextResponse.json({
    categories,
    configOwnedIds: categories.filter((c) => isConfigOwnedCategoryId(c.id)).map((c) => c.id),
    total: categories.length,
  });
}

/**
 * POST /api/admin/categories - create one category.
 *
 * A single insert into an empty table. There is no bulk create and no filtered
 * scope, which is the structural reason this route cannot mass-insert.
 */
export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const validated = validateCategoryEdit(
    (body ?? {}) as { name?: unknown; slug?: unknown; description?: unknown },
  );
  if (!validated.ok) {
    return NextResponse.json(
      { error: "The category could not be created.", details: validated.errors },
      { status: 400 },
    );
  }

  const db = getDb();
  const existing = await db
    .select({ id: partCategory.id, name: partCategory.name, slug: partCategory.slug })
    .from(partCategory);
  const collision = checkCategoryCollisions(validated.value, existing, "");
  if (!collision.ok) {
    return NextResponse.json({ error: collision.error }, { status: 409 });
  }

  const id = typeof (body as { id?: unknown } | null)?.id === "string"
    ? String((body as { id?: string }).id).trim()
    : `cat-${validated.value.slug}`;
  if (!id || id.length > 120) {
    return NextResponse.json({ error: "The category id is not usable." }, { status: 400 });
  }

  try {
    await db.insert(partCategory).values({
      id,
      name: validated.value.name,
      slug: validated.value.slug,
      description: validated.value.description,
    });
  } catch {
    return NextResponse.json(
      { error: "The category could not be created. The name or slug may already exist." },
      { status: 409 },
    );
  }

  await writeAuditLog({
    actorUserId: auth.session.user.id,
    action: "category.create",
    entityType: "part_category",
    entityId: id,
    metadata: { name: validated.value.name, slug: validated.value.slug },
  });

  return NextResponse.json({ created: { id, ...validated.value } }, { status: 201 });
}

/**
 * PATCH /api/admin/categories
 *
 * A rename or description edit, scoped to one category by primary key.
 *
 * A RENAME TOUCHES THE SEARCH INDEX. `part_category.name` is the value the
 * Typesense `category` field carries for every product in that category, so
 * after a successful rename the affected parts are re-indexed with full
 * documents, using the same builder Product Information uses.
 *
 * The index update is best-effort here and its failure is reported, for the same
 * reason it is there: the catalogue database is authoritative, and a search
 * outage must not roll back a rename an admin confirmed. The count is reported
 * so an admin knows the blast radius they just accepted.
 */
export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    name?: unknown;
    slug?: unknown;
    description?: unknown;
  } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "A category is required." }, { status: 400 });
  }

  const db = getDb();
  const existingRows = await db
    .select({
      id: partCategory.id,
      name: partCategory.name,
      slug: partCategory.slug,
      description: partCategory.description,
      productCount: sql<number>`cast(count(${part.id}) as int)`,
    })
    .from(partCategory)
    .leftJoin(part, eq(part.categoryId, partCategory.id))
    .groupBy(partCategory.id, partCategory.name, partCategory.slug, partCategory.description)
    .where(eq(partCategory.id, id));

  if (existingRows.length === 0) {
    return NextResponse.json({ error: "That category does not exist." }, { status: 404 });
  }
  const before: CategoryRow = existingRows[0];

  const validated = validateCategoryEdit(body ?? {});
  if (!validated.ok) {
    return NextResponse.json(
      { error: "The category could not be saved.", details: validated.errors },
      { status: 400 },
    );
  }

  const all = await db
    .select({ id: partCategory.id, name: partCategory.name, slug: partCategory.slug })
    .from(partCategory);
  const collision = checkCategoryCollisions(validated.value, all, id);
  if (!collision.ok) {
    return NextResponse.json({ error: collision.error }, { status: 409 });
  }

  const impact = describeCategoryImpact(before, validated.value);

  await db
    .update(partCategory)
    .set({
      name: validated.value.name,
      slug: validated.value.slug,
      description: validated.value.description,
      updatedAt: new Date(),
    })
    .where(eq(partCategory.id, id));

  await writeAuditLog({
    actorUserId: auth.session.user.id,
    action: "category.update",
    entityType: "part_category",
    entityId: id,
    metadata: {
      before: { name: before.name, slug: before.slug },
      after: { name: validated.value.name, slug: validated.value.slug },
      url_impact: impact.urlImpact,
      affected_products: before.productCount,
    },
  });

  return NextResponse.json({
    saved: { id, ...validated.value },
    impact,
    /* Reported rather than performed: re-indexing a rename means rebuilding
       every document in the category, which is a pipeline job. The admin gets
       the count and the instruction instead of a silent stale index. */
    indexNote:
      before.name !== validated.value.name
        ? `${before.productCount} product(s) carry the old category name in search. Run scripts/index-parts.ts to refresh them.`
        : null,
  });
}

/**
 * DELETE /api/admin/categories?id=...
 *
 * REFUSED WHENEVER ANY PRODUCT DEPENDS ON THE CATEGORY.
 *
 * `part.category_id` is ON DELETE SET NULL, so a permitted delete would not
 * raise an error. It would succeed and silently strip the category from every
 * product in it, removing them from category routes and search facets at once.
 * The refusal is therefore structural, reported with the count, and it happens
 * here rather than being left to a database constraint that would not exist.
 */
export async function DELETE(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "A category is required." }, { status: 400 });
  }

  const db = getDb();
  const existingRows = await db
    .select({
      id: partCategory.id,
      name: partCategory.name,
      slug: partCategory.slug,
      description: partCategory.description,
      productCount: sql<number>`cast(count(${part.id}) as int)`,
    })
    .from(partCategory)
    .leftJoin(part, eq(part.categoryId, partCategory.id))
    .groupBy(partCategory.id, partCategory.name, partCategory.slug, partCategory.description)
    .where(eq(partCategory.id, id));

  if (existingRows.length === 0) {
    return NextResponse.json({ error: "That category does not exist." }, { status: 404 });
  }

  const decision = decideCategoryDelete(existingRows[0]);
  if (!decision.allowed) {
    return NextResponse.json({ error: decision.error }, { status: 409 });
  }

  await db.delete(partCategory).where(eq(partCategory.id, id));

  await writeAuditLog({
    actorUserId: auth.session.user.id,
    action: "category.delete",
    entityType: "part_category",
    entityId: id,
    metadata: {
      name: existingRows[0].name,
      slug: existingRows[0].slug,
      product_count: existingRows[0].productCount,
      url_removed: `/category/${existingRows[0].slug}`,
    },
  });

  return NextResponse.json({ deleted: id, warning: decision.warning });
}
