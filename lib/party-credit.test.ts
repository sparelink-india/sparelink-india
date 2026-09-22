import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertCreditLimitAllows,
  computeLedgerDeltaPaise,
  nextBalanceAfterPaise,
  publicDealerCreditView,
} from "./party-credit";

describe("party credit ledger foundation", () => {
  it("starts neutral: zero outstanding with no invented balance", () => {
    const view = publicDealerCreditView({
      creditLimitPaise: 0,
      outstandingPaise: 0,
    });
    assert.equal(view.outstandingPaise, 0);
    assert.equal(view.creditEnforcementEnabled, false);
    assert.equal(view.availableCreditPaise, null);
  });

  it("computes debit/credit/payment deltas", () => {
    assert.equal(computeLedgerDeltaPaise("debit", 5000), 5000);
    assert.equal(computeLedgerDeltaPaise("credit", 2000), -2000);
    assert.equal(computeLedgerDeltaPaise("payment", 1500), -1500);
  });

  it("supports signed adjustments", () => {
    assert.equal(computeLedgerDeltaPaise("adjustment", 0, -3000), -3000);
    assert.equal(computeLedgerDeltaPaise("adjustment", 0, 1200), 1200);
  });

  it("derives running balance from ledger deltas", () => {
    const afterDebit = nextBalanceAfterPaise(0, 10000);
    assert.equal(afterDebit, 10000);
    const afterPayment = nextBalanceAfterPaise(afterDebit, -4000);
    assert.equal(afterPayment, 6000);
  });

  it("does not enforce when credit limit is 0 (not configured)", () => {
    const check = assertCreditLimitAllows(0, 0, 50000);
    assert.equal(check.ok, true);
    assert.equal(check.enforced, false);
  });

  it("blocks when positive limit would be exceeded", () => {
    const check = assertCreditLimitAllows(10000, 8000, 3000);
    assert.equal(check.ok, false);
    if (!check.ok) {
      assert.match(check.error, /credit limit/i);
    }
  });

  it("allows when within configured limit", () => {
    const check = assertCreditLimitAllows(10000, 2000, 3000);
    assert.equal(check.ok, true);
    assert.equal(check.enforced, true);
  });

  it("buyer-facing view hides nothing critical but does not invent available credit when unenforced", () => {
    const view = publicDealerCreditView({
      creditLimitPaise: 50000,
      outstandingPaise: 12000,
    });
    assert.equal(view.availableCreditPaise, 38000);
    assert.equal(view.creditEnforcementEnabled, true);
  });
});
