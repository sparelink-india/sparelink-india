# Phase 6 ERP completion — open business decisions

## Credit limit enforcement

- `dealer.credit_limit_paise = 0` means **limit not configured / enforcement off**.
- A positive limit enables enforcement on **submitted** admin sales orders.
- Existing outstanding balances are **not invented**; ledger starts empty (zero) for parties without entries.
- Do not seed historical AR from Busy or spreadsheets without an explicit import project.

## Pricing rules

- `pricing_rule.discount_percent` may be `null` until an admin sets an approved commercial value.
- Hierarchy: customer rule → dealer rule → pricing category (via `dealer.price_group` code) → existing verification discounts → listing price.
- Supplier / purchase costs never appear on dealer or buyer pricing APIs.

## Goods receipt

- Purchase order create / status patch still **never** increases stock.
- Confirmed goods receipt increases stock only when the PO line has a `dealer_listing_id`.
- Lines without a listing can still be receipted for operational tracking, but inventory cannot update (inventory is listing-scoped).
- Over-receipt is blocked. Partial receipt is supported. Idempotency key prevents duplicate stock increments.

## Production migration note

- Production has Phase 6 migration `0022` applied but may lack normal `__drizzle_migrations` bookkeeping.
- Migration `0023_phase6_erp_completion` is additive. Apply via the project's established TEST → production path.
- Do **not** casually repair `__drizzle_migrations` journal bookkeeping overnight.
