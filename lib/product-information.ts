/**
 * Product information - field ownership, validation, and the search document.
 *
 * THIS MODULE DECIDES WHAT AN ADMIN IS ALLOWED TO EDIT, AND THE ANSWER COMES
 * FROM THE SCHEMA RATHER THAN FROM CONVENTION.
 *
 * A product's data is spread across three tables with three different
 * consequences for editing:
 *
 *   part            1:1, no firm coupling. name, description, brand, oemNumber,
 *                   alternatePartNumbers, barcode, productType, warrantyMonths,
 *                   seoTitle, seoDescription, isPublished. This is what a product
 *                   editor owns.
 *
 *   dealer_listing  one row per dealer AND firm. pricePaise, mrpPaise, sku,
 *                   status. EDITING A PRICE HERE IS A FIRM-SCOPED COMMERCIAL
 *                   DECISION. There are 9,014 of these against 9,017 parts, so
 *                   even a well-meant "update the price" touches thousands of
 *                   rows across Ambaji Traders, Hind Motors and India Sales.
 *                   Reachable from the pricing workflow, never from here.
 *
 *   inventory       one row per listing. quantity, reservedQuantity. These move
 *                   through stock transactions with row locking, order
 *                   reservations and cancellation restocks. A direct UPDATE
 *                   would bypass all of it and could hand out stock that is
 *                   already sold.
 *
 * THERE IS NO GST COLUMN. GST is computed at render from the listing price, so
 * it is not an editable field and is not offered here. Inventing one would put
 * a second source of truth for tax next to the real one.
 *
 * SEARCH DOCUMENT
 *
 * `scripts/index-parts.ts` is the canonical builder: it joins part to
 * part_category, reads vehicle_ids from part_vehicle_compatibility, skips
 * unpublished or unapproved parts, and imports with `action: "upsert"` -- a
 * FULL document, not a partial update. Every other importer in the repo does the
 * same.
 *
 * So this module reproduces that document exactly, reusing
 * `partNumberSearchText` from `lib/search-intent` rather than reimplementing it.
 * Every product edit sends all nine fields.
 *
 * The compatibility incident is the reason this is so emphatic. A document sent
 * as bare `{ id, vehicle_ids }` was rejected by Typesense with HTTP 400 because
 * `part_number` and `name` are required. A partial update would have avoided
 * that error and introduced a worse one: it would silently drop the fields it
 * did not name. So a full document, built by one shared builder, is the shape
 * that cannot fail that way.
 */

/* ------------------------------------------------------- field ownership */

export const EDITABLE_PRODUCT_FIELDS = [
  "name",
  "description",
  "brand",
  "oemNumber",
  "alternatePartNumbers",
  "barcode",
  "productType",
  "warrantyMonths",
  "seoTitle",
  "seoDescription",
  "isPublished",
] as const;

export type EditableProductField = (typeof EDITABLE_PRODUCT_FIELDS)[number];

export type ProductEditValues = Partial<Record<EditableProductField, unknown>>;

/**
 * The fields this module refuses to touch, with the reason an admin will see.
 *
 * Kept next to the editable list on purpose. A future change that reaches for
 * `dealer_listing` or `inventory` should have to delete one of these strings,
 * which is a deliberate act, rather than quietly widen the field list.
 */
export const REFUSED_PRODUCT_FIELDS = {
  pricePaise:
    "Price is per dealer listing and per firm. Change it in the pricing workflow, not on the product.",
  mrpPaise:
    "MRP is per dealer listing and per firm. Change it in the pricing workflow, not on the product.",
  stock:
    "Stock moves through stock transactions with reservations and cancellation restocks. Edit it in Inventory.",
  reservedQuantity:
    "Reserved stock is owned by open orders. It is released by cancellation, not edited.",
  gst:
    "GST is computed at render from the listing price. There is no GST field to edit.",
  vehicleIds:
    "Fitment lives in Vehicle Compatibility. This screen does not touch part_vehicle_compatibility.",
} as const;

export type RefusedProductField = keyof typeof REFUSED_PRODUCT_FIELDS;

/* ------------------------------------------------------------ validation */

/** productType is a closed set in the data, so it is closed here too. */
export const PRODUCT_TYPES = [
  "aftermarket",
  "genuine",
  "original",
  "oem",
  "refurbished",
  "remanufactured",
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

const LIMITS = {
  name: 300,
  description: 4000,
  brand: 120,
  oemNumber: 120,
  alternatePartNumbers: 1000,
  barcode: 80,
  seoTitle: 160,
  seoDescription: 320,
} as const;

export type ProductFieldError = { field: string; error: string };
export type ProductEditValidation =
  | { ok: true; value: Record<string, string | number | boolean | null> }
  | { ok: false; errors: ProductFieldError[] };

/**
 * Validate and normalise a partial product edit.
 *
 * An UNKNOWN KEY IS AN ERROR, not something to ignore. A form that posts
 * `pricePaise: 100` should fail loudly here, so the request never reaches a
 * query builder that might helpfully apply it to the wrong table.
 *
 * `undefined` means "leave alone". `null` means "clear this field", and is only
 * honoured for the optional text fields where clearing is meaningful.
 */
export function validateProductEdit(input: ProductEditValues): ProductEditValidation {
  const errors: ProductFieldError[] = [];
  const value: Record<string, string | number | boolean | null> = {};

  for (const key of Object.keys(input)) {
    if (
      !EDITABLE_PRODUCT_FIELDS.includes(key as EditableProductField) &&
      key in REFUSED_PRODUCT_FIELDS
    ) {
      errors.push({
        field: key,
        error: REFUSED_PRODUCT_FIELDS[key as RefusedProductField],
      });
    } else if (!EDITABLE_PRODUCT_FIELDS.includes(key as EditableProductField)) {
      errors.push({ field: key, error: "Unknown field." });
    }
  }

  for (const field of EDITABLE_PRODUCT_FIELDS) {
    if (!(field in input)) continue;
    const raw = input[field];
    if (raw === undefined) continue;

    if (field === "isPublished") {
      if (typeof raw !== "boolean") {
        errors.push({ field, error: "Must be true or false." });
      } else {
        value.isPublished = raw;
      }
      continue;
    }

    if (field === "warrantyMonths") {
      if (raw === null || raw === "") {
        value.warrantyMonths = null;
        continue;
      }
      const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
      if (!Number.isInteger(n) || n < 0 || n > 600) {
        errors.push({ field, error: "Must be a whole number of months between 0 and 600." });
      } else {
        value.warrantyMonths = n;
      }
      continue;
    }

    if (field === "productType") {
      const s = String(raw ?? "").trim().toLowerCase();
      if (!PRODUCT_TYPES.includes(s as ProductType)) {
        errors.push({
          field,
          error: `Must be one of: ${PRODUCT_TYPES.join(", ")}.`,
        });
      } else {
        value.productType = s;
      }
      continue;
    }

    // Remaining fields are text.
    if (typeof raw !== "string") {
      errors.push({ field, error: "Must be text." });
      continue;
    }
    const trimmed = raw.trim();
    const limit = LIMITS[field as keyof typeof LIMITS];
    if (trimmed.length > limit) {
      errors.push({ field, error: `Must be ${limit} characters or fewer.` });
      continue;
    }
    value[field] = trimmed === "" ? null : trimmed;
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value };
}

/** An edit that changes nothing is not worth a write or an audit record. */
export function isEmptyProductEdit(value: Record<string, unknown>): boolean {
  return Object.keys(value).length === 0;
}

/* ------------------------------------------------------ search document */

export type ProductSearchDocument = {
  id: string;
  part_number: string;
  part_number_search: string;
  name: string;
  description: string;
  brand: string;
  category: string;
  vehicle_ids: string[];
};

/**
 * Everything needed to build the document. Mirrors the SELECT in
 * `scripts/index-parts.ts` plus the compatibility read.
 */
export type ProductDocumentSource = {
  id: string;
  partNumber: string;
  name: string;
  description: string | null;
  brand: string | null;
  categoryName: string | null;
  isPublished: boolean;
  approvalStatus: string | null;
  vehicleIds: readonly string[];
};

export type ProductDocumentDecision =
  | { indexed: true; document: ProductSearchDocument }
  | { indexed: false; reason: "unpublished" | "unapproved" };

/**
 * Build the search document, or decide it must not be indexed.
 *
 * `scripts/index-parts.ts` skips unpublished and unapproved parts entirely, so
 * that suggest and autocomplete cannot leak a draft. This does the same, which
 * matters for a different reason: if an admin unpublishes a part, this returns
 * "do not index" and the caller DELETES the existing document instead of
 * upserting it. Upserting an unpublished part would keep it in the index and
 * only rely on the search route's visibility check to hide it, which is one
 * more thing that has to be right.
 *
 * `vehicleIds` must be the complete authoritative set from
 * `part_vehicle_compatibility`, including the empty set. An empty array is
 * correct and meaningful: it says "this part fits no vehicle", which is what a
 * product with no fitment rows actually means.
 */
export function buildProductSearchDocument(
  source: ProductDocumentSource,
  partNumberSearch: (partNumber: string) => string,
): ProductDocumentDecision {
  if (source.isPublished !== true) return { indexed: false, reason: "unpublished" };
  const approval = (source.approvalStatus ?? "APPROVED").toUpperCase();
  if (approval !== "APPROVED") return { indexed: false, reason: "unapproved" };

  return {
    indexed: true,
    document: {
      id: source.id,
      part_number: source.partNumber,
      /* Derived from the part number by the SAME function the canonical
         importer uses. Recomputing it here would be the second implementation
         of the ranking rule, and the two would drift. */
      part_number_search: partNumberSearch(source.partNumber),
      name: source.name,
      description: source.description ?? "",
      brand: source.brand ?? "",
      category: source.categoryName ?? "",
      vehicle_ids: [...source.vehicleIds],
    },
  };
}

/**
 * The required fields Typesense will reject a document for.
 *
 * Asserted by the test suite against the built document, so a future edit that
 * drops one of these fails a test rather than failing a search in production.
 */
export const REQUIRED_PRODUCT_DOCUMENT_FIELDS = [
  "id",
  "part_number",
  "part_number_search",
  "name",
  "description",
  "brand",
  "category",
  "vehicle_ids",
] as const;

/* ---------------------------------------------------------- sync outcome */

export type ProductSyncState =
  | { ok: true; action: "upsert" | "delete"; documentId: string }
  | { ok: false; action: "upsert" | "delete"; documentId: string; error: string; retryable: true };

/**
 * Postgres is authoritative; the index is a projection of it.
 *
 * A failed sync is therefore a VISIBLE, RETRYABLE inconsistency, never a silent
 * one, and never a reason to roll back a committed product edit. This mirrors
 * the compatibility sync exactly: audit the failure, name the documents, and
 * leave the reindex to a retry.
 *
 * `retryable: true` is not aspirational. The failure modes are transient (a
 * Typesense timeout, a 429) or a re-runnable operation over an unchanged row,
 * so a retry is the correct remedy rather than an investigation.
 */
export function failedSyncState(
  action: "upsert" | "delete",
  documentId: string,
  error: string,
): ProductSyncState {
  return { ok: false, action, documentId, error, retryable: true };
}

/** The audit metadata for a failed sync, matching the compatibility convention. */
export function buildSyncFailureAudit(
  partId: string,
  action: "upsert" | "delete",
  error: string,
  changedFields: readonly string[],
): Record<string, unknown> {
  return {
    part_id: partId,
    intended_action: action,
    error,
    retryable: true,
    changed_fields: [...changedFields],
    note: "Database change is committed and authoritative. Re-run the index for this part.",
  };
}
