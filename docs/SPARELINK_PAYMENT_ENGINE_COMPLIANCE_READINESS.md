# SPARELINK PAYMENT ENGINE — CERTIFICATION & COMPLIANCE READINESS

**Status: TECHNICAL READINESS PACKAGE PREPARED · NOT CERTIFIED · NOT ONBOARDED**
Established 07-Oct-2026 · Companion to `SPARELINK_PAYMENT_ENGINE_ARCHITECTURE.md`

---

## 0. Regulatory position — the wording that must be used

**SpareLink Payment Engine is proprietary payment orchestration software.**

It is **NOT** described as:
- an RBI-authorised Payment Aggregator
- NPCI-certified
- a Payment System Operator
- an operator of a payment network

**No such authorisation or certification exists.** Nothing in this repository claims one, and no document produced for a bank, PSP or acquirer may claim one either.

Production UPI and net-banking connectivity **depends entirely** on an appropriate arrangement with an authorised bank, PSP or acquirer, and on satisfying whatever onboarding, security and compliance requirements that arrangement imposes. Building the software is not the same as being authorised to move money, and this package tracks the two separately so the gap cannot quietly close on its own.

### Where the line actually sits

| Layer | Who owns it | SpareLink's position |
|---|---|---|
| Payment orchestration software | **SpareLink** | Built, tested, owned |
| Regulated payment rails | **Authorised bank / PSP / acquirer** | Not held, not operated, not claimed |
| Merchant/acquiring relationship | **SpareLink, via the provider** | Not yet established |
| Funds custody | **Nobody** | SpareLink holds no customer money at any layer |

---

## 1. Merchant onboarding checklist

**Current state: NOT STARTED.** Every item is blocked on an authorised provider being chosen. Nothing below has been faked or pre-ticked.

### 1.1 Provider selection

| # | Item | State | Note |
|---|---|---|---|
| 1.1.1 | An authorised bank / PSP / acquirer identified | ⛔ **BLOCKED** | No arrangement exists. This blocks everything else in this document. |
| 1.1.2 | Per-merchant (not pooled) settlement confirmed | ⛔ **BLOCKED** | `assertPerFirmSettlement` **refuses** any rail that cannot settle per merchant. Three legal firms must each receive their own money. |
| 1.1.3 | UPI acceptance confirmed | ⛔ **BLOCKED** | Requires 1.1.1. |
| 1.1.4 | Net-banking acceptance confirmed | ⛔ **BLOCKED** | Requires 1.1.1. |
| 1.1.5 | Refund/chargeback capability confirmed | ⛔ **BLOCKED** | UPI rails generally lack programmatic refunds; see §3. |
| 1.1.6 | Settlement evidence method confirmed | ⛔ **BLOCKED** | Provider report, bank feed, or manual. Determines Phase G completion. |

### 1.2 Firm and KYC data

| # | Item | State | Note |
|---|---|---|---|
| 1.2.1 | Ambaji Traders — GSTIN, PAN, address, bank details | ⚠️ **PARTIAL** | Supplied by owner. **Bank account numbers still missing.** |
| 1.2.2 | Hind Motors — as above | ⚠️ **PARTIAL** + ⚠️ **CONFLICT** | UPI handle is `@okbizaxis` (Axis) while the IFSC is Bank of India. **Must be resolved.** |
| 1.2.3 | India Sales — as above | ⚠️ **PARTIAL** | **Bank account number missing.** |
| 1.2.4 | Firm signatories / authorised persons | ⛔ **NOT SUPPLIED** | Required by every acquirer. Engineering cannot supply this. |
| 1.2.5 | Proof of address, PAN card, bank proof | ⛔ **NOT SUPPLIED** | Business owner's documents. |
| 1.2.6 | State code confirmed | ✅ **RESOLVED** | 23 / 23 / 23 (Madhya Pradesh). Closes **B3**. |

> **⚠️ Why the two partials matter.** An acquirer will reject a merchant application with mismatched bank data, and a settlement into the wrong entity's account is unrecoverable without manual intervention. These are not paperwork gaps — they are reasons a payment could go to the wrong legal entity.

### 1.3 Technical integration

| # | Item | State | Note |
|---|---|---|---|
| 1.3.1 | Production adapter implemented | ⛔ **NOT STARTED** | Interface exists (`ProductionPaymentAdapter`). No implementation, because none can exist without a provider. |
| 1.3.2 | Sandbox → production parity proven | ⛔ **BLOCKED** | Requires 1.1.1. |
| 1.3.3 | Webhook endpoint publicly reachable | ⛔ **NOT STARTED** | No HTTP routes exist yet. |
| 1.3.4 | Webhook signature scheme agreed | ⚠️ **READY** | `HMAC_SHA256`, `RSA_SHA256`, `ED25519` supported; keyring with rotation; timestamp window; constant-time compare. |
| 1.3.5 | Credential storage provisioned | ✅ **READY** | AES-256-GCM, keyring, AAD bound to firm, rotation-aware. Reuses the ERP's existing audited crypto. |
| 1.3.6 | Sandbox credentials verified against provider | ⛔ **BLOCKED** | Requires 1.1.1. |
| 1.3.7 | Production credentials provisioned | ⛔ **BLOCKED** | Requires 1.1.1 and explicit activation approval. |

---

## 2. Security checklist

Every row is a **verified control** or an **honest gap**. Nothing is marked done on the strength of intent.

### 2.1 Controls verified by test

| # | Control | Where | Evidence |
|---|---|---|---|
| 2.1.1 | SpareLink holds no customer funds | `assertFirmOwnedDestination` | Guardrail test fails the build on a custodial destination |
| 2.1.2 | Firm derived server-side, never from the client | `resolveFirm` | 30+ tests; guardrail asserts the authenticated-context pattern |
| 2.1.3 | `SUCCESS` requires trusted verification | `transition()` | Type-branded proof, only producible by `verifyProviderCallback` |
| 2.1.4 | Callback signature verified before any amount is read | sandbox adapters, `verifySignedCallback` | Order asserted by test |
| 2.1.5 | Timestamp bound **into** the signed material | `verifySignedCallback` | Otherwise a replay's timestamp could be rewritten to re-enter the window |
| 2.1.6 | Replay protection via a window **and** a processed-event set | both rails, keyring verifier | Replay tests; a staged-vs-processed distinction caught a real bug |
| 2.1.7 | Key rotation without dropping callbacks | `KeyRing` | Retained-key acceptance test |
| 2.1.8 | Unknown key id refused, never fallen back | `selectKey` | Test |
| 2.1.9 | Private key in the verifier refused at startup | `assertNoPrivateKeyInRing` | Test |
| 2.1.10 | Integer paise only; no float in a monetary position | engine-wide | Guardrail fails the build on `parseFloat`, `toFixed`, float money types |
| 2.1.11 | Fractional JSON amount cannot become a Paise | `safeParse` narrowing | Test |
| 2.1.12 | No banking credential accepted on any method | type shapes | `CreatePaymentRequest` has no password/PIN/OTP field — nowhere to put one |
| 2.1.13 | No credential column in payment configuration | `FirmPaymentConfiguration` | Schema |
| 2.1.14 | Credentials encrypted at rest, AAD-bound to firm | `sealCredentials`/`openCredentials` | Reuses audited ERP crypto |
| 2.1.15 | Credential readable-state reported without decrypting | `describeProviderCredential` | A settings page cannot cause a decryption |
| 2.1.16 | Credentials never logged or returned | service design | Secrets returned to the adapter only, per call |
| 2.1.17 | Raw provider callback body not stored | `PaymentProviderEvent` | Schema comment |
| 2.1.18 | Firm isolation via firm-scoped client | `getFirmDb` | Cross-firm reads resolve to *not found* |
| 2.1.19 | Exactly one accounting effect per payment | unique index + read-before-write | 10 concurrent postings → 1 voucher, 9 `ALREADY_POSTED`, 0 errors |
| 2.1.20 | Production flag fails closed on every typo | `readProductionFlag` | Ten typo values asserted OFF |
| 2.1.21 | Pooled merchant account refused | `assertPerFirmSettlement` | Test |
| 2.1.22 | Provider name cannot enter the core engine | `provider.guardrail.test.ts` | Build fails on a provider name, SDK shape, or endpoint shape |

### 2.2 Honest gaps

| # | Gap | Severity | Blocks |
|---|---|---|---|
| 2.2.1 | **No HTTP routes exist.** Auth, authorisation, rate limiting and request IDs are unproven in situ. | High | H, I, L |
| 2.2.2 | **Rate limiting is not implemented.** Only a hook point is documented. | High | L |
| 2.2.3 | **No structured logging.** §5 specifies what must be logged; nothing emits it. | Medium | L |
| 2.2.4 | **No anomaly detection.** Deterministic hooks are documented (excessive failures, frequency, refund abuse) but unwritten. | Medium | L |
| 2.2.5 | **No PCI-relevant surface exists** — no card data is collected, so no PCI scope is claimed. Revisit if cards are ever added. | Info | — |
| 2.2.6 | **No penetration test.** | High | L |
| 2.2.7 | **No dependency/SBOM review** for the payment path. | Medium | L |
| 2.2.8 | **Key rotation is implemented but never exercised** against a real provider. | Medium | J |

---

## 3. Refund and chargeback process

### 3.1 What is built

| Control | State |
|---|---|
| A refund references its original payment, order, invoice, firm, amount, reason and actor | ✅ Schema + `PaymentRefund` |
| Refund may never exceed the captured amount | ✅ `assertRefundWithinCaptured`, tested |
| Refund may never exceed the remainder after earlier refunds | ✅ Same, tested including the duplicate-refund case |
| Refund state machine (`REFUND_PENDING` → `PARTIALLY_REFUNDED` → `REFUNDED`) | ✅ Tested |
| A refund with no reason or actor is refused | ✅ CHECK constraints |
| Refund accounting effect goes through the ERP boundary | ✅ Never written directly |
| Idempotent refund request | ⚠️ Sandbox net-banking rail only; no HTTP route |
| Programmatic refund capability per rail | ⚠️ **Provider-dependent.** UPI rails generally lack it. |

### 3.2 The unresolved process question

**A UPI refund may need to be executed as a NEW outbound payment to the customer's account, not as a reversal.** These are different operations with different failure modes:

- A reversal can fail silently — the customer's account is debited, SpareLink's is not.
- A new payment can fail visibly — the customer does not receive the money.

Which one applies depends on the provider, and **no provider exists yet**. Until then this document does not state a process, because stating the wrong one would be worse than stating none.

**Required before activation:**
1. Provider's documented refund mechanism, per method.
2. Failure handling for each: who retries, on what schedule, and who is told.
3. Whether the customer is notified automatically, and by what channel.
4. Refund SLA, and how breaches are detected.
5. Who may authorise a refund, and at what amount a second approval is required. **Not yet decided — business owner's call.**

### 3.3 Chargebacks and disputes

**Nothing is built, and nothing can be until a provider exists.**

Chargeback handling is a *provider-facing* process with its own deadlines, evidence requirements and fees. SpareLink's engine has no concept of one, which is correct at this stage: a dispute workflow written before knowing the provider's dispute API would be fiction.

**Required before activation:** provider dispute API and deadlines · evidence pack assembled automatically from the audit trail · a dispute register · who handles them · reserve policy.

---

## 4. Reconciliation requirements

### 4.1 What is built

Four-way comparison: SpareLink payment vs provider transaction vs firm settlement evidence vs ERP ledger posting.

| Requirement | State |
|---|---|
| All nine statuses declared and classified with explicit precedence | ✅ Tested |
| Current verdict stored on the payment | ✅ |
| Append-only history of every judgement with its evidence | ✅ `PaymentReconciliation` |
| A `MATCHED` verdict must carry the evidence that it matched | ✅ CHECK — prevents laundering a missing fact into a clean result |
| Idempotent re-run | ✅ Tested against a real database |
| Mismatch queue for a human | ✅ Tested — exactly the seven discrepancy statuses route to review |
| Per-status report including empty states | ✅ Tested |
| Manual settlement recording for `BANK_TRANSFER` | ✅ Tested |
| Settlement evidence recorded once per feed run | ✅ Unique index; concurrent double run settles to one row |
| Unapplied cash recorded, not discarded | ✅ Tested |
| A settled payment cannot be deleted | ✅ `NO ACTION` FK — enforced and tested |
| Live settlement feed refused while production is off | ✅ Tested |

### 4.2 What does not exist

| Gap | Why |
|---|---|
| **Automated bank statement matching** | No authorised arrangement. The feed interface and a deterministic sandbox feed exist; no real feed is connected and none is claimed. |
| **Real settlement evidence** | Blocked on **B2** — no account numbers, so there is nothing to match against. |
| **Tolerance bands** | Deliberately absent. A "close enough" amount rule is how rounding becomes unexplained variance. Amounts are integer paise and must match exactly. |
| **Automated repair** | Deliberately absent. A silent repair destroys the evidence that something went wrong. |
| **Reconciliation SLA / ageing** | Not defined. |

### 4.3 The two real-data conflicts that reconciliation will catch

Both are flagged rather than resolved, because guessing either one would be inventing a payment destination:

1. **Hind Motors UPI/IFSC mismatch.** UPI handle `@okbizaxis` is an Axis Bank namespace; the IFSC is Bank of India. A UPI collection would settle to an Axis account, not the Bank of India account reconciliation expects. This will surface as `FIRM_MISMATCH`.
2. **Missing account numbers** for all three firms. A destination cannot be activated without one.

---

## 5. Audit and data retention

### 5.1 What is audited

| Event | Recorded |
|---|---|
| Payment created / initiated | ✅ `PaymentAudit` via engine |
| Callback received — **accepted or refused** | ✅ `PaymentProviderEvent`, including refusals |
| Payment verified / failed / expired | ✅ State machine + audit |
| ERP posting | ✅ `AuditLog`, module `payments`, action `post` |
| Reconciliation verdict **changed** | ✅ `AuditLog` |
| Manual settlement confirmation | ✅ `AuditLog` |
| Refund created / completed | ⚠️ Schema ready; no route yet |
| Manual override | ⚠️ No route yet |

### 5.2 What is never recorded

Passwords · OTPs · CVVs · card numbers · UPI PINs · bank PINs · provider signing secrets · full bank credentials · **raw provider callback bodies**.

Audit metadata carries identifiers only. Tested: the posting audit row is asserted not to contain a destination reference.

### 5.3 Retention

**No retention period has been set, and this is a business and legal decision, not an engineering one.**

India's accounting-record retention obligations, the acquirer's requirements, and SpareLink's own dispute window may each impose different minimums. This document does **not** invent a number.

**Required before activation:**
1. Statutory minimum for accounting records — confirm with the firm's accountant.
2. Provider's required retention.
3. Dispute/chargeback window, which may exceed both.
4. Personal-data retention and erasure obligations for payment records.
5. Which system is authoritative for the long-term copy, and its backup.

**Interim position:** nothing is deleted automatically. Financial evidence accumulates. That is safe, and it is not a compliance answer.

---

## 6. Activation gate

**All twenty-one items must be satisfied. Any one missing ⇒ no activation.**

| # | Gate | State |
|---|---|---|
| 1 | Phase C ERP payment boundary | ✅ PASS |
| 2 | Phase E sandbox UPI | ✅ PASS |
| 3 | Payment DB verification gate | ✅ PASS (21/21) |
| 4 | Phase F sandbox net banking | ✅ PASS |
| 5 | Phase G reconciliation | ⚠️ Partial — feed interface + persistence done, no live feed |
| 6 | Phase H WEB integration | ⛔ NOT STARTED |
| 7 | Phase I MOBILE integration | ⛔ NOT STARTED |
| 8 | Authorised bank/PSP/acquirer arrangement | ⛔ **BLOCKED** |
| 9 | Provider onboarding complete | ⛔ NOT STARTED |
| 10 | Production credentials securely provisioned | ⛔ NOT STARTED |
| 11 | Webhook signature configuration complete | ⚠️ Framework ready, no provider |
| 12 | Reconciliation feed available | ⛔ NOT STARTED |
| 13 | Refund process agreed | ⛔ **NOT DECIDED** |
| 14 | Chargeback/dispute process agreed | ⛔ **NOT DECIDED** |
| 15 | Compliance review complete | ⛔ **NOT STARTED** |
| 16 | Firm configuration verified | ⚠️ **BLOCKED** — account numbers missing, UPI conflict |
| 17 | ERP bank/GL mapping verified | ✅ PASS — resolved by `systemKey`, no invented account |
| 18 | Production backup verified | ⛔ ERP has no off-site backup configured |
| 19 | Monitoring verified | ⛔ NOT STARTED |
| 20 | Security review passed | ⛔ NOT STARTED — no pen test |
| 21 | Real-party test plan approved | ⛔ NOT STARTED |
| 22 | **Explicit owner approval for activation** | ⛔ NOT GIVEN |

**Satisfied: 5 of 22.** Production activation is **BLOCKED**.

---

## 7. The three sentences to get right

1. **SpareLink Payment Engine is proprietary payment orchestration software.** Not an authorised aggregator, not certified, not a network.
2. **Production connectivity depends on an authorised bank, PSP or acquirer arrangement**, and on satisfying its onboarding and compliance requirements.
3. **No approval is fabricated anywhere in this repository** — and no document produced for a provider may fabricate one either.
