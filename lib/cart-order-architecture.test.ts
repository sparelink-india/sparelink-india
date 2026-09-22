import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SPARELINK_FIRMS } from "./firms";
import {
  canAccessCustomerOrder,
  canMutateOrderPaymentStatus,
  splitLinesByFirm,
  validateAvailableStock,
  validateCartQuantity,
  type AuthoritativeCartLine,
} from "./order-architecture";
import { ignoreClientPricing, priceCustomerLine } from "./party-pricing";

const ambaji = SPARELINK_FIRMS.find((firm) => firm.code === "AMB")!;
const hind = SPARELINK_FIRMS.find((firm) => firm.code === "HIN")!;
const india = SPARELINK_FIRMS.find((firm) => firm.code === "IND")!;

function line(
  listingId: string,
  firmId: string,
  quantity: number,
  unitNetInclusivePaise: number,
): AuthoritativeCartLine {
  return {
    listingId,
    firmId,
    quantity,
    unitNetInclusivePaise,
    lineNetInclusivePaise: unitNetInclusivePaise * quantity,
  };
}

describe("cart / order architecture", () => {
  it("1. one Ambaji product forms a single parent order with one Ambaji allocation", () => {
    const split = splitLinesByFirm([line("A", ambaji.id, 1, 1000)]);
    assert.equal(split.ok, true);
    if (!split.ok) return;
    assert.equal(split.allocations.length, 1);
    assert.equal(split.allocations[0].firmName, "Ambaji Traders");
    assert.equal(split.parentTotalPaise, 1000);
  });

  it("2. one Hind Motors product forms one Hind Motors allocation", () => {
    const split = splitLinesByFirm([line("C", hind.id, 1, 2000)]);
    assert.equal(split.ok, true);
    if (!split.ok) return;
    assert.equal(split.allocations[0].firmName, "Hind Motors");
    assert.equal(split.parentTotalPaise, 2000);
  });

  it("3. one India Sales product forms one India Sales allocation", () => {
    const split = splitLinesByFirm([line("D", india.id, 2, 1500)]);
    assert.equal(split.ok, true);
    if (!split.ok) return;
    assert.equal(split.allocations[0].firmName, "India Sales");
    assert.equal(split.parentTotalPaise, 3000);
  });

  it("4. mixed Ambaji + Hind Motors stay one parent with two allocations", () => {
    const split = splitLinesByFirm([
      line("A", ambaji.id, 1, 1000),
      line("B", ambaji.id, 1, 500),
      line("C", hind.id, 1, 2000),
    ]);
    assert.equal(split.ok, true);
    if (!split.ok) return;
    assert.equal(split.allocations.length, 2);
    assert.equal(split.parentTotalPaise, 3500);
    const ambajiAlloc = split.allocations.find((row) => row.firmId === ambaji.id)!;
    assert.equal(ambajiAlloc.items.length, 2);
    assert.equal(ambajiAlloc.amountPaise, 1500);
  });

  it("5. mixed Ambaji + India Sales stay one parent", () => {
    const split = splitLinesByFirm([line("A", ambaji.id, 1, 1000), line("D", india.id, 1, 400)]);
    assert.equal(split.ok, true);
    if (!split.ok) return;
    assert.equal(split.allocations.length, 2);
    assert.equal(split.parentTotalPaise, 1400);
  });

  it("6. mixed Hind Motors + India Sales stay one parent", () => {
    const split = splitLinesByFirm([line("C", hind.id, 1, 2000), line("D", india.id, 1, 400)]);
    assert.equal(split.ok, true);
    if (!split.ok) return;
    assert.equal(split.allocations.length, 2);
    assert.equal(split.parentTotalPaise, 2400);
  });

  it("7. all three firms remain one parent SpareLink order", () => {
    const split = splitLinesByFirm([
      line("A", ambaji.id, 1, 1000),
      line("C", hind.id, 1, 2000),
      line("D", india.id, 1, 400),
    ]);
    assert.equal(split.ok, true);
    if (!split.ok) return;
    assert.equal(split.allocations.length, 3);
    assert.deepEqual(
      split.allocations.map((row) => row.firmName),
      ["Ambaji Traders", "Hind Motors", "India Sales"],
    );
    assert.equal(split.parentTotalPaise, 3400);
  });

  it("8. quantity update must be a positive integer", () => {
    assert.equal(validateCartQuantity(3).ok, true);
    assert.equal(validateCartQuantity(1).ok, true);
  });

  it("9. removing an item is represented by absence from the split, not a zero line", () => {
    const afterRemove = splitLinesByFirm([line("A", ambaji.id, 1, 1000)]);
    assert.equal(afterRemove.ok, true);
    if (!afterRemove.ok) return;
    assert.equal(afterRemove.allocations.every((row) => row.items.every((item) => item.quantity >= 1)), true);
  });

  it("10. empty cart cannot create an order", () => {
    const split = splitLinesByFirm([]);
    assert.equal(split.ok, false);
  });

  it("11. invalid quantity is rejected", () => {
    assert.equal(validateCartQuantity(0).ok, false);
    assert.equal(validateCartQuantity(-1).ok, false);
    assert.equal(validateCartQuantity(1.5).ok, false);
    assert.equal(validateCartQuantity("2").ok, false);
  });

  it("12. insufficient stock is rejected from authoritative stock", () => {
    assert.equal(validateAvailableStock(3, 2).ok, false);
    assert.equal(validateAvailableStock(1, 0).ok, false);
    assert.equal(validateAvailableStock(1, null).ok, false);
    assert.equal(validateAvailableStock(2, 2).ok, true);
  });

  it("13. price tampering fields are stripped and ignored", () => {
    const cleaned = ignoreClientPricing({
      dealerListingId: "listing-1",
      quantity: 2,
      pricePaise: 1,
      totalPaise: 1,
      netInclusivePaise: 1,
    });
    assert.equal(cleaned.dealerListingId, "listing-1");
    assert.equal(cleaned.quantity, 2);
    assert.equal(cleaned.pricePaise, undefined);
    assert.equal(cleaned.totalPaise, undefined);
    assert.equal(cleaned.netInclusivePaise, undefined);
  });

  it("14. firm tampering fields are stripped; split uses trusted firm ids only", () => {
    const cleaned = ignoreClientPricing({
      dealerListingId: "listing-1",
      quantity: 1,
      firmId: "forged-firm",
    });
    assert.equal(cleaned.firmId, undefined);
    const forged = splitLinesByFirm([line("A", "forged-firm", 1, 1000)]);
    assert.equal(forged.ok, false);
  });

  it("15. total tampering fields are stripped", () => {
    const cleaned = ignoreClientPricing({
      quantity: 1,
      subtotalPaise: 9,
      gstPaise: 9,
      shippingPaise: 9,
      amountPaise: 9,
    });
    assert.equal(cleaned.subtotalPaise, undefined);
    assert.equal(cleaned.gstPaise, undefined);
    assert.equal(cleaned.shippingPaise, undefined);
    assert.equal(cleaned.amountPaise, undefined);
  });

  it("16. a customer cannot access another customer's order", () => {
    assert.equal(
      canAccessCustomerOrder({ role: "buyer", id: "buyer-a" }, "buyer-b"),
      false,
    );
    assert.equal(
      canAccessCustomerOrder({ role: "buyer", id: "buyer-a" }, "buyer-a"),
      true,
    );
  });

  it("17. a customer cannot mutate payment status; admin can", () => {
    assert.equal(canMutateOrderPaymentStatus("buyer"), false);
    assert.equal(canMutateOrderPaymentStatus("dealer"), false);
    assert.equal(canMutateOrderPaymentStatus("admin"), true);
    const cleaned = ignoreClientPricing({
      paymentMethod: "cash_on_delivery",
      paymentStatus: "paid",
      status: "completed",
    });
    assert.equal(cleaned.paymentMethod, "cash_on_delivery");
    assert.equal(cleaned.paymentStatus, undefined);
    assert.equal(cleaned.status, undefined);
  });

  it("18. historical snapshot price is unchanged after a later catalogue price change", () => {
    const snapshot = priceCustomerLine(10000, 2, 18, 30);
    const laterCatalogue = priceCustomerLine(12000, 2, 18, 30);
    assert.equal(snapshot.lineNetPaise, 14000);
    assert.equal(laterCatalogue.lineNetPaise, 16800);
    assert.notEqual(snapshot.lineNetPaise, laterCatalogue.lineNetPaise);
  });
});
