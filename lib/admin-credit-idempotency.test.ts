import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildLedgerIdempotencyKey,
  normaliseNote,
  type LedgerEntryIntent,
} from "./admin-credit-idempotency";

function intent(overrides: Partial<LedgerEntryIntent> = {}): LedgerEntryIntent {
  return {
    dealerId: "dealer-1",
    entryType: "payment",
    amountPaise: 50000,
    notes: "Bank transfer",
    nonce: 0,
    ...overrides,
  };
}

describe("the regression that caused duplicate ledger entries", () => {
  it("no longer embeds a clock reading, so a repeat click collides", () => {
    const key = buildLedgerIdempotencyKey(intent());
    // The old key was `admin-<dealer>-<type>-<amount>-<Date.now()>`.
    assert.equal(/17\d{11}|\d{13}/.test(key), false, "no timestamp in the key");
    assert.equal(
      buildLedgerIdempotencyKey(intent()),
      key,
      "the same intent must always produce the same key",
    );
  });

  it("is stable across an unlimited number of identical clicks", () => {
    const first = buildLedgerIdempotencyKey(intent());
    for (let i = 0; i < 50; i += 1) {
      assert.equal(buildLedgerIdempotencyKey(intent()), first);
    }
  });
});

describe("the key changes only when the user means something different", () => {
  it("changes when the dealer changes", () => {
    assert.notEqual(
      buildLedgerIdempotencyKey(intent({ dealerId: "dealer-1" })),
      buildLedgerIdempotencyKey(intent({ dealerId: "dealer-2" })),
    );
  });

  it("changes when the entry type changes", () => {
    assert.notEqual(
      buildLedgerIdempotencyKey(intent({ entryType: "payment" })),
      buildLedgerIdempotencyKey(intent({ entryType: "debit" })),
    );
  });

  it("changes when the amount changes", () => {
    assert.notEqual(
      buildLedgerIdempotencyKey(intent({ amountPaise: 50000 })),
      buildLedgerIdempotencyKey(intent({ amountPaise: 50001 })),
    );
  });

  it("changes when the note genuinely changes", () => {
    assert.notEqual(
      buildLedgerIdempotencyKey(intent({ notes: "Bank transfer" })),
      buildLedgerIdempotencyKey(intent({ notes: "Cheque 4471" })),
    );
  });

  it("changes when the submission nonce advances after a successful post", () => {
    assert.notEqual(
      buildLedgerIdempotencyKey(intent({ nonce: 0 })),
      buildLedgerIdempotencyKey(intent({ nonce: 1 })),
    );
  });

  it("is case-insensitive on the entry type so the key cannot be split", () => {
    assert.equal(
      buildLedgerIdempotencyKey(intent({ entryType: "Payment" })),
      buildLedgerIdempotencyKey(intent({ entryType: "payment" })),
    );
  });
});

describe("normalisation is forgiving but not lossy", () => {
  it("collapses whitespace and casing in a note", () => {
    assert.equal(normaliseNote("  Bank   TRANSFER  "), "bank transfer");
    assert.equal(normaliseNote(null), "");
    assert.equal(normaliseNote(undefined), "");
  });

  it("treats padding and casing in a note as the same entry", () => {
    assert.equal(
      buildLedgerIdempotencyKey(intent({ notes: "Bank   Transfer" })),
      buildLedgerIdempotencyKey(intent({ notes: "bank transfer" })),
    );
  });

  it("renders paise without float noise", () => {
    const a = buildLedgerIdempotencyKey(intent({ amountPaise: 1000 }));
    const b = buildLedgerIdempotencyKey(intent({ amountPaise: 1000.9 }));
    assert.equal(a, b, "a fractional paisa must not fork the key");
  });

  it("treats a missing amount as zero rather than NaN", () => {
    const key = buildLedgerIdempotencyKey(
      intent({ amountPaise: Number.NaN as unknown as number }),
    );
    assert.equal(key.includes("NaN"), false);
  });
});

describe("adjustments key on the signed amount too", () => {
  it("separates a +500 and a -500 adjustment", () => {
    const plus = buildLedgerIdempotencyKey(
      intent({ entryType: "adjustment", amountPaise: 500, signedAmountPaise: 500 }),
    );
    const minus = buildLedgerIdempotencyKey(
      intent({ entryType: "adjustment", amountPaise: 500, signedAmountPaise: -500 }),
    );
    assert.notEqual(plus, minus);
  });

  it("falls back to the unsigned amount when no signed value is sent", () => {
    const withFallback = buildLedgerIdempotencyKey(
      intent({ entryType: "adjustment", amountPaise: 500 }),
    );
    const explicit = buildLedgerIdempotencyKey(
      intent({ entryType: "adjustment", amountPaise: 500, signedAmountPaise: 500 }),
    );
    assert.equal(withFallback, explicit);
  });
});

describe("unsafe input is refused rather than silently keyed", () => {
  it("refuses an empty dealer", () => {
    assert.throws(() => buildLedgerIdempotencyKey(intent({ dealerId: "   " })), /dealer/i);
  });

  it("refuses an empty entry type", () => {
    assert.throws(() => buildLedgerIdempotencyKey(intent({ entryType: "" })), /entry type/i);
  });

  it("never emits a negative nonce", () => {
    const key = buildLedgerIdempotencyKey(intent({ nonce: -5 }));
    assert.equal(key.endsWith(":0"), true);
  });
});
