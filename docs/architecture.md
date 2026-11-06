# Project Grado — architecture

Status: implemented on branch `feat/postgres-drizzle` (November 2026). Production still
runs the old D1 build until the go-live steps below are done.

## Recommendation in one paragraph

Keep **Next.js 16 on Cloudflare Workers** (free, no cold starts, no sleep, commercial use
allowed), but move the data from **D1 (SQLite)** to **PostgreSQL on Neon**, reached through
**Cloudflare Hyperdrive**, with **Drizzle ORM** as the single typed schema and migration tool.
Every piece has a $0 tier today and a paid tier that scales without a rewrite. Postgres is
the long-term fit for school records: real transactions and constraints, concurrent writes
at grading deadlines, reporting/analytics (SF9/SF10, region-level summaries), row-level
security for multi-school tenancy later, and it runs anywhere (Neon, Supabase, RDS,
a DepEd-hosted server) — no lock-in to one vendor's database.

## What the old setup had (findings)

| # | Finding | Impact | Fixed |
|---|---------|--------|-------|
| 1 | `POST /api/admin/seed` promoted any account to Super Admin with a key hard-coded in the **public** repo | Full takeover once deployed (it was never live: every deploy since 2026-08-25 failed) | Endpoint removed; replaced by `npm run admin:promote` (needs direct DB access) |
| 2 | Read helpers (`listAccounts`, `listStudents`, `getAccount`, …) were exported from `"use server"` files with no auth check | Server Actions are public POST endpoints; staff emails and student LRNs/names could leak | Reads moved to a `server-only` data layer (`src/server/*`), each re-checks access |
| 3 | Class actions checked "signed in" + adviser, not module access | A user without Class Creation could still call the actions | Actions now require the `classes` module (`src/server/guards.ts`) |
| 4 | Bulk uploads ran 3–4 queries **per row** | D1 free plan allows 50 queries per request, so a 15-student upload could fail; slow either way | One batched `INSERT … ON CONFLICT` per 500 rows, inside a transaction |
| 5 | Upload parser dropped the first data row whenever headers matched | Silently lost a real student if the sample row was replaced | Only the template's sample row (LRN 1234567890, Doe, John) is skipped |
| 6 | `xlsx@0.18.5` from npm parses uploaded files | Known prototype-pollution / ReDoS CVEs in that version | SheetJS 0.20.3 from the official SheetJS CDN; uploads capped at 2 MB / 2000 rows |
| 7 | Auth secret fell back to `dev-secret-change-in-production` | Forgeable sessions if the secret were ever missing | Missing secret now fails loudly in production |
| 8 | Rate limiting used in-memory counters | Each Worker isolate has its own memory, so limits barely applied | Counters stored in Postgres (`rate_limit` table) |
| 9 | First-registration "becomes Super Admin" was check-then-update | Two simultaneous first sign-ups could both become Super Admin | Single atomic `UPDATE … WHERE NOT EXISTS` |
| 10 | Two code paths: `node:sqlite` locally, D1 in production, raw SQL strings | Bugs that only show in one environment; no types | One Drizzle schema, same `pg` driver locally and in production |
| 11 | Deploy pushed migrations + seed + deploy with no checks; `auto-deploy.mjs` did `git add . && push main` | Broken code or stray files go straight to production | CI (typecheck, lint, Worker build, migration drift, e2e on Postgres) on every PR; deploy re-checks first |

## Target architecture

```
Browser ──HTTPS──> Cloudflare Worker (Next.js 16 via OpenNext)
                     │  src/app/**          pages + thin "use server" actions
                     │  src/server/**       server-only data layer (auth checks + queries)
                     │  src/db/schema.ts    Drizzle schema (single source of truth)
                     │  better-auth         sessions, password hashing, rate limits
                     ▼
               Cloudflare Hyperdrive  (connection pooling, caching DISABLED)
                     ▼
               Neon Postgres  (main branch = production, extra branches = staging/dev)
```

Request flow: each request gets its own small `pg` pool (Workers forbid sharing sockets
across requests; Hyperdrive keeps the real connections warm). Locally and in scripts the
same code uses `DATABASE_URL`.

## Free-tier budget (checked November 2026)

| Service | Free allowance | What it means for Grado |
|---------|----------------|--------------------------|
| Workers | 100k requests/day, 10 ms CPU per request, 3 MB compressed Worker | Current Worker is 2.18 MiB gzipped (0.8 MiB headroom). Password hashing (scrypt) is the heaviest CPU step; watch for error 1102 on sign-in |
| Hyperdrive | 100k queries/day | A page costs roughly 3–6 queries (session + data): about 15–20k page loads/day |
| Neon | 1 GB storage, 100 CU-hours/month per project, 5 GB egress, scale-to-zero | 1 GB holds years of one school's records; idle nights/weekends cost nothing; first request after idle waits ~0.5 s for wake-up |

D1 free, for comparison: 500 MB per database and 50 queries per request.

## Scale-up path (do each step only when its trigger happens)

1. **Workers Paid ($5/month)** — trigger: sign-in errors 1102 (CPU), Worker bundle near 3 MB,
   or >100k requests/day. Gives 30 s CPU, 10 MB Worker, unlimited Hyperdrive queries.
2. **Neon Launch (usage-based)** — trigger: storage >1 GB or compute hours running out.
   Adds autoscaling and longer history/restore.
3. **Grade submission at scale** — when grades go live: add `grade` tables with
   per-quarter rows, and move heavy work (report cards, SF9/SF10 PDFs, imports of whole
   school years) to **Cloudflare Queues** + **R2** storage instead of the request path.
4. **Multi-school (division/region)** — add a `school` table and `school_id` on top-level
   rows (class, student, subject, user), then Postgres row-level security so one
   deployment serves many schools safely. Do this before the second school joins;
   it is cheap to add early and expensive later.
5. **Read scaling** — Neon read replicas for reports/analytics; cache only truly static
   reference data (grade levels, curriculum) in a separate cached Hyperdrive config.

## Environments

| Site | Worker | Database | Notes |
|------|--------|----------|-------|
| Production | `shs-grades` | Neon `delicate-credit-87024053`, branch `production` | Real school data |
| Demo | `grado-demo` (`wrangler --env demo`) | Separate Neon project `grado-demo` | Fake data, `DEMO_MODE=true`, one-click role logins |

Both deploy from `main` in one workflow run; the demo steps are skipped until
`DATABASE_URL_DEMO` and the demo Hyperdrive id exist.

## Code layout and rules

- `src/db/schema.ts` — tables. Change it, run `npm run db:generate`, commit `drizzle/`.
  CI fails if the schema and migrations disagree.
- `src/db/index.ts` — `getDb()` for the current request. Nothing else creates connections.
- `src/server/*.ts` — `import "server-only"`. Reads re-check access (`requireModule`,
  `requireAdmin`); helpers without checks are named `find*` and only called after a check.
- `src/app/**/actions.ts` — `"use server"`; every action re-authorizes (signed in, module,
  ownership, password re-entry for class changes). Never export a read from these files.
- Migrations must be backward compatible with the code currently live (deploy applies
  migrations first): add columns/tables first, remove old ones in a later release.

## Local development

```bash
cp .env.example .env.local
npm run db:dev        # terminal 1: zero-install local Postgres (PGlite) on :5432
npm run db:migrate    # terminal 2
npm run db:seed-dev   # optional demo teacher/class
npm run dev
```

PGlite is one embedded database behind a socket; keep `DATABASE_POOL_MAX=1` with it.
For a real Postgres (and for `npm run preview`, which runs the actual Worker locally),
use `docker compose up -d` and remove `DATABASE_POOL_MAX`.
On Windows, `opennextjs-cloudflare build` needs Developer Mode (symlinks) or WSL; CI
builds on Linux.

## Go-live steps (one time, in order)

Production keeps running the old D1 build until step 7, so nothing breaks on the way.

1. **Fix the Cloudflare token.** Deploys have failed since 2026-08-25 with
   `Authentication error [code: 10000]`. Create a token with *Workers Scripts: Edit*,
   *Hyperdrive: Edit* and *D1: Edit* (D1 only for the export), and save it as the GitHub
   secret `CLOUDFLARE_API_TOKEN`.
2. **Create a Neon project** (free plan, region close to the Philippines, e.g. Singapore),
   Postgres 17 or newer. Copy the **direct** (not pooled) connection string.
3. **Create Hyperdrive** with caching disabled:
   `npx wrangler hyperdrive create grado-db --caching-disabled --connection-string="<Neon direct URL>"`
   and put the printed id in `wrangler.toml` (replace `REPLACE_WITH_HYPERDRIVE_ID`).
4. **Add the GitHub secret `DATABASE_URL`** = the Neon direct URL (used only by CI to
   run migrations).
5. **Create the tables:** `DATABASE_URL=<Neon URL> npm run db:migrate`.
6. **Move the data:**
   `npx wrangler d1 export shs-db --remote --output d1-export.sql`, then
   `DATABASE_URL=<Neon URL> npm run db:import-d1 -- d1-export.sql`.
   Check the printed counts, then **delete `d1-export.sql`** (student personal data).
   Passwords carry over; everyone signs in again once.
7. **Merge to `main`.** The Deploy workflow checks, migrates (no-op), builds and deploys.
8. **Verify** sign-in, a class page, and an upload on the live URL.
9. After a week without issues, remove the `[[d1_databases]]` block and `legacy/`.

Rollback: re-deploy the last good commit of the old build; D1 is untouched by the move.
Anything written in Postgres after go-live would not be in D1, so decide on rollback
within the first day.
