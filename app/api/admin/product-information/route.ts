import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/require-role";
import { getDb } from "@/lib/db";
import { eq } from "drizzle-orm";
import { part, partCategory, partVehicleCompatibility } from "@/drizzle/schema";
import { partNumberSearchText } from "@/lib/search-intent";
import {
  EDITABLE_PRODUCT_FIELDS,
  REFUSED_PRODUCT_FIELDS,
  buildProductSearchDocument,
  buildSyncFailureAudit,
  failedSyncState,
  isEmptyProductEdit,
  validateProductEdit,
  type ProductSyncState,
} from "@/lib/product-information";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/product-information?partId=...
 *
 * The current authoritative values for ONE part, including the fields this
 * screen refuses to edit, so an admin can see that price and stock exist and
 * where they are managed from rather than wondering why they are not here.
 */
export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const partId = new URL(request.url).searchParams.get("partId")?.trim();
  if (!partId) {
    return NextResponse.json({ error: "A product is required." }, { status: 400 });
  }

  const db = getDb();
  const rows = await db
    .select({
      id: part.id,
      partNumber: part.partNumber,
      name: part.name,
      description: part.description,
      brand: part.brand,
      categoryId: part.categoryId,
      categoryName: partCategory.name,
      oemNumber: part.oemNumber,
      alternatePartNumbers: part.alternatePartNumbers,
      barcode: part.barcode,
      productType: part.productType,
      warrantyMonths: part.warrantyMonths,
      specifications: part.specifications,
      seoTitle: part.seoTitle,
      seoDescription: part.seoDescription,
      isPublished: part.isPublished,
      approvalStatus: part.approvalStatus,
    })
    .from(part)
    .leftJoin(partCategory, eq(part.categoryId, partCategory.id))
    .where(eq(part.id, partId))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "That product does not exist." }, { status: 404 });
  }

  /* Fitment is READ here so the editor can tell an admin "these vehicles come
     from Vehicle Compatibility" with the actual list. It is never written. */
  const fitment = await db
    .select({ vehicleId: partVehicleCompatibility.vehicleId })
    .from(partVehicleCompatibility)
    .where(eq(partVehicleCompatibility.partId, partId));

  return NextResponse.json({
    product: rows[0],
    fitment: fitment.map((r) => r.vehicleId),
    editableFields: EDITABLE_PRODUCT_FIELDS,
    refusedFields: REFUSED_PRODUCT_FIELDS,
  });
}

/**
 * PATCH /api/admin/product-information
 *
 * ORDER OF OPERATIONS, and each step is load-bearing:
 *
 *   1. authenticate, BEFORE any database work
 *   2. resolve the part
 *   3. validate: an unknown or refused field fails here, so a pricePaise can
 *      never reach a query builder
 *   4. write to `part` only, scoped by an exact primary key
 *   5. commit
 *   6. update the search index
 *   7. audit BOTH outcomes, including a failed sync
 *
 * THE DATABASE IS AUTHORITATIVE AND IS NOT ROLLED BACK IF THE INDEX FAILS. A
 * Typesense timeout must not undo a product edit an admin confirmed. Instead the
 * failure is audited as retryable and returned, so it is visible rather than
 * silent. That is the compatibility sync's established behaviour, reused here
 * rather than reinvented.
 *
 * If the part is unpublished by this edit, the existing document is DELETED
 * rather than upserted, matching `scripts/index-parts.ts`, which skips such
 * parts entirely.
 */
export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "The request body could not be read." }, { status: 400 });
  }

  const partId = typeof payload.partId === "string" ? payload.partId.trim() : "";
  if (!partId) {
    return NextResponse.json({ error: "A product is required." }, { status: 400 });
  }

  const db = getDb();
  const existing = await db
    .select({
      id: part.id,
      partNumber: part.partNumber,
      isPublished: part.isPublished,
      approvalStatus: part.approvalStatus,
    })
    .from(part)
    .where(eq(part.id, partId))
    .limit(1);

  if (existing.length === 0) {
    return NextResponse.json({ error: "That product does not exist." }, { status: 404 });
  }

  /* The part id is the route's target, not an editable field. It is removed from
     the change set so a client posting `partId` cannot have it validated as an
     unknown field, and so it can never reach the UPDATE as a column. */
  const changes: Record<string, unknown> = { ...payload };
  delete changes.partId;
  const validated = validateProductEdit(changes);
  if (!validated.ok) {
    return NextResponse.json(
      { error: "Some fields cannot be edited here.", details: validated.errors },
      { status: 400 },
    );
  }
  if (isEmptyProductEdit(validated.value)) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }

  const changedFields = Object.keys(validated.value);

  /* Scoped by primary key, one row. There is no filtered or bulk scope in this
     route at all, which is the structural reason it cannot mass-update the
     catalogue: there is no code path that would. */
  const updated = await db
    .update(part)
    .set({ ...validated.value, updatedAt: new Date() })
    .where(eq(part.id, partId))
    .returning({ id: part.id });

  if (updated.length === 0) {
    return NextResponse.json(
      { error: "The product could not be updated." },
      { status: 500 },
    );
  }

  /* Re-read AFTER the write, so the document reflects what is now committed
     rather than what was there before. The category name and the vehicle set
     both have to be read fresh: an edit does not change them, but reading them
     stale would rebuild a document that contradicts the database. */
  const fresh = await db
    .select({
      id: part.id,
      partNumber: part.partNumber,
      name: part.name,
      description: part.description,
      brand: part.brand,
      isPublished: part.isPublished,
      approvalStatus: part.approvalStatus,
      categoryName: partCategory.name,
    })
    .from(part)
    .leftJoin(partCategory, eq(part.categoryId, partCategory.id))
    .where(eq(part.id, partId))
    .limit(1);

  const vehicleRows = await db
    .select({ vehicleId: partVehicleCompatibility.vehicleId })
    .from(partVehicleCompatibility)
    .where(eq(partVehicleCompatibility.partId, partId));

  const decision = buildProductSearchDocument(
    {
      id: fresh[0].id,
      partNumber: fresh[0].partNumber,
      name: fresh[0].name,
      description: fresh[0].description,
      brand: fresh[0].brand,
      categoryName: fresh[0].categoryName,
      isPublished: fresh[0].isPublished,
      approvalStatus: fresh[0].approvalStatus,
      vehicleIds: vehicleRows.map((r) => r.vehicleId),
    },
    partNumberSearchText,
  );

  const sync = await syncProductDocument(decision, partId);

  await writeAuditLog({
    actorUserId: auth.session.user.id,
    action: "product_information.update",
    entityType: "part",
    entityId: partId,
    metadata: {
      changed_fields: changedFields,
      was_published: existing[0].isPublished,
      is_published: fresh[0].isPublished,
      index_sync: sync.ok ? sync.action : "failed",
      index_error: sync.ok ? null : sync.error,
    },
  });

  if (!sync.ok) {
    /* Committed, but the index did not follow. Say so, and say it is retryable,
       rather than returning a clean success that hides a stale search result. */
    await writeAuditLog({
      actorUserId: auth.session.user.id,
      action: "product_information.typesense_sync_failed",
      entityType: "part",
      entityId: partId,
      metadata: buildSyncFailureAudit(
        partId,
        sync.action,
        sync.error,
        changedFields,
      ) as Record<string, unknown>,
    });

    return NextResponse.json(
      {
        saved: true,
        changedFields,
        syncWarning:
          "The product was saved, but search indexing did not complete. The catalogue database is correct; run the reindex for this part.",
        sync,
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ saved: true, changedFields, sync });
}

/**
 * Push or remove one document.
 *
 * A full document with `action: "upsert"`, never a partial update. Every importer
 * in this repository does the same, and the compatibility incident showed what
 * goes wrong otherwise: a partial update does not fail loudly on missing fields,
 * it silently drops the fields it did not name.
 */
async function syncProductDocument(
  decision: ReturnType<typeof buildProductSearchDocument>,
  partId: string,
): Promise<ProductSyncState> {
  /* The named Client, not the default export. The default is the module
     namespace in this version, which is not constructable; index-parts.ts uses
     `Typesense.Client` and this matches it. */
  const Typesense = (await import("typesense")).default;

  const apiKey = process.env.TYPESENSE_API_KEY;
  const host = process.env.TYPESENSE_HOST;
  if (!apiKey || !host) {
    return failedSyncState("upsert", partId, "Search is not configured in this environment.");
  }

  const client = new Typesense.Client({
    nodes: [{ host, port: Number(process.env.TYPESENSE_PORT ?? "443"), protocol: "https" }],
    apiKey,
    connectionTimeoutSeconds: 10,
  });

  const collection = client.collections("parts").documents();

  try {
    if (!decision.indexed) {
      /* Now-hidden: remove the document rather than upsert a draft. The canonical
       importer skips these parts, so leaving the document would make this part
       searchable in a way the indexer would never produce.

       Deleted by filter, because that is this client's API. `ignore_not_found`
       matters: unpublishing a part that was never indexed is a success, not an
       error, and without it an admin would see a failure for a no-op. */
      await collection.delete({
        filter_by: `id:=\`${partId.replace(/`/g, "")}\``,
        ignore_not_found: true,
      });
      return { ok: true, action: "delete", documentId: partId };
    }
    await collection.upsert(decision.document);
    return { ok: true, action: "upsert", documentId: partId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failedSyncState(decision.indexed ? "upsert" : "delete", partId, message);
  }
}
