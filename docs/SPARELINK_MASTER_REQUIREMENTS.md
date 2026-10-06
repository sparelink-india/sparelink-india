# SPARELINK INDIA — MASTER REQUIREMENTS & STATUS (AUTHORITATIVE)

**This is the single authoritative cross-project document.** It supersedes every
other status document in all three repositories for the purpose of *what is true
now*. Where an older document contradicts this one, this one is correct and the
older document is stale.

| | |
|---|---|
| Established | 06-Oct-2026 |
| Supersedes | `docs/admin-ui-modernization-map.md`, `AUDIT_REPORT.md` (WEB); `docs/roadmap.md` §status, `README.md` §status, `docs/database.md`, `docs/imports.md`, `docs/gst.md`, `docs/security.md` (ERP); `docs/MOBILE_PHASE_STATUS.md`, `docs/MOBILE_API_MAP.md`, `docs/MOBILE_ARCHITECTURE.md` (MOBILE) |
| Preserved as origin | root `SPARELINK_MASTER_REQUIREMENTS.md` (the original WEB requirements brief, 1307 lines, never carried status markers) |
| Evidence rule | A feature is DONE only with UI + API + service + database + authorization + test + real data flow. Anything less is PARTIAL. |
| Companion documents | `docs/SPARELINK_BUSINESS_DECISIONS.md` (decision register incl. B2/B3 conflicts) · `docs/SPARELINK_FINAL_PRODUCTION_READINESS.md` (gate results) · `docs/SPARELINK_PAYMENT_ENGINE_{ARCHITECTURE,SECURITY,API,RECONCILIATION}.md` (payment engine) |

---

## 1. BUSINESS REQUIREMENTS

### 1.1 What the business is

SpareLink India is a wholesale automotive spare-parts business trading through
**three separate legal firms** — Ambaji Traders, Hind Motors and India Sales —
which sell, invoice and take payment separately. It sells to two kinds of
buyer: individual workshops and garages (B2C) and registered dealers who
resell (B2B). It is migrating its accounting off BUSY.

### 1.2 Governing constraints, restated from the original brief

These are requirements, not suggestions. Several are currently violated by the
code — see §9.

- **R1** The three firms remain separate throughout. Never mix payment
  information between firms. Architecture must allow a fourth firm later.
- **R2** Never store card numbers, CVV, ATM PIN, UPI PIN or net-banking
  passwords.
- **R3** Never fake an external integration. Never fake a legal claim, a
  verification result, or a GST registration.
- **R4** Never invent a business quantity, date or promise. An ETA is only ever
  populated from data that already exists.
- **R5** Do not seed historical receivables from BUSY or spreadsheets without an
  explicit, approved import project.
- **R6** A purchase suggestion is advice. Nothing auto-orders.
- **R7** Do not duplicate an existing working system.

### 1.3 The payment-gateway contradiction (RESOLVED — see §4.2 B1)

The original brief states, at R2's own section:

> **PAYMENT RULE — NO PAID PAYMENT GATEWAY.** DO NOT integrate: Razorpay,
> Stripe, **Cashfree**, PayU, any paid third-party payment gateway. The user
> specifically does NOT want paid payment gateways.

The code integrates Cashfree in production: four routes, raw-body webhook
signature verification, per-firm credentials, and a production environment
document that makes `CASHFREE_ENVIRONMENT=production` mandatory. Razorpay is
correctly and permanently disabled (three HTTP-410 stubs).

`AUDIT_REPORT.md` additionally claimed Razorpay was "SECURE" with HMAC
verification. There is no Razorpay code at all. That document is false.

**This is not a bug to fix. It is a contradiction to resolve.** Until B1 is
answered, the payment architecture cannot be called settled.

---

## 2. ARCHITECTURE

### 2.1 Target

```
BUSY (existing external accounting)
  ↓
BUSY integration layer — parse, map, validate, idempotency, reconcile
  ↓
ERP — authoritative: stock, valuation, ledgers, accounting, GST figures,
      business documents, purchasing, procurement, firm accounting config
  ↓
authenticated versioned API  (read + controlled write, per firm)
  ↓
WEB — authoritative: commerce UX, catalogue presentation, cart, checkout,
      customer order experience, customer/dealer commerce workflows
  ↓
MOBILE — native client of WEB and, later, of the ERP API
```

### 2.2 Current reality (verified 06-Oct-2026)

```
WEB (Next 16.3.5 · better-auth · Drizzle · Postgres)  ← MOBILE's only backend
  145 API routes, 28 admin dirs, 31 migrations
        │  75 HTTPS endpoints, cookie + Bearer
        ▼
MOBILE (Expo 57 · RN 0.86.3 · SecureStore · biometric)
        ✗ zero endpoints to ERP
        ╳
ERP (Next 16.3.8 · Prisma · 57 models · 3 route handlers) — NOT DEPLOYED
        ╳ reads nothing from
BUSY (DATA/, busy_export/ — 3 real companies, ~228 MB, one real XML sample)
```

**There is no shared backend.** The ERP exposes exactly three route handlers:
`/api/health`, `/api/jobs/run` (bearer-token, internal scheduling) and one
session-gated document PDF. All 47 business operations are React Server Actions
bound to its own UI. `api.view` and `api.keys.manage` permissions exist with no
API-key model, table or minting code.

---

## 3. SOURCE OF TRUTH

| Domain | Owner **now** | Owner **target** | Conflict today |
|---|---|---|---|
| Authentication | WEB (`better-auth`) | see B12 note | 3 separate systems |
| Customers | WEB `user` (role=buyer) | ERP `erp_account` | no mapping |
| Dealers | WEB `dealer` table | ERP `erp_account.isDealer` | no mapping |
| Suppliers | WEB `supplier` | ERP `erp_account.isSupplier` | no mapping |
| Firms | WEB 3 literal ids `firm-ambaji-traders`/`-hind-motors`/`-india-sales`, codes `AMB`/`HIN`/`IND` | ERP `erp_firm` uuid(7), codes `AMB`/`HMD`/`INS` | **`HIN` vs `HMD`** |
| Catalogue | WEB `part` + `dealer_listing` | ERP `erp_item` | **no mapping table exists** |
| Pricing | WEB tiered off `dealer.price_group` | ERP item master | different models |
| GST | WEB per-line at checkout; ERP per-rate-band | ERP | 3 implementations |
| Inventory | WEB `inventory` by **`dealer_listing_id`** (legacy) | ERP `erp_item_valuation` by **item × godown** | **B4 RESOLVED — ERP is authority. WEB inventory is legacy pending reconciliation.** See §4.1 |
| Reserved stock | nothing (column only) | ERP | **never written in any project** |
| Orders | WEB | WEB (commerce) then ERP document | — |
| Invoices | WEB PDF, `SLA-<order>-<FIRM6>` | ERP numbering series | incompatible schemes |
| Payments — orchestration | WEB (Cashfree + UTR) | **ERP — SpareLink Payment Engine** | two sources; engine foundation built, not routed. See §4.4 |
| Payments — accounting | WEB `party_ledger_entry` (legacy) | **ERP `postVoucher` / `allocatePayment`** | **B5 RULED: ERP authoritative.** Engine must never write ledger rows |
| Ledger | WEB `party_ledger_entry` **and** ERP `erp_ledger_entry` | ERP | **two AR ledgers — see B5 (RULED: ERP authoritative)** |
| Credit | WEB `dealer.credit_limit_paise` | ERP `creditLimit` | 0 ⇒ OFF vs WARN default — see B6 |
| Demand / shortage | WEB code only | ERP | see §7 |
| Accounting | ERP | ERP | WEB has no engine |
| Notifications | **nowhere** | shared service | missing entirely |

---

## 4. BUSINESS DECISIONS

### 4.1 B4 — APPROVED 06-Oct-2026: ERP item × godown is the authoritative inventory

**Decision.** ERP `item` × `godown` is the single source of truth for:

- physical stock
- reserved stock
- available stock
- incoming stock
- stock transfers
- stock adjustments
- stock valuation
- godown-wise stock
- inventory movements
- goods-receipt effects
- procurement stock effects

**WEB `dealer_listing_id` must no longer be treated as the authoritative
inventory ledger.**

**Division of responsibility, stated explicitly so it is never re-litigated:**

| Concern | Owner | Stored where |
|---|---|---|
| How much stock exists, and where | **ERP** | `erp_item_valuation`, `erp_stock_movement`, `erp_stock_valuation_layer` |
| How much is committed to an order | **ERP** | reservation, ERP-side |
| Valuation and cost | **ERP** | `erp_item_valuation.averageCost` / `totalValue` |
| Price, discount, list price | **WEB** | `dealer_listing` |
| Photos, description, brand, compatibility, visibility | **WEB** | `dealer_listing`, `part` |
| Customer-facing presentation | **WEB** | WEB |

```
ERP ITEM (erp_item)
   ↓ referenced by
WEB PRODUCT / DEALER LISTING   ← commercial representation ONLY
   → price, photos, description, brand, compatibility, visibility
```

**Standing constraints on this decision:**

1. **No existing stock quantity may be destroyed, rewritten or "migrated" by
   arithmetic.** Reconciliation comes first; unexplained variance is reported,
   never auto-resolved.
2. **`dealer_listing` rows are NOT to be deleted.** They remain the commercial
   representation. Only their role as a stock ledger is retired.
3. **Mapping is by stable reference, never by fuzzy name.** Part number alone is
   not sufficient — it must be validated against brand, unit and HSN.
4. This decision **authorises the target architecture. It does not report the
   migration as complete.** No cutover has occurred. WEB inventory still holds
   the only live stock figures until reconciliation passes and a cutover is
   separately approved.

### 4.2 B1 — RULED: Cashfree is NOT APPROVED (superseded by B15)

The governing requirement at `SPARELINK_MASTER_REQUIREMENTS.md` §PAYMENT RULE
is explicit and predates the code:

> **PAYMENT RULE — NO PAID PAYMENT GATEWAY.** DO NOT integrate: Razorpay,
> Stripe, **Cashfree**, PayU, any paid third-party payment gateway. The user
> specifically does NOT want paid payment gateways.

Cashfree is therefore treated as **NOT APPROVED** unless the user explicitly
changes this decision. This is not a new ruling — it is the existing written
requirement being applied to code that contradicts it.

**Operational consequence, and it is deliberate:** the existing Cashfree code is
**retained but must not be treated as an approved production payment path.**
It stays isolated and gated. It is **not removed** in this cycle, because
removing it would take away a working, correctly-implemented capability that the
user may yet approve; the reversible action is to stop *relying* on it, not to
destroy it. The order is therefore: confirm the requirement → keep COD and bank
transfer as the supported paths → remove or activate Cashfree only on an
explicit decision.

**Reinforced 06-Oct-2026 by explicit ruling (see §4.4).** The business has now
stated the decision directly rather than leaving it to be inferred from the
prohibitions: SpareLink will operate its **own payment orchestration layer**, and
Cashfree and Razorpay are **NOT REQUIRED**. This does not reverse §4.2 — it
removes the remaining possibility that Cashfree might later be approved, and
replaces it with an affirmative alternative.

### 4.3 B15 — LOCKED 06-Oct-2026: SpareLink Payment Engine (own orchestration, non-custodial)

SpareLink will own its payment *orchestration*: checkout, payment records, firm
routing, verification, reconciliation, refund records, audit and ERP integration.

**What is affirmatively decided**

| Question | Ruling |
|---|---|
| Own payment orchestration | **YES.** SpareLink builds and owns the software layer. |
| Cashfree | **NOT REQUIRED.** Legacy WEB code retained, isolated, marked `LEGACY / DISABLED / OPTIONAL PROVIDER`. **Not deleted.** |
| Razorpay | **NOT REQUIRED.** Already permanently disabled upstream. |
| Provider dependency in the core engine | **NONE.** Adapters only; a provider name in engine source fails the build. |
| SpareLink bank account | **DOES NOT EXIST.** |
| SpareLink-held customer funds | **NONE.** No custody, no wallet, no settlement account, no pool, no escrow. |
| Settlement route | **Direct to each firm's own bank / payment destination.** Ambaji order → Ambaji account, always. |
| Firm resolution | **SERVER-SIDE from the order/invoice.** A client-supplied `firmId` is a claim to be checked, never authority. |
| Money arithmetic | **Integer paise only.** No floating point, ever. |
| Accounting effect | **ERP only**, via the existing `postVoucher` / `allocatePayment`. The engine must not write ledger tables. |
| `BANK_TRANSFER` + UTR | **Not verified by submission alone.** A UTR is evidence, not proof; `PENDING_VERIFICATION` until a statement or manual check. |
| Payment-rail costs | Bank / acquiring / UPI / PSP / net-banking charges are acceptable. **Zero payment-rail charges are NOT promised.** No MDR is hard-coded. |

**What is explicitly *not* claimed**

SpareLink Payment Engine is a proprietary software and orchestration layer. It is
**NOT** an RBI-authorised Payment Aggregator and **NOT** NPCI-certified, because no
such authorisation or certification exists. Building software is not the same as
being authorised to move money. Production UPI and net-banking connectivity must
go through an appropriately authorised bank / acquiring bank / PSP with whatever
onboarding, certification and compliance that legally requires.

"No approval is fabricated anywhere in this repository."

**Documented in** `SPARELINK_PAYMENT_ENGINE_ARCHITECTURE.md` ·
`_SECURITY.md` · `_API.md` · `_RECONCILIATION.md`.

**B15 does NOT require B2, B3, B6 or B8.** Firm ids and destinations are used as
configuration placeholders. What B2 blocks is *activation*, not design — a
placeholder destination defaults to inactive and cannot receive a payment.

### 4.4 Remaining decisions — status after 06-Oct-2026

Decisions below are marked by what they **block**, and by the ruling that
applies while they remain open. No legal or financial fact is invented.

| # | Decision | Status | Ruling applied while open |
|---|---|---|---|
| **B1** | Cashfree approved or prohibited | **RULED — NOT APPROVED, and superseded by B15** | Code retained, isolated and gated; marked `LEGACY / DISABLED / OPTIONAL PROVIDER`. **Not deleted.** Not an approved production path. See §4.2. |
| **B15** | Payment engine ownership | **✅ LOCKED** | SpareLink operates its **own orchestration layer**. Non-custodial. Provider-agnostic. ERP owns all accounting effect. See §4.3. |
| **B2** | Firm GSTIN / PAN / state / address / bank | **OPEN — needs the user** | **No value invented.** WEB holds real bank details; ERP declares every business field PENDING and deliberately left them uninvented. Conflicts reported in §5. |
| **B3** | Firm state codes | **OPEN — needs the user** | Four sources disagree: WEB 23/23/23, ERP seed 24/24/27, ERP BUSY data is MP, Play listing says Gujarat. Not reconciled by guess. |
| **B4** | Inventory authority | **✅ APPROVED** | ERP item × godown. See §4.1. |
| **B5** | Accounting authority | **RULED** | **ERP is authoritative** for accounting, ledger, receivables, payables. WEB `party_ledger_entry` is **legacy/transition data**, retained, not extended, not deleted. |
| **B6** | Credit semantics | **OPEN — not invented** | Existing behaviour preserved exactly. `0 ⇒ enforcement OFF` (WEB) and `WARN` default (ERP) both stay until the final rule is written. |
| **B7** | WEB B2B-ERP admin modules | **RULED** | **Transitional. Not deleted.** Retained until ERP replacement coverage is proven. |
| **B8** | BUSY company mapping | **OPEN — never guess** | Only `COMP0005 = HIND MOTORS` is evidenced by `DATA/SameSeries/UserMapping.txt`. The other two are unverified and will not be inferred. |
| **B9** | PO lifecycle | **RULED** | Currently accepted statuses (`draft`, `submitted`, `cancelled`, `received`) preserved. The 11 unreachable statuses are **not wired** without a written requirement. |
| **B10** | Real-party testing | **RULED** | **Read-only first. No production writes** until explicit approval. |
| **B11** | Account-credit checkout | **RULED** | **Existing functionality untouched.** No new payment or credit semantics invented. |
| **B12** | Notifications | **RULED** | **Architecture provider-neutral.** No commitment to a push/WhatsApp/SMS provider; no provider credentials committed. |
| **B13** | ERP first-release scope | **RULED** | Prioritise: accounting, inventory, purchasing, procurement, GST, reporting, firm isolation, API. |
| **B14** | Play Store release | **RULED** | **Prepare the release. Do NOT publish.** No upload, no deployment. |

### Rules applied while a decision is open

Safe defaults so work is not blocked by indecision. Each is reversible locally.

- **B2/B3 open ⇒ print what is configured, mark what is a placeholder.** No
  GSTIN, PAN, address or bank value is invented, and no firm's data is changed.
- **B6 open ⇒ keep both semantics as coded.** Neither is changed.
- **B8 open ⇒ verify company mappings, never assume.**
- **B4 approved ⇒ ERP is the stock authority, but NO stock is migrated by
  arithmetic.** Reconciliation precedes any cutover.
- **B5 ruled ⇒ WEB's ledger becomes read-only legacy.** No reconciliation is
  claimed until one actually passes.

---

## 5. FIRM RULES

Three legal entities. Separation is a hard requirement (R1).

| | WEB | ERP | BUSY source |
|---|---|---|---|
| Ambaji code | `AMB` | `AMB` | unknown |
| Hind Motors code | `HIN` | **`HMD`** | `COMP0005` |
| India Sales code | `IND` | `INS` | unknown |
| GSTIN | published, state **23** | **explicit placeholders**, state 24/24/27 | — |
| Bank details | **real**, in `bank details.txt` | **PENDING, deliberately not invented** | — |
| Proprietor | Ansh / Dharmesh / Tanmay Anand | **not modelled** | — |
| ERP readiness | n/a | every business field PENDING; only name + FY configured | — |

**Three state codes across four sources.** Unchanged pending B2/B3.

Firm isolation is **application-level only in both systems.** Zero
`ROW LEVEL SECURITY` in WEB's 31 migrations or ERP's 17. ERP's
`FIRM_SCOPE_KEYS` covers 23 of 43 firm-owned models; **19 firm-owned models get
no scope injection or mismatch detection**, contradicting ERP's own
`security.md`. WEB's dealer routes are scoped by `dealerId`, **not by firm**.

---

## 6. API CONTRACTS

| | Count | State |
|---|---|---|
| WEB API routes | 145 | working; rate-limited; CSP + security headers present |
| MOBILE endpoint bindings | 75 | **all resolve to existing WEB routes**; zero mocks |
| WEB routes with no client | ~89 | WEB is well ahead of MOBILE |
| ERP route handlers | **3** | none usable by WEB or MOBILE |
| ERP Server Actions | 47 | all require a session; none API-key reachable |
| Versioned API | **0** in all three | — |
| OpenAPI / contract tests | **0** | — |

MOBILE is architecturally immune to the WEB admin-login defect: it never sends
`expectedRole` and resolves its route from the server-provided role. Its role
resolution is server-authoritative and should be preserved.

Known contract fragilities, all currently aligned: `GET /api/admin/payments`
returns `{orders:…}` not `{payments:…}`; `DELETE /api/cart` and
`DELETE /api/wishlist` carry ids in a JSON body; `POST /api/orders/{id}/payment`
is multipart and mixes order (path) with firm allocation (field); MOBILE holds
the checkout `Idempotency-Key` in a `useRef`, so a crash-retry can duplicate an
order; CGST/SGST are named on the invoice but printed as one combined amount.

---

## 7. INVENTORY, RESERVATION, DEMAND, PROCUREMENT

### 7.1 The reservation finding — read this first

WEB implements the required rule exactly:

```
available = MAX(physical - reserved, 0)
shortage  = MAX(requested - available, 0)
```

`lib/procurement/demand.ts:56-60`. Its own header at `:13` concedes
*"Nothing here writes it."*

**`reserved_quantity` is written in exactly one place in the entire ecosystem:
`lib/goods-receipt-service.ts:131`, as `0`, at inventory-row creation.** ERP is
identical — 8 reads, 0 writes.

So `available == physical` and `shortage == 0`, always, everywhere. The worked
example from the brief — physical 100, reserved 70, requested 50, shortage 20 —
in reality reports **shortage 0**, because reserved is 0.

**No purchase requirement is ever raised by real unmet demand.** This is the
single most consequential unfixed defect found.

### 7.2 Demand migration 0030

`drizzle/migrations/0030_demand_capture.sql` exists; the journal ends at
`0029`. The file's own header states this is deliberate and unreviewed-for-prod.
Therefore **`part_demand` and `purchase_requirement` do not exist in any
database**, while routes, services, an admin page and tests are written against
them. Code exists; schema does not.

0030 is additive only (CREATE TABLE / CREATE INDEX, no DROP/DELETE/UPDATE) and
is well-constrained — including
`fulfilled + allocated <= requested` and a pinned status vocabulary. Applying it
is safe under the B4 decision, because demand aggregates against the stock model,
model.

### 7.3 Procurement

PO accepts only `draft | submitted | cancelled | received`. A full 15-status
lifecycle exists in `lib/procurement/po-lifecycle.ts` and is imported by nothing
but its own test. Absent: discount, closure, partial dispatch, PDF, WhatsApp
(validator exists, zero callers). Partial goods receipt **is** genuinely
end-to-end, with over-receipt blocked and an idempotency key.

**Conflicting goods-receipt rule:** WEB increases stock only when the PO line
carries a `dealer_listing_id`; ERP increases stock on item × godown with no
listing concept. They cannot interoperate. Resolved by B4 in favour of ERP; the WEB-side rule is legacy and is retired only after reconciliation.

### 7.4 Stock taking

**Absent in all three projects.** Each has *stock adjustment* (set a quantity);
none has *stock taking* (count a sheet, compute variance, approve). The 9k+ item
requirement is unmet everywhere.

---

## 8. SECURITY RULES & STATE

| Control | WEB | MOBILE | ERP |
|---|---|---|---|
| Rate limiting | **present**, durable Postgres, IP + account, 10 auth policies, 18 call sites | n/a | auth-specific only |
| Auth | `better-auth` | consumes WEB + SecureStore | hand-rolled, scrypt N=16384 |
| Session revocation | password change; suspend deletes all sessions | sign-out | full, incl. in-transaction on reset |
| Firm isolation | **app-level only, no RLS** | n/a | 4 layers, **19 models uncovered** |
| Audit write path | present | n/a | present + viewer |
| Audit coverage gaps | **checkout, UTR, suspend — now fixed 06-Oct** | — | — |
| Device attestation | — | **absent** | — |
| Certificate pinning | — | **absent** | — |
| CORS | absent | n/a | absent (`connect-src 'self'`) |
| Secret handling | `BETTER_AUTH_SECRET` unset in example | **keystore password plaintext on disk** | `SESSION_SECRET` inert (signs nothing) |

---

## 9. FEATURE STATUS

Status vocabulary: **DONE** (all seven layers) · **PARTIAL** · **BROKEN** ·
**MISSING** (nowhere) · **BLOCKED** · **FUTURE** · **UNCERTAIN**.

### 9.1 Genuinely end-to-end (DONE)

WEB checkout · WEB Cashfree (raw-body webhook verification, amount triple-check,
`FOR UPDATE`, replay-safe) · WEB per-firm bank transfer with
`pg_advisory_xact_lock` for global UTR uniqueness · WEB partial goods receipt ·
WEB rate limiting · WEB authorization on all 57 admin routes · ERP accounting
engine (atomic, row-locked, cancel/reverse, paise-only) · ERP firm isolation
core · ERP backup/restore/retention · ERP GST figures · ERP stock transfers
(both legs atomic) · MOBILE transport layer · MOBILE SecureStore + biometric
gate · MOBILE API binding (75 endpoints, zero mocks) · MOBILE guardrails (now
actually enforced — see §11).

### 9.2 PARTIAL

Catalogue search (503 if `TYPESENSE_HOST` unset, **no SQL fallback**) · returns
(no restock/credit) · warranty (**no PATCH handler — claims cannot be
resolved**) · dealer KYC (free-text, no documents, no GSTIN validation) · dealer
quick order (MOBILE submission disabled) · customer ledger (admin-only in WEB,
absent in MOBILE) · demand & procurement (code complete, migration unapplied) ·
PO · reports (WEB/MOBILE return counts only) · Hindi (**WEB garbled**; hardcoded
English at `search-experience.tsx:640-667`) · Play Store · BUSY import (service
without UI, no XML parser) · notifications (nothing).

### 9.3 BROKEN

Shortage always reports 0 (reserved never written) · migration 0030 un-journalled
· MOBILE `LedgerScreen` calls no API · mobile search filters non-functional
(`hidden md:block`) · WEB dark-theme contrast 1.05–2.04:1 · WEB black-on-black
product text · ERP COGS bypasses `postVoucher` (a second posting path) · ERP
`"use server"` modules export non-functions to client components · WEB warranty
unresolvable · WEB admin login at `/login/dealer` charges the admin's lockout
budget · ERP login lockout 8 in code vs 5 documented, and `LoginAttempt` is
never written by the login flow.

### 9.4 MISSING — exists in no project

**Stock taking** · **supplier confirmation** · **notifications / push** ·
**AI search** · **ERP external API** · **BUSY automatic sync** · **off-site
backup** · **error monitoring** · customer-facing warranty resolution · returns
restocking · shared notification service · cross-project contract tests · WEB
audit viewer · WEB roles/permissions UI · customer account-credit checkout ·
customer order cancellation · invoice list · serviceability/pincode check ·
WEB/MOBILE password reset.

---

## 10. MIGRATION & DEPLOYMENT STATUS

| | WEB | ERP | MOBILE |
|---|---|---|---|
| Migrations | 31 files, **journal ends 0029** | 17 folders, 57 tables | n/a |
| Unapplied | **0030_demand_capture** (by design) | — | — |
| Production DB | Neon, partially migrated | **not provisioned** | n/a |
| Deployed | partially | **nothing deployed** | never |
| DNS | live | not configured | — |
| Off-site backup | n/a | **absent** | n/a |
| Scheduled jobs | 3 crons, `CRON_SECRET` unset | cron cannot run backups on serverless; runner unscheduled | n/a |
| Tests | 1475 / 1443 pass / **0 fail** / 32 skipped | 57 files (36 unit + 21 integration) | 565 / 33 suites pass |
| Build | passes (log stale — 34 routes vs 145) | passes | AAB built, **debug-signed** |
| Typecheck | clean | clean | clean |
| Lint | clean | clean | clean |

---

## 11. CHANGE HISTORY

### 06-Oct-2026 — Payment Engine foundation (parallel workstream)

**ERP** `7af89f0` · Business decision **B15 LOCKED** (see §4.3)

SpareLink owns its payment **orchestration**. Owns **no money**.

- **Domain core** — `src/lib/payments/domain.ts`. Strict state machine across all
  11 states; `SUCCESS` is unreachable without a type-branded `TrustedVerification`
  that only the callback verifier can produce. Firm resolution takes the order's
  firm and refuses any client claim that disagrees. Partial-payment arithmetic
  refuses over-allocation rather than clamping it. Refund ceiling enforced against
  captured minus already-refunded. Reconciliation classifier covering all 9
  statuses with explicit precedence. Integer paise throughout, reusing the
  existing branded `Paise` rather than introducing a second money type.
- **Provider abstraction** — `PaymentProviderAdapter` plus a configuration-driven
  registry. No provider is named in engine code, and a guardrail test **fails the
  build** if one appears, or if a custodial destination, a collected banking
  secret, or a float in a monetary position appears. An adapter reports what the
  rail said; it can never return "paid".
- **Database** — 6 tables (`erp_payment`, `_attempt`, `_transaction`,
  `_provider_event`, `_refund`, `erp_firm_payment_configuration`), 3 enums,
  **13 CHECK constraints**, additive migration. The load-bearing object is the
  unique `(provider, providerTransactionId)` index, which is what makes repeated
  or replayed callbacks produce **one** accounting effect rather than several.
  No credential column exists anywhere in the table set, by design. Firm
  destinations are placeholders and default to inactive.
- **Documents** — the four mandated payment engine documents.

**Not done, deliberately.** No ERP posting (blocked on **B2**: a voucher needs a
firm cash/bank account). No HTTP route. No real rail, adapter or PSP. No UPI or
net-banking connectivity. No reconciliation feed. No rate limiting or signature
scheme. No production write, no deploy, no push.

**Not claimed.** Not an RBI-authorised Payment Aggregator. Not NPCI-certified.

Applied to the **local development database only** — 18 migrations, 64 models,
147 foreign keys, `db:check` 2/2. Verified: `prisma validate`, `tsc --noEmit` and
`eslint` all clean; 67/67 payment engine tests; 79/79 inventory tests including the
20-test reservation gate.

### 06-Oct-2026 — baseline establishment and first hardening

**WEB** `a48f506`, `9fe6b96`, `640bb3b`
- Added the missing audit record for **checkout** — the largest business event
  and previously the one money-moving write with no trail.
- Added audit records for **UTR submission** and **account suspension /
  activation**. UTR values are deliberately not copied into audit metadata.
- `.vercel-disabled/` was never ignored and carried the live Vercel
  `projectId`/`orgId`. Now ignored alongside `.vercel/`.
- `9fe6b96` also captures ~235 lines of **pre-existing uncommitted checkout
  work** (GSTIN validation, firm-availability checks, DB-resolved credit
  entitlement, per-line HSN/UOM, place-of-supply). Not authored or reviewed by
  this work; committed so it cannot be lost. Revertable independently.

**MOBILE** `6c6bceb`, `d8dc0ad`
- **`6c6bceb` — the repository had zero commits.** `src/`, `__tests__/`, `docs/`
  and all build config were untracked; the entire application existed as loose
  files on one disk. 199 files now under version control. Signing material,
  keystore, `android/` and `.env*` verified excluded before staging.
- `d8dc0ad` — the architectural guardrails were **passing vacuously**. The
  scanner stripped string literals, so every URL-based rule (including
  `/api/dealer/**`) could never match; the suite was green while proving
  nothing. Scanner corrected; three stale rules surfaced and were corrected to
  encode their real intent. **No application code was changed** — the three
  findings were rule defects, not code defects.

**ERP** `7b0429a`, `bf4ea52`, `01dab3c`, `1b4ba92`
- `1b4ba92` — `recovery.integration.test.ts` swept `loginAttempt` and
  `passwordReset` with unfiltered `deleteMany({})`. Both are **global tables with
  no firmId**, so pointing `DATABASE_URL` at a remote database meant an ordinary
  `npm test` deleted every login attempt and every outstanding password-reset
  token in the installation. Deletes scoped to the suite's own rows; suite now
  fails closed via the existing `assertTestDatabaseSafe`.
- `01dab3c` — staging accepted the published example `SESSION_SECRET`.
  Production-only rejection extended to staging.

### Corrections to the 06-Oct-2026 audit

Recorded so they are not re-introduced as findings:

- `PATCH /api/admin/users` **does** delete all sessions on suspend, and
  `scripts/set-admin-role.ts` **does** write an audit row in the same transaction
  as the role update. Both were reported as gaps; neither was.
- MOBILE `guardrails.test.ts` was reported as "one real guardrail defect". The
  defect was in the scanner, not in one rule, and it disabled most of the file.

---

## 12. KNOWN LIMITATIONS

1. Shortage is always 0 (§7.1). Procurement is effectively blind to demand.
2. `part_demand` / `purchase_requirement` do not exist in any database (§7.2).
3. ERP has no usable API, no deployment, no off-site backup (§10).
4. BUSY sync is not possible today and is a project, not a configuration (§13).
5. No notifications exist anywhere.
6. Firm isolation has no database-level enforcement in either system (§5).
7. WEB's 270 uncommitted working-tree entries remain the largest single risk to
   WEB. They are the owner's work and were deliberately not committed without a
   decision.
8. ERP integration tests cannot execute in this environment —
   `DATABASE_URL` does not reach Prisma under Vitest. Reproduces identically on
   untouched suites, so it is an environment condition, not a code defect.

---

## 13. BUSY INTEGRATION

| Capability | State |
|---|---|
| Real BUSY data on disk | **yes** — 3 companies, ~228 MB, git-ignored |
| Real BUSY XML sample | **yes** — `busy_export/COMP0006/MASTER_COMP0005.DAT`, root `<BusyData FinYear="01-04-2026">`, real third-party party ledgers |
| BUSY XML parser | **no** — zero code in any project |
| BusyNotify | **no** — zero mentions anywhere |
| Any BUSY network client | **no** |
| Excel/CSV import (ERP) | **yes, masters only** — 10 targets; 6 transaction targets deliberately refused |
| Import UI | **no** — service is complete and tested but has no page |
| Incremental / delta sync | **no** |
| Duplicate prevention | **partial** — bulk index + `P2002` retry |
| Firm mapping | **no parameter** — firm comes from session by design |
| FY mapping | **implicit only** — a closed year cannot be targeted |
| Reconciliation | **partial** — opening balances must balance; no general report |
| Rollback | **no true rollback** — `rolledBackAt` is never written; safety is the all-or-nothing transaction |
| Audit | **yes** |

`docs/imports.md` claims *"There is no import functionality in this
application."* That is **false** — a complete transactional import service
exists. The document's own precondition ("the first requirement is a sample
export from the customer's own version") is now satisfied by the file on disk,
so its rationale is out of date.

**An external BUSY API existing does not make sync possible.** There is no
receiving, mapping, validation, idempotency or reconciliation architecture for
BUSY XML, no firm/FY mapping control, and no rollback.

---

## 14. OPEN TECHNICAL DECISIONS

- ERP API shape: REST vs GraphQL, versioning, API-key vs client-credentials auth,
  per-firm scoping, rate limits, idempotency keys, pagination, error envelope,
  OpenAPI as the contract of record.
- Entity mapping: which side is canonical for `part.id` ↔ `erp_item.id`, and
  which id is stored on the other side.
- Session sharing across WEB and ERP, or independent.
- Money and GST: a shared authoritative algorithm, with the other client a
  display-only projection.
- Migration 0030: apply, or remove the demand code.
- `reserved_quantity`: give it a writer, or drop the concept and define
  `available = physical`.
- ERP `"use server"` export contract: extract non-async exports into plain
  modules.
- ERP COGS: move onto `postVoucher`, or document the second path as sanctioned.
- ERP `SESSION_SECRET` is required but signs nothing. Giving it a purpose means
  changing token derivation, which invalidates every live session at deploy.
- A cross-project contract test, and a rule for which document is authoritative.
