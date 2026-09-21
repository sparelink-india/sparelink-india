import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateCiFetchCompleteness } from "./ci-sync/fetch-complete";
import {
  APPROVAL_STATUS,
  isCustomerVisibleProduct,
  omitSourceCommercialFields,
} from "./ci-sync/types";
import { isAllowedFirmId, SPARELINK_FIRMS } from "./firms";
import {
  CANCEL_RESTOCKABLE_STATUSES,
  shouldRestockOnStatusChange,
} from "./order-cancel-restock";
import { parseSearchIntent } from "./search-intent";
import { filterSearchPartsForCustomer } from "./search-safety";

describe("qa hardening — CI fetch completeness", () => {
  it("never treats pages>0 alone as a complete catalogue", () => {
    const result = evaluateCiFetchCompleteness({
      productsMapped: 10,
      total: 500,
      pagesFetched: 1,
      hitMaxPages: false,
      lastPageEmpty: false,
      hasMore: true,
    });
    assert.equal(result.fetchComplete, false);
    assert.match(String(result.errorSummary), /truncat|undercount/i);
  });

  it("marks complete when mapped count reaches claimed total", () => {
    const result = evaluateCiFetchCompleteness({
      productsMapped: 120,
      total: 120,
      pagesFetched: 1,
      hitMaxPages: false,
      lastPageEmpty: false,
      hasMore: false,
    });
    assert.equal(result.fetchComplete, true);
    assert.equal(result.errorSummary, null);
  });

  it("refuses completeness when max pages hit with remaining rows", () => {
    const result = evaluateCiFetchCompleteness({
      productsMapped: 24000,
      total: 30000,
      pagesFetched: 200,
      hitMaxPages: true,
      lastPageEmpty: false,
      hasMore: true,
    });
    assert.equal(result.fetchComplete, false);
  });

  it("refuses empty payload when total claims products exist", () => {
    const result = evaluateCiFetchCompleteness({
      productsMapped: 0,
      total: 50,
      pagesFetched: 1,
      hitMaxPages: false,
      lastPageEmpty: true,
      hasMore: false,
    });
    assert.equal(result.fetchComplete, false);
  });
});

describe("qa hardening — cancel restock policy", () => {
  it("restocks only from pre-ship statuses on first cancel", () => {
    for (const status of CANCEL_RESTOCKABLE_STATUSES) {
      assert.equal(
        shouldRestockOnStatusChange(status, "cancelled"),
        true,
        status,
      );
    }
    assert.equal(shouldRestockOnStatusChange("shipped", "cancelled"), false);
    assert.equal(shouldRestockOnStatusChange("delivered", "cancelled"), false);
    assert.equal(shouldRestockOnStatusChange("completed", "cancelled"), false);
    assert.equal(shouldRestockOnStatusChange("cancelled", "cancelled"), false);
    assert.equal(shouldRestockOnStatusChange("returned", "cancelled"), false);
  });
});

describe("qa hardening — dealer listing ownership contract", () => {
  it("documents that dealer SO lines must belong to the acting dealer", () => {
    const actingDealerId = "dealer-a";
    const foreignListing = { dealerId: "dealer-b", status: "active" };
    assert.notEqual(foreignListing.dealerId, actingDealerId);
    assert.equal(
      foreignListing.status === "active" &&
        foreignListing.dealerId === actingDealerId,
      false,
    );
  });
});

describe("qa hardening — firm allow-list", () => {
  it("accepts only the three SpareLink firms", () => {
    assert.equal(SPARELINK_FIRMS.length, 3);
    for (const firm of SPARELINK_FIRMS) {
      assert.equal(isAllowedFirmId(firm.id), true);
    }
    assert.equal(isAllowedFirmId("firm-invented"), false);
    assert.equal(isAllowedFirmId(""), false);
  });
});

describe("qa hardening — source/commercial visibility", () => {
  it("hides pending and unpublished from customers", () => {
    assert.equal(
      isCustomerVisibleProduct({
        isPublished: false,
        approvalStatus: APPROVAL_STATUS.PENDING_ADMIN_APPROVAL,
      }),
      false,
    );
    assert.equal(
      isCustomerVisibleProduct({
        isPublished: true,
        approvalStatus: APPROVAL_STATUS.APPROVED,
      }),
      true,
    );
    const parts = filterSearchPartsForCustomer([
      {
        id: "1",
        partNumber: "OK",
        name: "Visible",
        brand: "CI",
        isPublished: true,
        approvalStatus: "APPROVED",
      },
      {
        id: "2",
        partNumber: "PEND",
        name: "Hidden",
        brand: "CI",
        isPublished: false,
        approvalStatus: "PENDING_ADMIN_APPROVAL",
      },
    ]);
    assert.deepEqual(
      parts.map((p) => p.partNumber),
      ["OK"],
    );
  });

  it("strips source price fields from customer payloads", () => {
    const cleaned = omitSourceCommercialFields({
      name: "HANDLE",
      pricePaise: 52800,
      sourcePricePaise: 48800,
      sourcePrice: 488,
      sourcePreviousPrice: 450,
    });
    assert.equal("sourcePricePaise" in cleaned, false);
    assert.equal("sourcePrice" in cleaned, false);
    assert.equal("sourcePreviousPrice" in cleaned, false);
    assert.equal(cleaned.pricePaise, 52800);
  });
});

describe("qa hardening — search regressions", () => {
  it("keeps exact part-number gate for known SKUs", () => {
    for (const q of ["856", "M-856", "1856", "M-865", "M-854", "101", "103", "113"]) {
      const intent = parseSearchIntent(q);
      assert.equal(intent.isPartNumberQuery, true, q);
      assert.equal(intent.naturalLanguage, null, q);
    }
  });

  it("normalizes Hinglish and English catalogue phrases", () => {
    const cases = [
      "Bolero ka left door handle",
      "Bolero left handle",
      "Bolero driver side door handle",
      "pani pump",
      "water pump for Bolero",
      "mujhe 20w40 pensol oil chahiye",
      "Pensol 20w40",
      "20w40 engine oil Pensol",
      "Swift window regulator",
      "Swift ka window regulator",
      "Universal Joint",
      "universal joint cross",
    ];
    for (const q of cases) {
      const intent = parseSearchIntent(q);
      assert.equal(intent.isPartNumberQuery, false, q);
      assert.ok(intent.typesenseQuery.length > 0, q);
    }
    const hinglish = parseSearchIntent("Bolero ka left door handle");
    assert.ok(hinglish.naturalLanguage);
    assert.equal(hinglish.naturalLanguage?.side, "left");
    assert.ok(hinglish.naturalLanguage?.vehicleHints.includes("bolero"));
  });
});
