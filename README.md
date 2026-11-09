# Project Grado

Grades and records system for senior high schools: accounts with per-module access,
curriculum (grade levels, subjects, credit units), classes with per-term subjects and
subject teachers, and student enrollment with Excel bulk upload.

**Stack:** Next.js 16 · React 19 · Tailwind 4 · better-auth · Drizzle ORM · PostgreSQL
(Neon) via Cloudflare Hyperdrive · Cloudflare Workers (OpenNext).
Why this stack, the free-tier budget, the scale-up path and the go-live checklist are in
[docs/architecture.md](docs/architecture.md).

## Local development

Prerequisites: Node.js 22.12+ (no Docker needed).

```bash
npm install
cp .env.example .env.local
npm run db:dev          # terminal 1: local Postgres on 127.0.0.1:5432 (data in ./.pglite)
npm run db:migrate      # terminal 2: create tables
npm run dev             # http://localhost:3000
```

The first account registered at `/register` becomes System Admin; after that the page is closed and System Admins create accounts.
Optional demo data: `npm run db:seed-dev` (a teacher and the class "Grade 11 - B").
Prefer a real Postgres? `docker compose up -d` instead of `npm run db:dev`, and remove
`DATABASE_POOL_MAX` from `.env.local`.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Next.js dev server |
| `npm run check` | Typecheck + lint |
| `npm run db:dev` | Zero-install local Postgres (PGlite) |
| `npm run db:generate` | Create a SQL migration in `drizzle/` from `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |
| `npm run db:studio` | Browse the database (Drizzle Studio) |
| `npm run db:seed-dev` | Demo data, local databases only |
| `npm run db:import-d1 -- <file>` | One-time copy of the old D1 data into Postgres |
| `npm run admin:promote -- <email>` | Make an account System Admin (direct DB access) |
| `npm run db:seed-demo` | Fake demo data, one account per role (refuses real databases) |
| `node scripts/go-live-demo.mjs` | One-time setup of the demo site's database and Hyperdrive |
| `npm run preview` | Build and run the real Worker locally (Linux/WSL, or Windows Developer Mode) |
| `node scripts/e2e-m1.js` | E2E: first-user bootstrap and account management (wipes local accounts) |
| `node scripts/verify-passwords.js` | E2E: password-confirmed class changes |

E2E scripts need `npx playwright install --only-shell chromium` once, and the app running
on port 3000 (override with `E2E_BASE` / `APP_BASE_URL`).

## Roles

| Role | Does | Default modules (editable per account) |
|------|------|-----------------------------------------|
| System Admin | Configures grade levels, subjects, classes and accounts | All, always |
| School Head | School-wide overview, analytics, grade approval | Classes, Curriculum, Grades Approval |
| Department Head | Classes assigned to them, grade approval | Classes, Grades Approval |
| Registrar | Student records and forms (SF9/SF10) | Classes, Records & Forms |
| Teacher | Adviser of classes they create (can also teach subjects); submits grades | Classes, Grade Submission, Access Codes |
| Student / Parent | Views grades with a voucher code from the adviser (coming with grades) | — |

## Demo site

https://grado-demo.innov-proj2026.workers.dev runs the same build with `DEMO_MODE=true`
and its own Neon database of fake data. Its login page has one-click sign-in for every
role (password `DemoPass2026!`). The real site never shows demo accounts. To reset the
demo data: `DATABASE_URL=<demo db> node scripts/seed-demo.mjs --reset`.

## Changing the database

1. Edit `src/db/schema.ts`.
2. `npm run db:generate` and review the new file in `drizzle/`.
3. `npm run db:migrate` locally, commit both files. CI rejects schema changes without a
   migration; the Deploy workflow applies migrations before releasing the new Worker.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`: checks, Worker build, migrations
on Neon, then `wrangler deploy`. Every pull request runs `.github/workflows/ci.yml`
(typecheck, lint, Worker build, migration drift check, E2E on Postgres).
Required GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
`BETTER_AUTH_SECRET`, `DATABASE_URL`.
