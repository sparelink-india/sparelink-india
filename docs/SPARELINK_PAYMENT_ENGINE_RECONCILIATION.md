# SPARELINK PAYMENT ENGINE — RECONCILIATION

**Status: CLASSIFIER TESTED · PERSISTENCE PARTIAL · NO FEED CONNECTED**
Established 06-Oct-2026

---

## 1. What reconciliation is for

Four independent records describe one payment. They can disagree, and when they do
one of them is wrong:

```
SpareLink payment record
        vs
provider / acquirer transaction
        vs
firm bank or payment settlement evidence
        vs
ERP ledger posting
```

Reconciliation's job is **to name the disagreement accurately and refuse to guess
which record is right.** It never repairs silently. A silent repair destroys the
evidence that something went wrong, and the thing that went wrong is usually the
one worth knowing about.

---

## 2. The four-way comparison

| Compared | Against | Question |
|---|---|---|
| `paymentAmountPaise` | `providerAmountPaise` | Did the rail move the amount we asked for? |
| `providerTransactionId` | settlement reference | Can this payment be tied to a bank credit at all? |
| `paymentFirmId` | `settlementFirmId` | Did the money land in the legally responsible firm's account? |
| verified payment | `erpPosted` | Has the verified payment actually reached the ledger? |

Firm comparison is the one most specific to SpareLink's three-firm structure, and
it is checked separately from amount: money of the right amount in the wrong legal
entity is a materially different problem from money of the wrong amount, and both
occur.

---

## 3. Statuses

All nine are declared in `RECONCILIATION_STATUSES` and in the `ReconciliationState`
enum.

| Status | Meaning | Precedence |
|---|---|---|
| `DUPLICATE` | This provider transaction already belongs to another payment | **1 — checked first** |
| `MISSING_PROVIDER_REFERENCE` | No provider reference exists, so no settlement tie is possible | 2 |
| `FIRM_MISMATCH` | Money settled to a firm other than the one owed | 3 |
| `AMOUNT_MISMATCH` | Provider reported a different amount | 4 |
| `MISSING_ERP_POSTING` | Verified, but nothing reached the ledger | 5 |
| `PENDING` | Awaiting a provider amount or a settlement record | 6 |
| `MATCHED` | All four agree | last |
| `MISMATCH` | General discrepancy | reserved for a future composite check |
| `MANUAL_REVIEW` | Reserved for human-directed cases | assigned by a person, never inferred |

### Why precedence is explicit

`DUPLICATE` is checked before everything else deliberately. A duplicate is a
*structural* fact — this transaction is already accounted for — and reporting it as
`AMOUNT_MISMATCH` because the two payments happen to differ in amount would
misdescribe it and send a person to the wrong investigation.

The order is the order a person should investigate in: is this the same money twice
(a structural problem), then can it be tied at all, then did it go to the right
legal entity, then is the amount right, then did it reach the books.

---

## 4. Implementation

**Done and tested:** `classifyReconciliation` in `src/lib/payments/domain.ts`.
Pure, deterministic, no I/O — so every branch is provable without a bank feed.

Covered by test: `MATCHED`, `DUPLICATE`, `MISSING_PROVIDER_REFERENCE`,
`FIRM_MISMATCH`, `AMOUNT_MISMATCH`, `MISSING_ERP_POSTING`, both `PENDING` paths,
and that the status set has no duplicates.

**Partially done:** `erp_payment.reconciliation` and `erp_payment.reconciliationNote`
persist a verdict. What is **not** built: a reconciliation *run*, a feed poller, an
exception queue, or an operator screen.

**Not done:** anything that reads a bank statement or a provider report.

---

## 5. What is deliberately absent

| Not built | Why |
|---|---|
| Auto-repair | A mismatch repaired without a record is a defect that reports success. |
| Auto-accept on settlement | Matching bank credit is not proof of *whose* money, absent a reference. |
| Tolerance bands | A "close enough" amount rule is how rounding becomes unexplained variance. Amounts are integer paise and must match exactly. |
| Silent ERP back-posting | Posting is the ERP's decision, made through `postVoucher`, not a reconciliation side effect. |

---

## 6. Bank statement reconciliation — the honest position

For `BANK_TRANSFER`, a customer submits a UTR. **A submitted UTR is not a verified
payment.** The flow is:

```
Order → firm bank details → customer transfers → UTR submitted
     → PENDING_VERIFICATION
     → bank statement / bank API / manual check
     → VERIFIED
     → ERP posting
```

Manual verification remains available and remains legitimate — a human comparing a
UTR against a bank statement is a real control, not a workaround. What is forbidden
is marking a payment `SUCCESS` because a UTR was submitted.

Without a bank feed there is no automated statement matching, so today the
`BANK_TRANSFER` reconciliation step is **manual by design**, and the engine records
the verdict either way.

---

## 7. Prerequisite

A settlement feed requires one of:

1. A bank API with a machine-readable statement, or
2. An authorised provider with a reconciliation report, or
3. A manual import of a statement, parsed and matched.

None exists. This is Phase G completion and it needs **B2** — there are no real
firm destinations to reconcile against, only placeholders that are inactive by
default.
