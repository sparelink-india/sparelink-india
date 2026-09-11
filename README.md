# SpareLink India

Production codebase for the SpareLink India spare-parts marketplace: buyers find parts by vehicle or part number, dealers list stock and price, and SpareLink owns catalog quality, KYC, and checkout.

This repository is in **Step 1 (repo foundation)**. Authentication, catalog, search, enquiries, payments, and dealer/admin features are not implemented yet.

## Stack

- Next.js (App Router) and TypeScript
- Tailwind CSS
- Drizzle ORM with PostgreSQL (optional until later steps)
- ESLint and Prettier
- GitHub Actions for install, typecheck, lint, and build

## Local setup

Requirements: Node.js 20+ and npm.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app starts **without** a database. Leave `DATABASE_URL` unset until you need Drizzle.

### Optional: PostgreSQL

When you are ready to run migrations:

1. Create a local Postgres database.
2. Set `DATABASE_URL` in `.env.local` (and `.env` if you use the Drizzle CLI).
3. Run `npm run db:generate` then `npm run db:migrate`.

Do not commit `.env`, `.env.local`, or any real credentials. `.env.example` lists names only.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Apply migrations (needs `DATABASE_URL`) |
| `npm run db:studio` | Drizzle Studio (needs `DATABASE_URL`) |

## Layout

```text
app/(public)/     Public storefront routes (home placeholder)
app/              Root layout and styles
components/       Shared UI (empty until later steps)
lib/env.ts        Environment accessors
lib/db/           Lazy Drizzle client (not used on startup)
drizzle/          Schema and migrations
.github/workflows CI
```

Buyer, dealer, admin, and API route groups will be added with those features.

## License

Private. All rights reserved.
