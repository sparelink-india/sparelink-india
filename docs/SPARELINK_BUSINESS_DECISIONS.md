# SPARELINK INDIA — BUSINESS DECISIONS REGISTER

**Authoritative record of every business decision that governs implementation.**

| | |
|---|---|
| Established | 06-Oct-2026 |
| Owner | Business owner. Not an engineering decision. |
| Rule | **A decision is never invented by engineering.** Where a written requirement exists, it is applied and cited. Where none exists and the answer is legal or financial, work stops at that decision. |
| Companion | `docs/SPARELINK_MASTER_REQUIREMENTS.md` §4 |

---

## Summary

| # | Decision | Status |
|---|---|---|
| B1 | Payment gateway | ✅ **RULED — Cashfree NOT APPROVED**, superseded by B15 |
| B2 | Firm legal identity (GSTIN/PAN/address/bank) | ⛔ **OPEN — needs the business owner** |
| B3 | Firm state codes | ⛔ **OPEN — needs the business owner** |
| B4 | Inventory authority | ✅ **APPROVED — ERP item × godown** |
| B5 | Accounting authority | ✅ **RULED — ERP authoritative**, WEB ledger legacy |
| B6 | Credit semantics | ⛔ **OPEN — not invented** |
| B7 | WEB B2B-ERP admin modules | ✅ **RULED — transitional, retained** |
| B8 | BUSY company mapping | ⛔ **OPEN — never guess** |
| B9 | PO lifecycle | ✅ **RULED — preserve accepted statuses** |
| B10 | Real-party testing | ✅ **RULED — read-only first** |
| B11 | Account-credit checkout | ✅ **RULED — untouched** |
| B12 | Notifications | ✅ **RULED — provider-neutral architecture** |
| B13 | ERP first-release scope | ✅ **RULED** |
| B14 | Play Store release | ✅ **RULED - prepare, never publish** |
| B15 | Payment engine | ✅ **LOCKED - own orchestration, non-custodial, own no money** |

---

## B1 — Payment gateway: **Cashfree NOT APPROVED**

**Source of the decision:** existing written requirement, not a new ruling.

`SPARELINK_MASTER_REQUIREMENTS.md` §PAYMENT RULE:

> **PAYMENT RULE — NO PAID PAYMENT GATEWAY.** DO NOT integrate: Razorpay,
> Stripe, **Cashfree**, PayU, any paid third-party payment gateway. The user
> specifically does NOT want paid payment gateways.

**Resolution.** Cashfree is treated as **not approved**. The supported payment
paths are the ones the requirement actually asks for: firm-wise UPI, direct bank
transfer with bank instructions, and optional COD.

**Applied as:**

- The existing Cashfree implementation is **retained, not removed.** Removing a
  working, correctly-built capability that the owner may yet approve would be
  the irreversible action. Reversible action first.
- It is **gated**: it must not be relied upon as an approved production payment
  path.
- Razorpay is already permanently disabled upstream (three HTTP-410 routes) and
  stays that way — which is consistent with the requirement.
- WEB `AUDIT_report.md`'s claim that Razorpay is "SECURE" with HMAC verification
  is **false** and is treated as stale documentation.

**To change this:** the owner either amends §PAYMENT RULE to permit a named
gateway, or confirms removal. Either answer is a one-line change to this
register; the code work that follows is not trivial and should not be guessed.

---

## B4 — Inventory authority: **ERP item × godown** ✅ APPROVED 06-Oct-2026

**ERP is the single source of truth** for physical stock, reserved stock,
available stock, incoming stock, stock transfers, stock adjustments, stock
valuation, godown-wise stock, inventory movements, goods-receipt effects and
procurement stock effects.

**WEB `dealer_listing_id` must no longer be treated as the authoritative
inventory ledger.**

### Division of responsibility

| Concern | Owner |
|---|---|
| How much stock exists, and in which godown | **ERP** |
| How much of it is committed to an order | **ERP** |
| Valuation, average cost, FIFO layers | **ERP** |
| Sale price, discount, list price | WEB |
| Photos, description, brand, compatibility, visibility | WEB |
| Customer-facing presentation | WEB |

```
ERP ITEM (erp_item)  ← stock authority
   ↓ referenced by
WEB dealer_listing   ← commercial representation ONLY
```

### Standing constraints — binding on all future work

1. **No stock quantity may be destroyed, rewritten, or "migrated" by
   arithmetic.** Reconciliation first. Unexplained variance is **reported, never
   auto-resolved**.
2. **`dealer_listing` rows must not be deleted.** Only their role as a stock
   ledger is retired.
3. **Mapping uses stable references, never fuzzy name matching.** Part number
   alone is insufficient; brand, unit and HSN must be validated too.
4. **This approval does not report the migration as complete.** No cutover has
   occurred. WEB still holds the only live stock figures until reconciliation
   passes and cutover is separately approved.

### Why this decision exists

The reservation bug made the necessity concrete. `reserved_quantity` was written
in exactly one place in the entire ecosystem — `goods-receipt-service.ts:131`, as
`0`, at inventory row creation — so `available == physical` and `shortage` was
always `0`. A stock authority spread across two incompatible models, one of which
had no working reservation writer, could not be made correct.

---

## B5 — Accounting authority: **ERP authoritative** ✅ RULED

ERP is authoritative for accounting, ledger, receivables, payables and payment
allocation.

WEB `party_ledger_entry` is **legacy / transition data**:
- **not deleted**
- **not extended** — no new writes to it
- treated as **read-only pending reconciliation**

Deletion requires, in order: mapping complete → reconciliation complete → read
projection complete → rollback exists → cutover verified and approved.

---

## B6 — Credit semantics: ⛔ OPEN — NOT INVENTED

Two incompatible semantics exist today:

| System | Rule |
|---|---|
| WEB | `credit_limit_paise = 0` means **enforcement OFF**; a positive limit is enforced on **submitted** admin sales orders |
| ERP | `limitMode` defaults to **WARN**; measured against **invoice-wise outstanding** |

**Neither was changed.** Engineering will not invent a credit rule — it decides
whether a dealer is allowed to buy on credit, which is a commercial decision
with a direct financial consequence.

**Needed from the owner:** what does a zero limit mean, and what is the default
enforcement mode?

---

## B7 — WEB B2B-ERP admin modules: ✅ RULED — transitional

WEB's `0022`/`0023` migrations and its 7 B2B-ERP admin pages (sales orders,
purchase orders, goods receipts, credit, quotations, pricing rules) are
**transitional**. Not deleted. Retained until ERP replacement coverage is proven
function by function.

This is the largest single duplication in the ecosystem: two non-communicating
implementations of the same business domains. It is a migration risk, not a
defect to be removed on a whim.

---

## B8 — BUSY company mapping: ⛔ OPEN — NEVER GUESS

Only one mapping is evidenced by source data:

| BUSY company | Firm | Evidence |
|---|---|---|
| `COMP0005` | **HIND MOTORS** | `DATA/SameSeries/UserMapping.txt` names the company and FY 2026 |
| `COMP0004` | *unknown* | no evidence |
| `COMP0006` | *unknown* | the XML export that exists is `MASTER_COMP0005.DAT` |

WEB seeds `ledger_reference` as `BUSY-AMB` / `BUSY-HIN` / `BUSY-IND`, but nothing
in any repository records which BUSY company is which beyond Hind Motors.

**A wrong guess here mis-posts a whole company's ledger.** Verification required,
never inference.

**Needed from the owner:** confirm which BUSY company code corresponds to Ambaji
Traders and to India Sales.

---

## B9 — PO lifecycle: ✅ RULED — preserve working statuses

The accepted statuses are `draft`, `submitted`, `cancelled`, `received`. These
are preserved.

A 15-status lifecycle exists in `lib/procurement/po-lifecycle.ts` and is
imported by nothing but its own test. The 11 unreachable statuses are **not
wired** without a written requirement defining each transition, its permissions
and its accounting effect.

---

## B10 — Real-party testing: ✅ RULED — read-only first

Real-party data may be **read** during testing. **No production writes** without
explicit owner approval. This includes: accounting postings, stock movements,
payment posting, gateway calls, order creation, and any BUSY export contamination.

---

## B11 — Account-credit checkout: ✅ RULED — untouched

Existing functionality is left exactly as it is. No new payment or credit
semantics are invented. Whether account-credit checkout is built or dropped
remains a product decision for the owner.

---

## B12 — Notifications: ✅ RULED — provider-neutral

Architecture is provider-neutral. No commitment to push, WhatsApp or SMS
provider. **No provider credentials committed.** MOBILE push stays blocked while
there is no device-token endpoint.

---

## B13 — ERP first-release scope: ✅ RULED

Prioritise, in order: accounting · inventory · purchasing · procurement · GST ·
reporting · firm isolation · API.

---

## B14 — Play Store: ✅ RULED — prepare, never publish

Prepare a production release: signing, versioning, release AAB, device QA, crash
handling, deep links, `assetlinks.json`, Play assets, privacy policy. **Do not
upload or publish.** That is a separate, explicit approval.

---

## B15 — SpareLink Payment Engine: ✅ LOCKED — own orchestration, own no money

SpareLink will operate its **own payment orchestration layer**: checkout, payment
records, firm routing, transaction verification, reconciliation, refund records,
audit and ERP integration. **This decision does not depend on B2, B3, B6 or B8.**

### What SpareLink affirmatively decided

| Question | Ruling |
|---|---|
| Own payment orchestration | **YES** |
| Cashfree | **NOT REQUIRED** — legacy code retained, isolated, `LEGACY / DISABLED / OPTIONAL PROVIDER`. **Not deleted.** |
| Razorpay | **NOT REQUIRED** — already permanently disabled upstream |
| Provider dependency in the core engine | **NONE** — adapters only; a provider name in engine source fails the build |
| SpareLink bank account | **DOES NOT EXIST** |
| SpareLink-held customer funds | **NONE** — no custody, wallet, settlement account, pool or escrow |
| Settlement route | **Direct to each firm's own bank / payment destination** |
| Firm resolution | **Server-side, from the order/invoice.** A client `firmId` is a claim to check, never authority |
| Money arithmetic | **Integer paise only.** No floating point, ever |
| Accounting effect | **ERP only**, via existing `postVoucher` / `allocatePayment`. The engine never writes ledger rows |
| `BANK_TRANSFER` + UTR | **Not verified by submission alone** — `PENDING_VERIFICATION` until a statement or manual check |
| Payment-rail costs | Bank / acquiring / UPI / PSP / net-banking charges acceptable. **Zero charges NOT promised.** No MDR hard-coded |

### What is explicitly not claimed

SpareLink Payment Engine is a proprietary software and orchestration layer. It is
**NOT** an RBI-authorised Payment Aggregator and **NOT** NPCI-certified, because no
such authorisation or certification exists. Production UPI and net-banking
connectivity must go through an appropriately authorised bank / acquiring bank / PSP
with whatever onboarding, certification and compliance that legally requires.

**No approval is fabricated anywhere in this repository.**

### Relationship to B1

B1 is **not reversed** — it is strengthened. Cashfree was "not approved by an
existing written requirement"; it is now "not required, because there is an
affirmative alternative". The legacy code stays in place either way. Deleting a
working implementation before the replacement is verified is the irreversible
choice, and it is not the right one.

### How this affects B2

B2 does **not** block the engine's design, code or tests — firm ids and
destinations are used as configuration placeholders, and a placeholder destination
**defaults to inactive** so it cannot receive a payment.

What B2 blocks is **activation**: real destinations (UPI ID, account number, IFSC,
account name), and therefore Phase J onward. B2 already lists all of these as
required fields.

---

## ⛔ Decisions still required from the business owner

Three remain, and all three are legal or commercial facts that engineering must
not invent.

### B2 — Firm legal identity

Required per firm: **GSTIN, PAN, registered address, state + state code, bank
name, account name, account number, IFSC, branch, UPI ID, invoice prefix, logo,
signature.**

**The current state is contradictory across four sources and is reported, not
reconciled:**

| | WEB | ERP seed | ERP readiness doc | BUSY source |
|---|---|---|---|---|
| Ambaji GSTIN | `23BYNPA1789A1ZQ` (published live) | `24AAAAA0000A1Z5` (explicit placeholder) | PENDING | — |
| Hind Motors GSTIN | `23AARPA8557FZ1M` (published live) | `24BBBBB1111B1Z5` (placeholder) | PENDING | — |
| India Sales GSTIN | `23EKAPA4186F1ZL` (published live) | `27CCCCC2222C1Z5` (placeholder) | PENDING | — |
| State code | 23 / 23 / 23 | 24 / 24 / 27 | PENDING | MP parties |
| Bank details | **real**, held in WEB | **PENDING, deliberately not invented** | PENDING | — |
| PAN | embedded in GSTIN only | never seeded | PENDING | — |
| India Sales legal name | "India Sales" | "India Sales Corporation" | — | — |

WEB currently **publishes three GSTINs in state 23 (Madhya Pradesh)** on the live
public storefront, while the ERP is seeded with placeholders in states 24/24/27,
the ERP's own readiness document declares every GST field PENDING, the ERP's BUSY
data points to Madhya Pradesh parties, and the MOBILE Play listing describes the
business as being in Gujarat.

**No firm data was changed. No value was invented.**

### B3 — Firm state codes

Directly follows B2. The state code determines the GST place-of-supply split
(CGST+SGST vs IGST), so every tax invoice depends on it.

**Needed:** the actual state for each firm.

### B6 — Credit semantics

See above.

### B8 — BUSY company mapping

See above.

---

## Change log

| Date | Change |
|---|---|
| 06-Oct-2026 | Register established. B4 approved and recorded in full. B1 resolved by existing requirement. B5, B7, B9, B10, B11, B12, B13, B14 ruled with safe defaults that preserve existing behaviour. B2, B3, B6, B8 recorded as still open, with the exact facts needed. |
