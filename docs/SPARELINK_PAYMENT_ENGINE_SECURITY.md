# SPARELINK PAYMENT ENGINE — SECURITY

**Status: FOUNDATION** · Established 06-Oct-2026

---

## 1. Threats this design answers

| # | Threat | Control | Where |
|---|---|---|---|
| 1 | Client redirects payment to the wrong firm's account | Firm derived server-side from the order; a disagreeing client claim is refused | `resolveFirm` |
| 2 | Frontend fakes success | `SUCCESS` requires a type-branded proof only `verifyProviderCallback` can produce | `transition()` |
| 3 | Amount tampering in transit | Reported amount must equal the server-loaded amount, as branded integer paise | `verifyProviderCallback` |
| 4 | Callback replay | Unique `(provider, eventId)`; already-seen events refused | schema + verifier |
| 5 | Same success delivered N times → N ledger entries | Unique `(provider, providerTransactionId)` | `erp_payment_transaction` |
| 6 | Retried checkout opens a second payment | Unique `(firmId, idempotencyKey)`, derived server-side | schema + `paymentIdempotencyKey` |
| 7 | Engine becomes a custodian | No SpareLink account exists; destinations must belong to a firm | `assertFirmOwnedDestination` |
| 8 | Over-collection | Over-allocation refused, never clamped | `applyToOutstanding` |
| 9 | Over-refund | Refund ceiling checked against captured minus already refunded | `assertRefundWithinCaptured` |
| 10 | Credentials collected or stored | Never collected. No credential column exists in the schema | guardrail test |
| 11 | Secrets in audit or logs | Audit metadata carries no password, OTP, CVV, card or full bank credential; raw provider body is **not stored** | `PaymentProviderEvent` comment |
| 12 | Floating-point money | Integer paise only; a float in a monetary position fails the build | guardrail test |
| 13 | Cross-firm access | Every table firm-scoped with composite FKs, `DEFERRABLE INITIALLY DEFERRED` | migration |

---

## 2. What is never collected or stored

| Never collected | Never stored |
|---|---|
| Card number | Raw provider callback body |
| CVV | Provider signing secrets (they live in encrypted per-firm storage, as `GstCredential` does) |
| Net-banking password | Any credential in `erp_firm_payment_configuration` — it has no credential column |
| Bank PIN / ATM PIN | OTP |
| UPI PIN | |

A guardrail test fails the build if code is added that *collects, captures,
stores, persists or saves* any of these.

---

## 3. Callback verification order

The order matters — cheap and decisive checks first.

1. **Signature** — unauthenticated callbacks are refused before any amount is read.
2. **Replay** — a known `eventId` is refused.
3. **Provider reference present** — a payment with no reference can never be reconciled, so it is refused at the door.
4. **Amount is branded integer paise** — a float is refused, not rounded.
5. **Amount equals the order** — the decisive check.
6. **Amount positive**.
7. **Currency matches** the order.
8. **Order matches**.
9. **Firm matches** — money settled to the wrong legal entity is refused.

Only after all nine does `PAYMENT VERIFIED` exist, and only then may ERP be asked
to post.

---

## 4. Non-custodial guarantee

- There is no SpareLink bank account, wallet, settlement account or pool.
- `assertFirmOwnedDestination` requires `destination.firmId === orderFirmId`,
  and refuses an inactive or reference-less destination.
- A firm payment configuration row **defaults to `active = false`**, so a
  placeholder destination cannot receive a payment even if populated wrongly.

Adding a "SpareLink" destination would require changing this function and the
schema. That is deliberate friction.

---

## 5. Firm configuration security

| Rule | Status |
|---|---|
| No credentials in the config table | ✅ no such column exists |
| Values are placeholders until B2 | ✅ and default inactive |
| Never in source code | ✅ no real values written anywhere |
| Never in Git | ✅ nothing staged |
| Never logged | ✅ logging is a code-review rule; no adapter logs a destination |
| Never returned to a frontend as a secret | ✅ a UPI VPA is a *destination*, shown deliberately; it is not a credential |

---

## 6. Idempotency and replay

Two independent guarantees, because they answer different questions:

| Key | Unique on | Answers |
|---|---|---|
| `idempotencyKey` | `(firmId, idempotencyKey)` | "Have I already been asked to create this payment?" |
| `providerTransactionId` | `(provider, providerTransactionId)` | "Has this rail transaction already produced an accounting effect?" |
| `eventId` | `(provider, eventId)` | "Have I already processed this delivery?" |

The idempotency key is **derived server-side** from firm, order, amount, currency
and method — not accepted from the client — so a client cannot reuse one key to
collapse two genuinely different payments.

---

## 7. Audit

Audited: payment created, initiated, callback received, verified, failed, expired,
reconciled, refund created, refund completed, manual verification, manual override.

Metadata excludes passwords, OTPs, CVVs, secret keys and full bank credentials.
Provider callbacks are recorded as the **engine's verdict**, never the provider's
own "paid" claim.

---

## 8. Open security items — not yet built

| Item | Phase |
|---|---|
| Rate limiting per payment route | J |
| Signature scheme per provider | J |
| Timestamp/replay window verification | J |
| Deterministic fraud hooks — amount tampering, firm mismatch, duplicate transaction, suspicious frequency, excessive failures, refund abuse | E–F |
| Key rotation per provider | J |
| Chargeback handling | J |

**No "AI fraud detection" is claimed or built.** Deterministic controls come first,
and they are the ones that are implemented.

---

## 9. Regulatory position

SpareLink Payment Engine is a proprietary software and payment orchestration
layer. It is **not** described as an RBI-authorised Payment Aggregator and **not**
described as NPCI-certified, because no such authorisation or certification
exists. Production UPI and net-banking integration must use an appropriately
authorised bank, PSP or acquirer and satisfy the applicable onboarding, security
and compliance requirements.

**No approval is fabricated anywhere in this repository.**
