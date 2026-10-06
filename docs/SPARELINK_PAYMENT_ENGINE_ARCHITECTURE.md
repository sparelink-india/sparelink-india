# SPARELINK PAYMENT ENGINE — ARCHITECTURE

**Status: FOUNDATION (Phases A, B, D complete · E–L not started)**
Established 06-Oct-2026 · Authoritative for payment architecture

---

## 1. What this is, and what it is not

**SpareLink Payment Engine is a proprietary software and payment *orchestration*
layer.** It owns payment state, firm routing, provider interaction, transaction
verification, reconciliation and payment audit.

### It is NOT

- **Not custody.** SpareLink holds no customer money. There is no SpareLink bank
  account, no wallet, no settlement account and no pool. `assertFirmOwnedDestination`
  refuses any destination not belonging to one of the three legal firms — the
  engine is not a destination and cannot be made into one by configuration.
- **Not a UPI network.** It does not build, operate or connect to UPI directly.
- **Not an authorised Payment Aggregator.** No RBI authorisation exists. Nothing
  in this repository claims one.
- **Not NPCI-certified.** No certification exists. Nothing here claims one.
- **Not a second accounting engine.** The engine never writes ledger rows.

### Production connectivity requirement

Actual regulated rails must be used through an **appropriately authorised
bank / acquiring bank / PSP**, with whatever onboarding, certification and
compliance that arrangement legally requires. Building software is not the same
as being authorised to move money, and the two are tracked separately.

---

## 2. Business decision (LOCKED)

SpareLink does **not** want Cashfree or Razorpay as a mandatory third-party
gateway. It will operate its own orchestration layer.

| | |
|---|---|
| Cashfree | **NOT REQUIRED.** Legacy WEB code retained and isolated, marked `LEGACY / DISABLED / OPTIONAL PROVIDER`. **Not deleted** — deletion waits on verified replacement. No production payment depends on it. |
| Razorpay | **NOT REQUIRED.** Already permanently disabled upstream (three HTTP-410 routes). |
| Cost principle | Bank, UPI/acquiring, PSP and net-banking charges are acceptable. **Zero payment-rail charges are not promised**, and no MDR assumption is hard-coded. |

---

## 3. Flow

```
Customer
   ↓
WEB checkout  (or MOBILE, same API)
   ↓
SpareLink Payment Engine
   ├─ Firm Resolver        derives the firm from the order — never the client
   ├─ Payment Intent       amount, currency, method, idempotency key
   ├─ Firm Destination     the firm's own UPI / bank / acquirer destination
   ├─ Provider Adapter     UPI | Net Banking | Bank Transfer
   ↓
Authorised bank / PSP / acquirer infrastructure
   ↓  authoritative transaction confirmation
SpareLink Payment Engine
   ├─ Callback Adapter     authenticates; the rail's own claim is never trusted
   ├─ Verification         amount · currency · order · firm · reference · replay
   ↓
PAYMENT VERIFIED
   ↓
ERP Payment Service  →  postVoucher  →  allocatePayment  →  Ledger
   ↓
Order / invoice allocation, outstanding reduced
```

**The frontend success screen is not on that path.** It is a display, never an
accounting trigger.

---

## 4. Layers

| Layer | File | Responsibility |
|---|---|---|
| Domain core | `src/lib/payments/domain.ts` | States, firm resolution, trusted verification, allocation, refunds, reconciliation, idempotency keys |
| Provider abstraction | `src/lib/payments/provider.ts` | Adapter interface + registry |
| Guardrails | `src/lib/payments/provider.guardrail.test.ts` | Fails the build on a hard-coded provider, a custodial destination, a collected secret, a float in money |
| Schema | `prisma/schema.prisma` → `erp_payment*` | Persistence + 13 CHECK constraints |
| ERP boundary | **not yet built** | Calls `postVoucher` / `allocatePayment`. Blocked on B2. |

---

## 5. Non-negotiable properties

1. **Non-custodial.** No SpareLink account. Enforced by `assertFirmOwnedDestination`.
2. **Firm derived, never supplied.** `resolveFirm({ orderFirmId })`; a client claim
   that disagrees is refused.
3. **`SUCCESS` requires trusted proof.** Type-branded `TrustedVerification`,
   only producible by `verifyProviderCallback`.
4. **Integer paise only.** Reuses the existing branded `Paise`. No float, no decimal.
5. **Idempotent by construction.** `@@unique([firmId, idempotencyKey])` and
   `@@unique([provider, providerTransactionId])`.
6. **Audit without secrets.** No password, OTP, CVV, card number, full bank
   credential or raw provider body is stored anywhere.
7. **Bank/PSP agnostic.** One interface; providers arrive by configuration.

---

## 6. States

`CREATED · INITIATED · PENDING · SUCCESS · FAILED · EXPIRED · CANCELLED ·
REFUND_PENDING · REFUNDED · PARTIALLY_REFUNDED · RECONCILIATION_REQUIRED`

`SUCCESS` is unreachable by status update. `RECONCILIATION_REQUIRED` is a holding
state, not a failure, and can return a payment to where it came from.

---

## 7. Phases

| Phase | Scope | State |
|---|---|---|
| **A** Architecture | this document | ✅ |
| **B** Database / domain model | 6 tables, 13 CHECKs, migration | ✅ |
| **C** ERP payment service boundary | calls `postVoucher` | ⛔ **B2** — needs a firm cash/bank account |
| **D** Provider adapter interface | `PaymentProviderAdapter` + registry | ✅ |
| **E** Sandbox/mock UPI adapter | | ⛔ blocked on D→E sequencing; next |
| **F** Sandbox/mock net-banking adapter | | not started |
| **G** Reconciliation | classifier ✅ · persistence pending | partial |
| **H** WEB integration | | not started |
| **I** MOBILE integration | | not started |
| **J** Production bank/PSP | | requires authorised arrangement |
| **K** Certification / compliance | | requires J |
| **L** Production activation | | requires J + K + approval |

---

## 8. Prerequisites before Phase J

1. **B2** — real firm payment destinations. Placeholders cannot go live.
2. An authorised bank/PSP/acquirer arrangement, with its onboarding complete.
3. Signature scheme and key management agreed per provider.
4. Reconciliation feed from that provider.
5. Refund and chargeback process agreed.
6. Compliance review for the acquiring arrangement.
7. Explicit approval to activate real payment processing.

**None of these may be invented, and none has been.**
