# SPARELINK PAYMENT ENGINE — API CONTRACT

**Status: FOUNDATION — CONTRACT DESIGNED, NOT YET ROUTED** · 06-Oct-2026

> No HTTP route exists yet. Phase C is blocked on **B2** (a firm cash/bank account is
> needed before any voucher can be built). This document fixes the shape now so the
> route and the tests agree when it is built.

---

## 1. Authentication and authorisation

Every route requires:

| Control | Rule |
|---|---|
| Authentication | ERP session cookie. **No client may call a payment route unauthenticated.** |
| Authorisation | Server-side permission check, mirroring the ERP's existing `requirePermission` pattern. Never a client-side role test. |
| Firm scope | `firmId` is **derived from the session and the order**, never read from the request body. |
| Rate limiting | Mandatory, per firm and per principal. |
| Idempotency | Mandatory on every write. |
| Request ID | `x-request-id` echoed, as `src/proxy.ts` already does. |
| Error envelope | One shape, below. |
| Audit | Every business write audited in-transaction. |

---

## 2. Error envelope

```json
{
  "error": {
    "code": "FIRM_MISMATCH",
    "message": "The payment claims firm \"AMB\" but the order belongs to \"HMD\".",
    "requestId": "…"
  }
}
```

`code` is stable and machine-readable; `message` is for a human and may change.
Never a stack trace, never a provider secret, never a raw provider body.

---

## 3. Routes

### `POST /api/v1/payments`

Create a payment intent.

Request — **note what is absent**: there is no `firmId`. The firm comes from the
order the server loaded.

```json
{
  "orderReference": "SL-2026-000123",
  "invoiceId": null,
  "amountPaise": 2500000,
  "currency": "INR",
  "method": "UPI",
  "provider": "<configured provider code>"
}
```

Headers: `Idempotency-Key` (optional — derived server-side if absent).

Response `201`:

```json
{
  "paymentId": "…",
  "state": "INITIATED",
  "firmCode": "HMD",
  "destination": { "kind": "UPI", "reference": "<VPA>", "accountHolder": "…" },
  "redirect": "<provider redirect or UPI intent>",
  "expiresAt": "…"
}
```

Errors: `ORDER_NOT_FOUND` · `FIRM_MISMATCH` · `AMOUNT_MISMATCH` ·
`DESTINATION_INACTIVE` · `PROVIDER_NOT_CONFIGURED` · `RATE_LIMITED`

### `GET /api/v1/payments/:id`

Firm-scoped. Returns the payment, its attempts, its transactions and its
reconciliation status. A payment belonging to another firm returns **404, not 403** —
absence is not distinguishable from a wrong guess.

### `POST /api/v1/payments/:id/verify`

Ask the rail directly, for when a callback was lost. Same verification rules as a
callback. Idempotent.

### `POST /api/v1/payments/:id/reconcile`

Runs `classifyReconciliation` and stores the verdict. **Never repairs.** A mismatch
becomes a finding for a human.

### `POST /api/v1/payments/:id/refund`

```json
{ "amountPaise": 500000, "reason": "customer return" }
```

Refuses above the refundable ceiling. Refuses at zero. ERP accounting effect is
requested from ERP, never written here.

### `POST /api/v1/payments/webhooks/:provider`

Unauthenticated **by route**, authenticated **by signature**. This is the one
route that cannot require a session, and it is protected by provider
authentication plus replay rejection.

Handler order is fixed and tested: signature → replay → reference → amount brand →
amount → positive → currency → order → firm. Only then may a payment reach
`SUCCESS`.

Responses: `200` accepted (including an accepted duplicate, so the rail stops
retrying) · `400` malformed · `401` signature invalid · `409` duplicate event.

### `GET /api/v1/orders/:id/payments`

Payments against one order, firm-scoped.

---

## 4. Rules a route handler must not contain

A guardrail exists because this is where a second accounting engine grows:

| Forbidden in a route handler | Why |
|---|---|
| Writing `erp_ledger_entry` | That is the accounting engine's job |
| Writing `erp_voucher` directly | `postVoucher` is the only posting path |
| Writing `erp_payment_allocation` | `allocatePayment` is the only allocation path |
| Accepting `firmId` from the body | The firm is derived |
| Declaring a payment `SUCCESS` | Only trusted verification may |
| Trusting a provider's status string | The engine verifies; the rail reports |
| `parseFloat` on an amount | Money is integer paise |

---

## 5. Idempotency contract

`POST /api/v1/payments` derives the key server-side from
`firm · order · amount · currency · method`. Replaying an identical request returns
the original payment with `200`, not a second `201`.

For writes without a natural key, callers may supply `Idempotency-Key`; it is
scoped per firm and stored under `@@unique([firmId, idempotencyKey])`.

---

## 6. Status vocabulary, shared with the domain

`CREATED · INITIATED · PENDING · SUCCESS · FAILED · EXPIRED · CANCELLED ·
REFUND_PENDING · REFUNDED · PARTIALLY_REFUNDED · RECONCILIATION_REQUIRED`

Reconciliation: `MATCHED · PENDING · MISMATCH · DUPLICATE ·
MISSING_PROVIDER_REFERENCE · MISSING_ERP_POSTING · AMOUNT_MISMATCH · FIRM_MISMATCH ·
MANUAL_REVIEW`

---

## 7. What must exist before these routes do

1. **B2** — a real firm payment destination per firm. Placeholders default inactive
   and cannot go live.
2. An authorised provider configuration (Phase J) — or a sandbox adapter (E/F).
3. The ERP posting boundary (Phase C), which needs a firm cash/bank account.
4. Rate limiting configured for these paths.
