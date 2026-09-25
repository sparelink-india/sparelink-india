# SpareLink India — production environment

Do not put secrets in this file. Set real values only on the host.

## Production host (required)

Configure these on the production host (for example Vercel Production). Do not copy `.env.development.local` into production.

- `DATABASE_URL` — production Neon / Postgres URL
- `CASHFREE_ENVIRONMENT=production` — **required**. If this is missing when `NODE_ENV=production`, Cashfree refuses to start (no silent sandbox default)
- `CASHFREE_API_VERSION=2023-08-01`
- `CASHFREE_AMB_CLIENT_ID` / `CASHFREE_AMB_CLIENT_SECRET` — Ambaji **production** Cashfree keys, on the host only
- `CASHFREE_HIN_*` and `CASHFREE_IND_*` — leave empty until those firms are onboarded. Missing keys must not fall back to Ambaji. No Easy Split.
- `NEXT_PUBLIC_APP_URL` — public https origin (no trailing slash). Required at runtime for Cashfree return URLs; localhost is refused when `NODE_ENV=production`
- `OTP_DELIVERY_WEBHOOK_URL` — HTTPS endpoint that sends the buyer OTP (SMS or WhatsApp). Required in production; console OTP is disabled
- `OTP_DELIVERY_WEBHOOK_TOKEN` — optional bearer token for that webhook
- `OTP_REQUIRED` — `true` only if username/password login must also complete OTP
- `BETTER_AUTH_SECRET` — long random secret, host only
- `BETTER_AUTH_URL` — same public https origin as `NEXT_PUBLIC_APP_URL`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — optional; leave empty until Google login is issued. New Google users are created as buyers only
- `TYPESENSE_HOST`, `TYPESENSE_PORT`, `TYPESENSE_PROTOCOL`, `TYPESENSE_API_KEY`
- `CATALOGUE_IMAGE_ORIGIN` — `https://assets.sparelinkindia.com` (no trailing slash). Prefixes catalogue raster URLs served from Cloudflare R2 bucket `sparelink-india-assets`; leave unset only for local junction serving
- Cashfree production dashboard webhook: `https://<public-host>/api/payments/cashfree/webhook` on **each onboarded firm merchant** (Ambaji now; Hind/India Sales when those keys exist)

Optional on the host (not secrets in git):

- `SMTP_*` / `SUPPORT_EMAIL_TO` — support request mail
- `NEXT_PUBLIC_SUPPORT_PHONE` / `NEXT_PUBLIC_SUPPORT_EMAIL` / `NEXT_PUBLIC_WHATSAPP_*` — published contact numbers (`NEXT_PUBLIC_WHATSAPP_AMBAJI`, `_HIND`, `_INDIA_SALES`)
- `AMBAJI_TRADERS_*`, `HIND_MOTORS_*`, `INDIA_SALES_*` — optional direct bank transfer config (`*_BANK_ACCOUNT_*`, `*_BANK_IFSC_CODE`, `*_BANK_UPI_ID`, `*_COD_ENABLED`) and tax invoice seller overlays (`*_GSTIN`, `*_LEGAL_NAME`, `*_ADDRESS`, `*_PHONE`, `*_EMAIL`)

Never use TEST database URLs or sandbox Cashfree keys in the production host environment. Razorpay remains disabled; do not set Razorpay keys.

## Local development vs production

| Variable | Local development | Production host |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | public `https` origin, not localhost |
| `CATALOGUE_IMAGE_ORIGIN` | empty (local `/catalogue-images` junction) | `https://assets.sparelinkindia.com` |
| `CASHFREE_ENVIRONMENT` | `sandbox` | `production` |
| `DATABASE_URL` | TEST Neon / local Postgres | production Postgres only |
| `OTP_DELIVERY_WEBHOOK_URL` | optional (OTP prints to server console) | required HTTPS webhook |
| Cashfree firm keys | Ambaji sandbox keys | Ambaji production keys; HIN/IND empty until onboarded |

## Schema / 0020

The Drizzle journal includes `0020_cashfree_firm_payments`. `npm run db:migrate:production` will apply 0020 if production Postgres has not already received that migration. Confirm the live schema before running migrate. Do not run migrate from this document.

## Preview / TEST

- `DATABASE_URL` — TEST Neon branch only
- `CASHFREE_ENVIRONMENT=sandbox`
- Ambaji sandbox Cashfree keys only
- Do not point preview at the production database

## FIRST PRODUCTION ADMIN SETUP

Production has no self-service password reset, no admin-initiated password reset, and no admin-created accounts. The **only** supported way to establish the first production admin is for an operator to promote one existing, human-owned account with the repository's own script.

The script is `scripts/set-admin-role.ts`. It never creates an account, never changes a role default, never promotes the first user, and never modifies email, password, or credential state. It changes exactly one user's `role` and writes an `admin.role_change` row to `audit_log` in the same transaction.

### Preconditions

1. The intended operator has **already registered a normal buyer account** through the production registration flow and can sign in with it at `/login`.
2. That account belongs to the intended business owner. Get their authorization in writing first.
3. The operator has the production database reachable through the host's normal secret store. The script reads `DATABASE_URL` from the environment and from `.env.local`, and never prints it.

### Procedure

Run from the repository root, one account at a time. The script takes **no command-line flags**; every input is an environment variable.

```bash
# 1. Identify the target with exactly ONE of these. Never set both.
export ADMIN_EMAIL="the-owner@example.com"      # or: export ADMIN_USER_ID="<user uuid>"
# Never set both ADMIN_EMAIL and ADMIN_USER_ID; the script refuses.

# 2. In production, also confirm the operator intends this change.
export SPARELINK_ALLOW_ADMIN_ROLE_CHANGE=YES

# 3. Run the promotion.
npx tsx scripts/set-admin-role.ts
```

The script fails closed, with an explanatory message and **no** database change, when:

- neither or both target identifiers are set;
- a production environment is detected (`NODE_ENV`, `VERCEL_ENV`, or `SPARELINK_ENV` equals `production`) and `SPARELINK_ALLOW_ADMIN_ROLE_CHANGE` is not exactly `YES`;
- the target account does not exist.

If the target is already an admin it reports that and changes nothing.

### After the promotion

4. Clear the acknowledgement so it cannot be reused:

```bash
unset SPARELINK_ALLOW_ADMIN_ROLE_CHANGE
```

5. Confirm the change is auditable. The row is written with `action = 'admin.role_change'`, `entity_type = 'user'`, `entity_id` = the promoted user id, and metadata recording previous role, new role, how the target was identified, and whether the environment was production. `actor_user_id` is null because a CLI run has no authenticated session. No password, hash, token, or connection string is recorded.

6. Have the operator sign in normally at `/login` and confirm the admin surfaces load.

### Hard rules

- Never enable `scripts/seed-bootstrap-auth.ts` in production. It refuses production environments by design and exists only for local development.
- Never expose, print, commit, or share admin credentials, `DATABASE_URL`, or `BETTER_AUTH_SECRET`.
- Never create an admin through public registration. Registration always forces the `buyer` role and ignores any client-supplied role.
- Never use direct SQL to change a role. Use the script so the change stays scoped and auditable.
- Never promote an account without the account owner's or business owner's authorization.
- Promote one account at a time, and only for a person who will actually operate the admin surface.

## Local development

- Bootstrap auth seeding is disabled unless `SPARELINK_BOOTSTRAP_SEED=development` is set explicitly. It refuses production environments and requires separate `SPARELINK_BOOTSTRAP_PASSWORD_000`, `SPARELINK_BOOTSTRAP_PASSWORD_111`, and `SPARELINK_BOOTSTRAP_PASSWORD_123` variables; never commit their values.
- `next dev` loads `.env.development.local` then `.env.local`
- Keep TEST `DATABASE_URL` and `CASHFREE_ENVIRONMENT=sandbox` in `.env.development.local`
- Do not run `next start` against `.env.local` unless you intend to use that file’s database

## Database commands (fail closed)

Do not run `drizzle-kit migrate` / `push` without a target.

- TEST: `npm run db:migrate:test` (uses `.env.development.local`)
- Production: `npm run db:migrate:production` (uses `.env.local`, requires `--i-understand-production`)
- Ambiguous `npm run db:migrate` is refused

`drizzle-kit generate` does not apply SQL and does not require a live target.
