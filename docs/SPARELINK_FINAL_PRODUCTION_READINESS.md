# SPARELINK INDIA — FINAL PRODUCTION READINESS

**Date:** 06-Oct-2026 · **Continuation of the master execution** · **B4 approved**

Evidence rule: a feature is DONE only with UI + API + service + database +
authorization + test + real data flow. Anything less is PARTIAL.

---

## 1. Completed

| # | Item | Project | Evidence |
|---|---|---|---|
| 1 | Mobile under version control (was **zero commits**) | MOBILE | `6c6bceb`, 199 files tracked, tree clean |
| 2 | Architectural guardrails no longer vacuous | MOBILE | `d8dc0ad`, scanner fixed, 3 stale rules corrected, **20/20** guardrail tests, non-vacuity proven |
| 3 | Unfiltered wipes of two GLOBAL tables removed | ERP | `1b4ba92`, deletes scoped + suite fails closed |
| 4 | Staging accepted the published `SESSION_SECRET` | ERP | `01dab3c`, rejected in staging as well as production |
| 5 | Checkout had **no audit record** | WEB | `9fe6b96`, actor + firm split recorded |
| 6 | UTR submission had **no audit record** | WEB | `640bb3b` |
| 7 | Account suspend/activate had **no audit record** | WEB | `640bb3b`, `previousRole → newRole` |
| 8 | Live Vercel `projectId`/`orgId` was not ignored | WEB | `a48f506` |
| 9 | Authoritative cross-project status document | WEB | `2d77e75` |
| 10 | B4 recorded; all 14 decisions ruled or recorded | WEB | `e87e199`, `docs/SPARELINK_BUSINESS_DECISIONS.md` |
| 11 | **Reservation arithmetic, proven** | ERP | `bf4ea52`, **32 tests**, all four specified cases |
| 12 | **Reservation record + 5 DB CHECK constraints** | ERP | `bf4ea52`, additive migration, verified 1 table / 9 constraints / 7 indexes / 2 enums |
| 13 | **Reservation writer — the missing piece** | ERP | `bf4ea52`, `FOR UPDATE` before deciding availability, idempotent, atomic |
| 14 | Availability clamped; oversell made explicit | ERP | `bf4ea52`, `available` + `oversoldBy` |

---

## 2. Partial

| Feature | Owner | State |
|---|---|---|
| Reservation service | ERP | **Complete in code, NO integration test.** No transactional path executed against a DB — the local dev DB has no seeded item. |
| WEB audit coverage | WEB | Checkout/UTR/suspend done; ~15 other admin writes still unaudited. |
| Guards | ERP | `recovery.integration.test.ts` guarded; **16 of 21 integration suites still unguarded.** |
| Firm scoping | ERP | 4 layers, **19 firm-owned models outside `FIRM_SCOPE_KEYS`.** |
| Stock taking | ERP | Not started. |
| Notifications | all | Not started. |

---

## 3. Blocked

| Item | Blocked by |
|---|---|
| Real-party testing | Read-only approved; write approval outstanding. 16 unguarded ERP suites. |
| ERP API (Step 10) | Not started; depends on B4 mapping + reconciliation. |
| WEB demand migration 0030 | **Untouched, still un-journalled** (journal ends `0029`). Requires guarded apply + cutover approval. |
| WEB→ERP integration | No entity mapping, no reconciliation, no cutover approval. |
| MOBILE ERP migration | Depends on the above. |
| Play Store release | Release keystore in plaintext on disk; no device QA; no crash handler. |
| ERP deployment | No Vercel project, DNS, or managed Postgres. |
| BUSY mapping (B8) | Only `COMP0005 = HIND MOTORS` evidenced. **Never guessed.** |

---

## 4. Broken

| Defect | Status |
|---|---|
| ~~Shortage always 0~~ | **FIXED in ERP arithmetic.** Not yet fixed in WEB, which still has no reservation writer. |
| ~~Negative availability~~ | **FIXED** — `available` floored, `oversoldBy` added. |
| `part_demand` / `purchase_requirement` do not exist | **OPEN** — 0030 still un-applied. |
| MOBILE `LedgerScreen` calls no API | OPEN |
| WEB mobile search filters broken (`hidden md:block`) | OPEN |
| WEB dark-theme contrast 1.05–2.04:1 | OPEN |
| WEB Hindi garbling; hardcoded English at `search-experience.tsx:640-667` | OPEN |
| ERP COGS bypasses `postVoucher` | OPEN |
| ERP `"use server"` exports non-functions | OPEN |
| WEB warranty unresolvable (no PATCH) | OPEN |
| WEB admin login charges the lockout budget | OPEN |

---

## 5. Remaining business decisions — 4

Engineering will not invent any of these.

| # | Decision | Exact facts needed |
|---|---|---|
| **B2** | Firm legal identity | Per firm: GSTIN, PAN, registered address, state + state code, bank name/account/IFSC/branch, UPI, invoice prefix, logo, signature |
| **B3** | Firm state codes | Actual state per firm. Determines the CGST+SGST vs IGST split on **every tax invoice** |
| **B6** | Credit semantics | Does `0` mean enforcement OFF or limit-not-set? Default mode WARN or BLOCK? |
| **B8** | BUSY company mapping | Which BUSY company code is Ambaji Traders, and which is India Sales? |

**B2/B3 conflict, recorded and unreconciled:** WEB publishes three GSTINs in state **23** on the live storefront; ERP seeds placeholders in **24/24/27**; ERP's readiness doc declares every GST field **PENDING**; ERP's own BUSY data names **Madhya Pradesh** parties; the MOBILE Play listing says **Gujarat**. Four sources, three answers. Nothing changed.

---

## 6. Remaining technical decisions

ERP API shape and auth · entity mapping canonical side · session sharing · shared money/GST algorithm · whether to apply 0030 or remove the demand code · the `use server` export contract · whether the COGS posting path is sanctioned · `SESSION_SECRET` is inert (giving it purpose invalidates every live session) · a cross-project contract test · which document is authoritative.

---

## 7. Migration status

| | State |
|---|---|
| **ERP `20261006220000_item_reservation`** | **APPLIED to LOCAL DEV** (`sparelink_erp` @ 127.0.0.1). Verified: 1 table, 9 constraints, 7 indexes, 2 enums. `migrate status` → **up to date**. Purely additive. |
| **WEB `0030_demand_capture`** | **NOT APPLIED, NOT TOUCHED.** Still un-journalled by design; journal ends `0029`; 31 SQL files on disk. |
| Production | Untouched in both. |
| ERP model count | 57 → **58** |

---

## 8. API status

Unchanged from the audit and not yet advanced: WEB 145 routes · MOBILE 75 bindings, all resolving to WEB · **ERP 3 route handlers, none usable by WEB or MOBILE** · **0 versioned APIs** · **0 OpenAPI** · **0 contract tests**.

Step 10 was **not started.** Building an ERP API before the B4 mapping and reconciliation exist would produce an API whose inventory figures are known-wrong.

---

## 9. Inventory reconciliation

**NOT PERFORMED — and this is a STOP CONDITION, not an omission.**

Reconciliation needs counts and quantities. Those require reading two live
databases: WEB's production Postgres, and the ERP dev database which has **no
seeded items** (verified — `erp_godown ⋈ erp_item` returns zero rows).

A **schema-level** comparison was completed from source: WEB keys stock on
`dealer_listing_id`; ERP on **item × godown** (approved authority). A
**data-level** reconciliation cannot be produced without reading production, which
is prohibited.

No stock quantity was migrated, rewritten or destroyed. No `dealer_listing` row
was deleted.

---

## 10. Demand status

| | State |
|---|---|
| Shortage arithmetic (ERP) | **DONE and proven** — all four specified cases pass |
| Reservation writer (ERP) | **DONE in code**, integration test outstanding |
| Shortage arithmetic (WEB) | **BROKEN** — formula correct, input permanently 0, `reserved_quantity` written only as `0` at row creation |
| `part_demand` / `purchase_requirement` | **DO NOT EXIST** — 0030 un-applied |
| WEB demand routes/services/page | Written against non-existent tables |
| MOBILE demand | Absent |

---

## 11. Procurement status

Unchanged. PO accepts `draft | submitted | cancelled | received`; 11 further statuses exist in code but are unreachable and **were not wired**, per B9. Partial goods receipt is genuinely end-to-end. ERP has `PURCHASE_ORDER` as a document type. No supplier confirmation stage anywhere. **Goods-receipt rules still conflict** (WEB needs a `dealer_listing_id`; ERP has no listing concept) — resolved in principle by B4, not in code.

---

## 12. Accounting status

Per **B5**, ERP is authoritative. WEB `party_ledger_entry` is **legacy: retained, not deleted, not extended.** No reconciliation claimed. ERP accounting engine unchanged and passing. ERP COGS posting-path defect **still open**.

---

## 13. BUSY status

Unchanged. Data present and untouched; **parser absent**; BusyNotify absent; import service complete with **no UI**; **no incremental sync**; **no rollback** (`rolledBackAt` never written). `COMP0005 = HIND MOTORS` is the only evidenced mapping. **B8 required before any mapping work.**

---

## 14–16. WEB / MOBILE / ERP status

| | WEB | MOBILE | ERP |
|---|---|---|---|
| Under version control | 6 commits ahead, **270 uncommitted entries remain** | ✅ 199 files, clean | 3 commits ahead, clean |
| Typecheck / lint | clean / clean | clean / clean | clean / clean |
| Tests | **1475 · 1443 pass · 0 fail · 32 skipped** | **565 · 33 suites · 0 fail** | 89 unit pass; integration suites need `.env` in the shell |
| Build | passes (log stale: 34 routes vs 145) | AAB built, **debug-signed** | passes |
| Verdict | NOT READY | NOT READY | NOT DEPLOYABLE |

---

## 17. Security status

Fixed this cycle: vacuous guardrails · production auth-table wipes · staging secret acceptance · three missing audit trails · exposed Vercel identity.

Outstanding: MOBILE release-keystore password in plaintext on disk (preserved, **needs Play Console to rotate**) · `BETTER_AUTH_SECRET` unset in WEB example · 16 unguarded ERP integration suites · 19 ERP models outside firm scope · WEB dealer routes scoped by `dealerId` not firm · no RLS anywhere · no device attestation or cert pinning in MOBILE.

---

## 18. Test results — exact

| Suite | Count | Pass | Fail |
|---|---|---|---|
| WEB `tsx --test lib/**/*.test.ts` | 1475 | 1443 | **0** (32 skipped) |
| MOBILE `jest` | 565 | 565 | **0** |
| ERP unit (reservation, stock, guard) | 89 | 89 | **0** |
| ERP `db:check` | 2 checks | 2 | **0** |
| ERP integration (21 suites) | — | — | **NOT RUN** — requires `.env` in the shell and seeded items |

**Never reported a test as passing that was not executed.** ERP reservation
constraint *enforcement* is verified structurally (constraints present) but **not
proven by execution** — the local dev DB has no item to hold stock against.

---

## 19. Deployment status

**NONE.** No deployment, no Play upload, no production migration, no production
seed, no DNS change, no Vercel project, no off-site backup.

---

## 20. Exact next action

**Write one ERP integration test** (`reservation-service.integration.test.ts`)
that creates its own firm + godown + item + valuation fixture, then proves
end-to-end: reserve reduces available, over-reserve is refused, a duplicate
idempotency key does not double-hold, release restores availability, a release
larger than the hold does not go negative, the expiry sweep releases lapsed holds,
`reconcileReservedQuantity` finds zero drift, and the five CHECK constraints bite.

That is the one gap between the reservation feature being *written* and being
*verified*. Everything downstream — WEB 0030, entity mapping, the ERP API, stock
taking — waits on it.

In parallel, and requiring only the business owner: **answer B2/B3** (firm legal
identity and state codes), **B6** (credit semantics) and **B8** (BUSY company
mapping).

---

## Per-feature matrix

| Feature | Owner | Source of truth | WEB | MOBILE | ERP | BUSY | Status | Test |
|---|---|---|---|---|---|---|---|---|
| Auth | both | separate | ✅ | ✅ | ✅ | — | DONE (3 systems) | ✅ |
| Catalogue | WEB | WEB→ERP | ✅ | ✅ | pg_trgm | — | PARTIAL | ✅ |
| Cart / checkout | WEB | WEB | ✅ | ✅ | ❌ | — | DONE | ✅ |
| COD / bank transfer | WEB | WEB | ✅ | ✅ | bank only | — | DONE | ✅ |
| Online payment | WEB | WEB | ✅ | ⚠️ probe only | ❌ | — | **NOT APPROVED (B1)** | ✅ |
| Orders | WEB | WEB | ✅ | ✅ | ❌ | — | DONE | ✅ |
| Invoices | WEB→ERP | ERP | ✅ | ⚠️ | ✅ | ✅ | PARTIAL | ✅ |
| **Stock: physical** | **ERP** | **ERP** | legacy | read | ✅ | — | **B4 DONE** | ⚠️ partial |
| **Stock: reserved** | **ERP** | **ERP** | ❌ never written | ❌ | ✅ **NEW** | — | **ERP DONE**, WEB open | ⚠️ |
| **Stock: available** | **ERP** | **ERP** | formula right, input 0 | ❌ | ✅ clamped | — | **ERP DONE** | ✅ **32** |
| **Stock: valuation** | **ERP** | **ERP** | ❌ | ❌ | ✅ avg + FIFO | — | DONE | ✅ |
| **Shortage** | **ERP** | **ERP** | ❌ always 0 | ❌ | ✅ **NEW** | — | **ERP DONE** | ✅ **4 cases** |
| Stock taking | ERP | ERP | ❌ | ❌ | ❌ | — | MISSING | — |
| **Reservations** | **ERP** | **ERP** | ❌ | ❌ | ✅ **NEW** | — | **code DONE, untested** | ⚠️ |
| Demand | ERP | ERP | ❌ table | ❌ | ❌ | — | **MISSING** | — |
| Purchase requirement | ERP | ERP | ❌ table | ❌ | ❌ | — | **MISSING** | — |
| PO | ERP | ERP | ⚠️ 4 statuses | ❌ | ✅ doc type | — | PARTIAL (B9) | — |
| Goods receipt | ERP | ERP | ⚠️ listing-scoped | ❌ | ✅ | — | PARTIAL, rules conflict | ✅ |
| Supplier confirmation | ERP | ERP | ❌ | ❌ | ❌ | — | **MISSING** | — |
| Accounting | **ERP** | **ERP** | legacy ledger | ❌ | ✅ engine | ✅ | DONE (ERP) | ✅ |
| GST figures | **ERP** | **ERP** | ⚠️ 3 impls | display | ✅ 8 reports | ✅ | PARTIAL, 3 impls | ✅ |
| e-invoice / e-way bill | ERP | ERP | ❌ | ❌ | ❌ by design | — | FUTURE | — |
| Credit | — | — | `0 ⇒ OFF` | read | `WARN` | — | **CONFLICT (B6)** | ✅ |
| Audit | both | both | ⚠️ 3 fixed | ❌ | ✅ + viewer | — | PARTIAL | ✅ |
| Backup | ERP | ERP | ❌ | ❌ | ⚠️ **no off-site** | — | PARTIAL | ✅ |
| Notifications | shared | — | ❌ | ❌ push | ❌ | — | **MISSING** | — |
| **ERP API** | ERP | ERP | ❌ | ❌ | **3 routes** | — | **MISSING** | — |
| Entity mapping | — | — | ❌ | ❌ | ❌ | ❌ | **MISSING** | — |
| BUSY import | ERP | ERP | CSV export | ❌ | ⚠️ no UI | source | PARTIAL | ✅ |
| BUSY sync | ERP | ERP | ❌ | ❌ | ❌ | — | **MISSING** | — |
| Play Store | MOBILE | — | — | ⚠️ debug-signed | — | — | BLOCKED | ⚠️ |

---

```
ERP modified:              YES — 3 commits (1b4ba92, 01dab3c, bf4ea52)
ERP production DB modified: NO
WEB modified:              YES — 2 commits (e87e199) + earlier 4
WEB production DB modified: NO
MOBILE modified:           NO this cycle
Production DB modified:    NO
Migrations applied:        ERP 20261006220000_item_reservation — LOCAL DEV ONLY
                           WEB 0030_demand_capture — NOT applied, untouched
Tests:  WEB 1475/1443 pass/0 fail · MOBILE 565/0 fail · ERP unit 89/0 fail
Build:  WEB pass · MOBILE not built · ERP pass
Git commits: 1 this cycle (bf4ea52) · 4 prior
Git push:    NO — WEB 6 ahead, ERP 3 ahead, MOBILE no remote
Remaining decisions: B2, B3, B6, B8
Protected material: all 5 verified intact · BUSY untouched and untracked
Catalogue junction: intact
```

# NOT PRODUCTION READY

Blocked by four unmade business decisions (B2, B3, B6, B8), one untested
component (the reservation service), and a data-level inventory reconciliation
that cannot be produced without reading production.
