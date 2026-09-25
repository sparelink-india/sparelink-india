import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AMBAJI_TRADERS_FIRM_ID,
  HIND_MOTORS_FIRM_ID,
  INDIA_SALES_FIRM_ID,
  resolveAllocationPaymentMethod,
} from "./firms";
import { ignoreCheckoutClientOverrides } from "./party-pricing";
import { priceCustomerLine } from "./party-pricing";
import { unexpectedCheckoutErrorResponse } from "@/app/api/orders/route";
import {
  buildCheckoutIdempotencyStorageKey,
  buildParentOrderPlan,
  checkoutIdempotencyStorageMatches,
  CheckoutError,
  countAllocationsByCanonicalFirm,
  parseCheckoutIdempotencyKey,
  shouldClearCart,
  snapshotOrderItem,
  validateCheckoutQuantity,
  validateCheckoutStock,
  type CheckoutCartLine,
} from "./checkout-order";

function line(
  firmId: string,
  quantity: number,
  listInclusivePaise: number,
  name: string,
  stock = 10,
): CheckoutCartLine {
  return {
    dealerListingId: `listing-${name}`,
    dealerId: "dealer-1",
    firmId,
    quantity,
    pricePaise: listInclusivePaise,
    listingStatus: "active",
    stock,
    partId: `part-${name}`,
    partNumber: name,
    partName: name,
    partBrand: "Brand",
    sku: name,
  };
}

function priced(cartLine: CheckoutCartLine, discountPercent = 0, gstRate = 18) {
  return {
    line: cartLine,
    gstRate,
    priced: priceCustomerLine(
      cartLine.pricePaise,
      cartLine.quantity,
      gstRate,
      discountPercent,
    ),
  };
}

describe("multi-firm checkout order plan", () => {
  it("1. unauthenticated checkout is a buyer-api 401 concern (key rejected if empty)", () => {
    assert.equal(parseCheckoutIdempotencyKey(""), null);
    assert.equal(parseCheckoutIdempotencyKey("  "), null);
  });

  it("returns a JSON response for unexpected checkout failures", async () => {
    const response = unexpectedCheckoutErrorResponse();

    assert.equal(response.status, 500);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(await response.json(), {
      error: "Unable to place your order. Please try again.",
    });
  });

  it("2-3. buyer-owned cart lines create one parent order", () => {
    const plan = buildParentOrderPlan(
      [priced(line(AMBAJI_TRADERS_FIRM_ID, 1, 10000, "A"))],
      "cash_on_delivery",
      "SL-TEST",
    );
    assert.equal(countAllocationsByCanonicalFirm(plan).parentCount, 1);
    assert.equal(plan.allocations.length, 1);
  });

  it("4. client userId/firmId/price/GST/total are stripped", () => {
    const cleaned = ignoreCheckoutClientOverrides({
      shippingAddress: { name: "Ada" },
      userId: "other-user",
      buyerId: "other-user",
      firmId: "forged-firm",
      pricePaise: 1,
      gstPaise: 1,
      gstRate: 5,
      totalPaise: 1,
      subtotalPaise: 1,
      quantity: 99,
      paymentStatus: "paid",
      stock: 999,
    });
    assert.equal(cleaned.userId, undefined);
    assert.equal(cleaned.firmId, undefined);
    assert.equal(cleaned.pricePaise, undefined);
    assert.equal(cleaned.gstPaise, undefined);
    assert.equal(cleaned.totalPaise, undefined);
    assert.equal(cleaned.quantity, undefined);
    assert.equal(cleaned.paymentStatus, undefined);
    assert.deepEqual(cleaned.shippingAddress, { name: "Ada" });
  });

  it("5. firmId tampering is ignored; authoritative listing firm is used", () => {
    const plan = buildParentOrderPlan(
      [priced(line(HIND_MOTORS_FIRM_ID, 1, 10000, "C"))],
      "cash_on_delivery",
      "SL-TEST",
    );
    assert.equal(plan.allocations[0]?.firmId, HIND_MOTORS_FIRM_ID);
    assert.notEqual(plan.allocations[0]?.firmId, "firm-ambaji-traders");
  });

  it("6-8. price, GST, and total come from server snapshot, not client", () => {
    const cartLine = line(AMBAJI_TRADERS_FIRM_ID, 2, 10000, "A");
    const server = priced(cartLine, 30, 18);
    const snap = snapshotOrderItem(cartLine, server.priced, 18);
    assert.equal(snap.unitPricePaise, 7000);
    assert.equal(snap.gstRate, 18);
    assert.equal(snap.totalPaise, 14000);
    assert.notEqual(snap.unitPricePaise, 1);
    assert.notEqual(snap.totalPaise, 1);
  });

  it("9. quantity must be a positive integer", () => {
    assert.throws(() => validateCheckoutQuantity(0), CheckoutError);
    assert.throws(() => validateCheckoutQuantity(-1), CheckoutError);
    assert.throws(() => validateCheckoutQuantity(1.5), CheckoutError);
    assert.equal(validateCheckoutQuantity(3), 3);
  });

  it("10. insufficient stock is rejected", () => {
    assert.throws(
      () => validateCheckoutStock("Filter", 3, 2),
      (error: unknown) =>
        error instanceof CheckoutError && error.status === 409,
    );
    assert.throws(() =>
      buildParentOrderPlan(
        [priced(line(AMBAJI_TRADERS_FIRM_ID, 5, 10000, "A", 1))],
        "cash_on_delivery",
        "SL-TEST",
      ),
    );
  });

  it("11. duplicate checkout key is parseable once and reused", () => {
    const key = parseCheckoutIdempotencyKey("checkout-abc_123");
    assert.equal(key, "checkout-abc_123");
    assert.equal(parseCheckoutIdempotencyKey(key), key);
  });

  it("12. failed validation produces no parent plan", () => {
    let plan = null;
    try {
      plan = buildParentOrderPlan(
        [priced(line("not-a-real-firm", 1, 10000, "X"))],
        "cash_on_delivery",
        "SL-TEST",
      );
    } catch (error) {
      assert.equal(error instanceof CheckoutError, true);
    }
    assert.equal(plan, null);
  });

  it("13. cart is cleared only after a successful commit", () => {
    assert.equal(shouldClearCart(false), false);
    assert.equal(shouldClearCart(true), true);
  });

  it("A. Ambaji-only cart → one Ambaji allocation", () => {
    const plan = buildParentOrderPlan(
      [
        priced(line(AMBAJI_TRADERS_FIRM_ID, 1, 10000, "A")),
        priced(line(AMBAJI_TRADERS_FIRM_ID, 2, 5000, "B")),
      ],
      "cash_on_delivery",
      "SL-A",
    );
    const counts = countAllocationsByCanonicalFirm(plan);
    assert.equal(counts.allocationCount, 1);
    assert.equal(counts.ambaji, 1);
    assert.equal(counts.hind, 0);
    assert.equal(counts.indiaSales, 0);
    assert.equal(plan.allocations[0]?.items.length, 2);
  });

  it("B. Hind-only cart → one Hind allocation", () => {
    const plan = buildParentOrderPlan(
      [priced(line(HIND_MOTORS_FIRM_ID, 1, 8000, "C"))],
      "cash_on_delivery",
      "SL-B",
    );
    const counts = countAllocationsByCanonicalFirm(plan);
    assert.equal(counts.allocationCount, 1);
    assert.equal(counts.hind, 1);
    assert.equal(counts.ambaji, 0);
  });

  it("C. India Sales-only cart → one India Sales allocation", () => {
    const plan = buildParentOrderPlan(
      [priced(line(INDIA_SALES_FIRM_ID, 1, 9000, "D"))],
      "cash_on_delivery",
      "SL-C",
    );
    const counts = countAllocationsByCanonicalFirm(plan);
    assert.equal(counts.allocationCount, 1);
    assert.equal(counts.indiaSales, 1);
  });

  it("D. Ambaji + Hind", () => {
    const plan = buildParentOrderPlan(
      [
        priced(line(AMBAJI_TRADERS_FIRM_ID, 1, 10000, "A")),
        priced(line(HIND_MOTORS_FIRM_ID, 1, 8000, "C")),
      ],
      "cash_on_delivery",
      "SL-D",
    );
    const counts = countAllocationsByCanonicalFirm(plan);
    assert.equal(counts.parentCount, 1);
    assert.equal(counts.allocationCount, 2);
    assert.equal(counts.ambaji, 1);
    assert.equal(counts.hind, 1);
  });

  it("E. Ambaji + India Sales", () => {
    const plan = buildParentOrderPlan(
      [
        priced(line(AMBAJI_TRADERS_FIRM_ID, 1, 10000, "A")),
        priced(line(INDIA_SALES_FIRM_ID, 1, 9000, "D")),
      ],
      "cash_on_delivery",
      "SL-E",
    );
    assert.equal(countAllocationsByCanonicalFirm(plan).allocationCount, 2);
  });

  it("F. Hind + India Sales", () => {
    const plan = buildParentOrderPlan(
      [
        priced(line(HIND_MOTORS_FIRM_ID, 1, 8000, "C")),
        priced(line(INDIA_SALES_FIRM_ID, 1, 9000, "D")),
      ],
      "cash_on_delivery",
      "SL-F",
    );
    assert.equal(countAllocationsByCanonicalFirm(plan).allocationCount, 2);
  });

  it("G. all three firms → one parent, three allocations, totals add up", () => {
    const plan = buildParentOrderPlan(
      [
        priced(line(AMBAJI_TRADERS_FIRM_ID, 2, 10000, "A")),
        priced(line(AMBAJI_TRADERS_FIRM_ID, 1, 5000, "B")),
        priced(line(HIND_MOTORS_FIRM_ID, 1, 8000, "C")),
        priced(line(INDIA_SALES_FIRM_ID, 3, 4000, "D")),
      ],
      "online_payment",
      "SL-G",
    );
    const counts = countAllocationsByCanonicalFirm(plan);
    assert.equal(counts.parentCount, 1);
    assert.equal(counts.allocationCount, 3);
    assert.equal(counts.ambaji, 1);
    assert.equal(counts.hind, 1);
    assert.equal(counts.indiaSales, 1);
    const firmSum = plan.allocations.reduce((sum, item) => sum + item.totalPaise, 0);
    assert.equal(plan.totalPaise, firmSum);
    assert.equal(
      plan.subtotalPaise + plan.gstPaise,
      plan.allocations.reduce(
        (sum, item) => sum + item.subtotalPaise + item.gstPaise,
        0,
      ),
    );
    const ambaji = plan.allocations.find((item) => item.firmId === AMBAJI_TRADERS_FIRM_ID);
    const hind = plan.allocations.find((item) => item.firmId === HIND_MOTORS_FIRM_ID);
    const india = plan.allocations.find((item) => item.firmId === INDIA_SALES_FIRM_ID);
    assert.equal(ambaji?.items.length, 2);
    assert.equal(hind?.items.length, 1);
    assert.equal(india?.items.length, 1);
    assert.equal(ambaji?.items.reduce((sum, item) => sum + item.quantity, 0), 3);
    assert.equal(resolveAllocationPaymentMethod("online_payment", AMBAJI_TRADERS_FIRM_ID), "online_payment");
    assert.equal(resolveAllocationPaymentMethod("online_payment", HIND_MOTORS_FIRM_ID), "online_coming_soon");
    assert.equal(resolveAllocationPaymentMethod("online_payment", INDIA_SALES_FIRM_ID), "online_coming_soon");
    assert.equal(resolveAllocationPaymentMethod("cash_on_delivery", AMBAJI_TRADERS_FIRM_ID), "cash_on_delivery");
  });

  it("historical snapshot does not change when later list price would differ", () => {
    const original = snapshotOrderItem(
      line(AMBAJI_TRADERS_FIRM_ID, 1, 10000, "A"),
      priceCustomerLine(10000, 1, 18, 30),
      18,
    );
    const laterCatalogue = priceCustomerLine(12000, 1, 18, 30);
    assert.equal(original.unitPricePaise, 7000);
    assert.notEqual(original.unitPricePaise, laterCatalogue.netInclusivePaise);
  });
});

describe("checkout idempotency storage", () => {
  const body = {
    paymentMethod: "bank_transfer",
    shippingAddress: {
      name: "Test Buyer",
      phone: "9876543210",
      city: "Pune",
    },
  };
  const cart = [
    {
      id: "cart-item-1",
      dealerListingId: "listing-1",
      quantity: 2,
      firmId: AMBAJI_TRADERS_FIRM_ID,
      pricePaise: 10000,
    },
  ];

  it("replays the same buyer, key, body, and cart snapshot", () => {
    const stored = buildCheckoutIdempotencyStorageKey(
      "buyer-1",
      "checkout-1",
      body,
      cart,
    );

    assert.equal(
      checkoutIdempotencyStorageMatches(
        stored,
        "buyer-1",
        "checkout-1",
        body,
        cart,
      ),
      true,
    );
  });

  it("does not replay a reused key with a different payload", () => {
    const stored = buildCheckoutIdempotencyStorageKey(
      "buyer-1",
      "checkout-1",
      body,
      cart,
    );

    assert.equal(
      checkoutIdempotencyStorageMatches(
        stored,
        "buyer-1",
        "checkout-1",
        { ...body, paymentMethod: "cash_on_delivery" },
        cart,
      ),
      false,
    );
  });

  it("does not replay a reused key with different cart contents", () => {
    const stored = buildCheckoutIdempotencyStorageKey(
      "buyer-1",
      "checkout-1",
      body,
      cart,
    );

    assert.equal(
      checkoutIdempotencyStorageMatches(
        stored,
        "buyer-1",
        "checkout-1",
        body,
        [{ ...cart[0], quantity: 3 }],
      ),
      false,
    );
  });

  it("scopes the stored key to the buyer", () => {
    const first = buildCheckoutIdempotencyStorageKey(
      "buyer-1",
      "checkout-1",
      body,
      cart,
    );
    const second = buildCheckoutIdempotencyStorageKey(
      "buyer-2",
      "checkout-1",
      body,
      cart,
    );

    assert.notEqual(first, second);
    assert.equal(
      checkoutIdempotencyStorageMatches(
        first,
        "buyer-2",
        "checkout-1",
        body,
        cart,
      ),
      false,
    );
  });
});
