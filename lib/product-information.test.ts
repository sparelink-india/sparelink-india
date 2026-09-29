import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { partNumberSearchText } from "./search-intent";
import {
  EDITABLE_PRODUCT_FIELDS,
  PRODUCT_TYPES,
  REFUSED_PRODUCT_FIELDS,
  REQUIRED_PRODUCT_DOCUMENT_FIELDS,
  buildProductSearchDocument,
  buildSyncFailureAudit,
  failedSyncState,
  isEmptyProductEdit,
  validateProductEdit,
  type ProductDocumentSource,
} from "./product-information";

function source(over: Partial<ProductDocumentSource> = {}): ProductDocumentSource {
  return {
    id: "5984",
    partNumber: "5984",
    name: "Wiper Blade",
    description: "Universal wiper blade",
    brand: "MEKO",
    categoryName: "Wiper Systems",
    isPublished: true,
    approvalStatus: "APPROVED",
    vehicleIds: ["vehicle-maruti-swift"],
    ...over,
  };
}

/* ------------------------------------------------------ field ownership */

describe("only part-owned fields are editable", () => {
  it("edits the 1:1 descriptive fields only", () => {
    assert.deepEqual([...EDITABLE_PRODUCT_FIELDS].sort(), [
      "alternatePartNumbers",
      "barcode",
      "brand",
      "description",
      "isPublished",
      "name",
      "oemNumber",
      "productType",
      "seoDescription",
      "seoTitle",
      "warrantyMonths",
    ]);
  });

  it("refuses firm-coupled pricing with a reason an admin can act on", () => {
    for (const field of ["pricePaise", "mrpPaise", "stock", "reservedQuantity", "gst", "vehicleIds"]) {
      assert.ok(REFUSED_PRODUCT_FIELDS[field as keyof typeof REFUSED_PRODUCT_FIELDS], field);
    }
    const r = validateProductEdit({ pricePaise: 100 } as never);
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.errors[0].error : "", /pricing workflow/);
  });

  it("refuses fitment, so this screen cannot reach compatibility", () => {
    const r = validateProductEdit({ vehicleIds: ["x"] } as never);
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.errors[0].error : "", /Vehicle Compatibility/);
  });

  it("refuses an unknown key rather than ignoring it", () => {
    /* Silently dropping a pricePaise would be worse than failing: the admin
       would believe they had changed the price. */
    const r = validateProductEdit({ nonesuch: 1 } as never);
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.errors[0].error, "Unknown field.");
  });

  it("has no GST field, because GST is computed at render", () => {
    assert.equal(EDITABLE_PRODUCT_FIELDS.includes("gst" as never), false);
    assert.match(REFUSED_PRODUCT_FIELDS.gst, /computed at render/);
  });
});

describe("validation", () => {
  it("keeps valid values", () => {
    const r = validateProductEdit({
      name: "  Wiper Blade  ",
      brand: "MEKO",
      warrantyMonths: 12,
      isPublished: false,
      productType: "genuine",
    });
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.value.name, "Wiper Blade", "trimmed");
    assert.equal(r.ok && r.value.warrantyMonths, 12);
    assert.equal(r.ok && r.value.isPublished, false);
    assert.equal(r.ok && r.value.productType, "genuine");
  });

  it("distinguishes 'leave alone' from 'clear'", () => {
    const keep = validateProductEdit({});
    assert.equal(keep.ok, true);
    assert.equal(keep.ok && isEmptyProductEdit(keep.value), true, "an absent field is not a change");

    const clear = validateProductEdit({ brand: "" });
    assert.equal(clear.ok && clear.value.brand, null, "an empty string clears");
  });

  it("rejects an out-of-range or fractional warranty", () => {
    for (const v of [-1, 601, 1.5, "abc", Number.NaN]) {
      const r = validateProductEdit({ warrantyMonths: v } as never);
      assert.equal(r.ok, false, `${String(v)} must be refused`);
    }
    assert.equal(validateProductEdit({ warrantyMonths: 0 }).ok, true);
    assert.equal(validateProductEdit({ warrantyMonths: null }).ok, true);
  });

  it("rejects a product type outside the closed set", () => {
    for (const v of ["PLUSH", "", "unknown"]) {
      const r = validateProductEdit({ productType: v });
      assert.equal(r.ok, false, `${v} must be refused`);
    }
    for (const v of PRODUCT_TYPES) {
      assert.equal(validateProductEdit({ productType: v }).ok, true, `${v} is valid`);
    }
  });

  it("rejects over-long text and reports which field", () => {
    const r = validateProductEdit({ name: "x".repeat(301) });
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.errors[0].field, "name");
    assert.match(r.ok === false ? r.errors[0].error : "", /300 characters or fewer/);
  });

  it("rejects a non-boolean isPublished", () => {
    for (const v of ["true", 1, null]) {
      const r = validateProductEdit({ isPublished: v } as never);
      assert.equal(r.ok, false, `${String(v)} must be refused`);
    }
  });

  it("collects several errors rather than stopping at the first", () => {
    const r = validateProductEdit({ name: "x".repeat(400), productType: "nope" });
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.errors.length, 2);
  });
});

/* ------------------------------------------------- the search document */

describe("the search document matches the canonical importer", () => {
  it("carries every required field, so Typesense cannot reject it", () => {
    /* The compatibility incident: a bare {id, vehicle_ids} was refused with
       HTTP 400 because part_number and name are required. */
    const decision = buildProductSearchDocument(source(), partNumberSearchText);
    assert.equal(decision.indexed, true);
    if (!decision.indexed) return;
    for (const field of REQUIRED_PRODUCT_DOCUMENT_FIELDS) {
      assert.ok(
        field in decision.document,
        `${field} must be present; a missing required field is an HTTP 400`,
      );
    }
    assert.equal(decision.document.part_number, "5984");
    assert.equal(decision.document.name, "Wiper Blade");
    assert.deepEqual(decision.document.vehicle_ids, ["vehicle-maruti-swift"]);
  });

  it("derives part_number_search with the shared function, not a second copy", () => {
    const decision = buildProductSearchDocument(
      source({ partNumber: "M-648" }),
      partNumberSearchText,
    );
    assert.equal(decision.indexed && decision.document.part_number_search, partNumberSearchText("M-648"));
  });

  it("keeps an empty authoritative vehicle set rather than omitting the field", () => {
    /* An empty set means "fits no vehicle". Omitting the key would leave the
       previous fitment in place in Typesense, which is a correctness bug. */
    const decision = buildProductSearchDocument(source({ vehicleIds: [] }), partNumberSearchText);
    assert.equal(decision.indexed, true);
    assert.ok(decision.indexed && Array.isArray(decision.document.vehicle_ids));
    assert.equal(decision.indexed && decision.document.vehicle_ids.length, 0);
  });

  it("coerces nulls to empty strings, as the importer does", () => {
    const decision = buildProductSearchDocument(
      source({ description: null, brand: null, categoryName: null }),
      partNumberSearchText,
    );
    assert.equal(decision.indexed && decision.document.description, "");
    assert.equal(decision.indexed && decision.document.brand, "");
    assert.equal(decision.indexed && decision.document.category, "");
  });

  it("refuses to index an unpublished or unapproved part", () => {
    const hidden = buildProductSearchDocument(source({ isPublished: false }), partNumberSearchText);
    assert.equal(hidden.indexed, false);
    assert.equal(hidden.indexed === false && hidden.reason, "unpublished");

    const draft = buildProductSearchDocument(source({ approvalStatus: "PENDING_ADMIN_APPROVAL" }), partNumberSearchText);
    assert.equal(draft.indexed, false);

    /* approvalStatus is nullable in the schema; a null must read as APPROVED,
       matching the importer's `|| "APPROVED"`. */
    const nulled = buildProductSearchDocument(source({ approvalStatus: null }), partNumberSearchText);
    assert.equal(nulled.indexed, true);
  });

  it("agrees with the canonical importer on which parts are indexed", async () => {
    /* The two must not diverge: a product this screen shows as live while the
       importer would drop it is exactly the class of bug that is invisible
       until someone searches for it. */
    const src = readFileSync("scripts/index-parts.ts", "utf8");
    for (const rule of [
      /isPublished !== true \|\| approval !== "APPROVED"/,
      /vehicle_ids: compatibility\.map/,
      /action: "upsert"/,
      /part_number_search: partNumberSearchText/,
    ]) {
      assert.ok(rule.test(src), `index-parts.ts must still contain ${rule}`);
    }
  });
});

/* -------------------------------------------------------- sync outcome */

describe("a failed index sync is visible and retryable, never silent", () => {
  it("never rolls back the database by reporting the failure as retryable", () => {
    const state = failedSyncState("upsert", "5984", "Typesense timeout");
    assert.equal(state.ok, false);
    assert.equal(state.retryable, true);
    assert.equal(state.documentId, "5984");
  });

  it("audits the failure the way the compatibility sync does", () => {
    const meta = buildSyncFailureAudit("5984", "upsert", "timeout", ["name", "brand"]);
    assert.equal(meta.retryable, true);
    assert.equal(meta.part_id, "5984");
    assert.deepEqual(meta.changed_fields, ["name", "brand"]);
    assert.match(String(meta.note), /committed and authoritative/);
  });
});

describe("this screen cannot reach protected systems", () => {
  it("never writes compatibility, inventory or listings", () => {
    const src = readFileSync("lib/product-information.ts", "utf8");
    for (const forbidden of [
      "partVehicleCompatibility",
      "dealerListing",
      "inventory",
      "pricePaise:",
      "quantity:",
    ]) {
      assert.equal(
        src.includes(`insert(${forbidden}`),
        false,
        `must not insert into ${forbidden}`,
      );
    }
  });

  it("keeps a single document builder shared with the importer", () => {
    /* Two builders is how the required-field drift happened before. */
    const src = readFileSync("lib/product-information.ts", "utf8");
    assert.equal(
      /function buildProductSearchDocument/.test(src),
      true,
      "one named builder",
    );
    assert.equal(
      /partNumberSearch\s*\(\s*source\.partNumber\s*\)/.test(src),
      true,
      "the ranking function is injected, not reimplemented",
    );
  });
});
