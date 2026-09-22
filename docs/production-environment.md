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
- Cashfree production dashboard webhook: `https://<public-host>/api/payments/cashfree/webhook` on **each onboarded firm merchant** (Ambaji now; Hind/India Sales when those keys exist)

Optional on the host (not secrets in git):

- `SMTP_*` / `SUPPORT_EMAIL_TO` — support request mail
- `NEXT_PUBLIC_SUPPORT_PHONE` / `NEXT_PUBLIC_SUPPORT_EMAIL` / `NEXT_PUBLIC_WHATSAPP_*` — published contact numbers only

Never use TEST database URLs or sandbox Cashfree keys in the production host environment. Razorpay remains disabled; do not set Razorpay keys.

## Local development vs production

| Variable | Local development | Production host |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | public `https` origin, not localhost |
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

## Local development

- `next dev` loads `.env.development.local` then `.env.local`
- Keep TEST `DATABASE_URL` and `CASHFREE_ENVIRONMENT=sandbox` in `.env.development.local`
- Do not run `next start` against `.env.local` unless you intend to use that file’s database

## Database commands (fail closed)

Do not run `drizzle-kit migrate` / `push` without a target.

- TEST: `npm run db:migrate:test` (uses `.env.development.local`)
- Production: `npm run db:migrate:production` (uses `.env.local`, requires `--i-understand-production`)
- Ambiguous `npm run db:migrate` is refused

`drizzle-kit generate` does not apply SQL and does not require a live target.
