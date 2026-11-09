# Project Grado — context for anyone (human or AI) continuing the work

Last updated: 2026-11-09. Read this file first, then `docs/architecture.md` (why the
stack is what it is) and `README.md` (commands). Keep this file current when you change
something it describes.

---

## 1. What Grado is

A grades and records system for a Philippine senior high school (DepEd context).
Staff manage curriculum, classes, students, grades and permanent records; linked parent
accounts view only their children's registrar-approved report cards.

- Repo: `github.com/BossG-Innovation2026/CSHS-Grado` (**public** — never commit secrets
  or real student data).
- Owner/operator: BossG (school staff). The owner prefers that the assistant does as much
  as possible and only asks for details or approvals.

## 2. Live environments

| Site | URL | Worker | Database |
|------|-----|--------|----------|
| Production | https://shs-grades.innov-proj2026.workers.dev | `shs-grades` | Neon project `delicate-credit-87024053`, branch `production` (org `org-cold-art-36882071`) via Hyperdrive `e8cd29aff1aa40bdb11c92cb18ee7567` |
| Demo (fake data) | https://grado-demo.innov-proj2026.workers.dev | `grado-demo` (`wrangler --env demo`) | Neon project `quiet-bar-74838482` (`grado-demo`) via Hyperdrive `2d8c7aafcdf74eb9b87d35c2ffb11bee` |

- Cloudflare account id: `3ae62bfebe9b8d70c441e29f60b3fca4` (in `wrangler.toml`).
- Both Hyperdrive configs have **caching disabled** (required: cached reads are not
  invalidated by writes, so sessions and edits would look stale for up to 60 s).
- Demo login page shows one-click sign-in for every role; password `DemoPass2026!`
  (public by design, defined in `src/demo/accounts.json`). The real site never shows them.
- Legacy: the old Cloudflare D1 database `shs-db` is still bound as `LEGACY_D1` only for
  rollback/export. Its data was imported into Neon on 2026-11-06. Remove the binding and
  `legacy/` after ~2026-11-13 if nothing went wrong.

## 3. Stack

- Next.js **16.3** (App Router) + React 19 + Tailwind 4. **Next 16 differs from older
  versions** — read `node_modules/next/dist/docs/` before writing Next code (AGENTS.md).
- Hosting: Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`). Free plan limits:
  10 ms CPU/request, 3 MB compressed Worker (currently ~2.2 MB), 100k requests/day.
- Database: PostgreSQL on Neon (free: 1 GB, 100 CU-hours/month), reached through
  Cloudflare Hyperdrive (free: 100k queries/day). Driver: `pg` (node-postgres) — Neon's own
  guidance for Cloudflare.
- ORM/migrations: Drizzle (`src/db/schema.ts` → `drizzle/*.sql`).
- Auth: better-auth (email + password, self-hosted on our Postgres via the Drizzle
  adapter). Rate-limit counters stored in Postgres. Do **not** switch to Neon Auth unless the
  owner asks.
- Excel: SheetJS 0.20.3 from the official SheetJS CDN tarball (npm's 0.18.5 has CVEs).

## 4. Roles and modules (owner's model, implemented 2026-11-06)

Defined in `src/lib/modules.ts`.

| Role key | Label | Responsibilities | Default modules (editable per account) |
|----------|-------|------------------|-----------------------------------------|
| `system_admin` | System Admin | Configures grade levels, subjects, classes, accounts — "everything configurable" | all, always (code-enforced) |
| `school_head` | School Head | Overview, analytics, verification of grades per class/subject | classes, curriculum, grades_approve, personal_info, academic_info |
| `department_head` | Department Head | Classes assigned to them (**assigned per class** by System Admin), verification of grades | classes, grades_approve, personal_info |
| `registrar` | Registrar | Final grade approval, permanent-record custody, Form 137, card printing, parent links, audit log | classes, registrar, personal_info, academic_info, audit, grades_approve |
| `teacher` | Teacher | Creating a class makes them its **class adviser**; an adviser can also be a subject teacher; subject teachers encode and submit grade sheets, advisers verify their own class | classes, grades_submit, grades_approve, personal_info |
| `parent` | Parent / Guardian | Read-only view of the approved report card(s) of children linked by the registrar | parent_portal |
| `student` | Student / Parent (legacy label) | Old role kept so old rows resolve; do not create new accounts with it | — |

Modules: `accounts`, `curriculum`, `classes`, `grades_submit`, `grades_approve`,
`personal_info`, `academic_info`, `registrar`, `audit`, `parent_portal`, `codes`.
Everything except `codes` is implemented; `codes` stays as a "SOON" placeholder because
parent access is now granted by a database `parent_link`, not a voucher code.

Rules: only System Admins manage accounts and curriculum; any System Admin manages every
account; nobody can deactivate themselves (so one System Admin always remains); the first
account ever registered becomes System Admin (atomic). Class changes require class
adviser (or System Admin) + re-entering your password. Old role names were migrated
(`super_admin`/`admin` → `system_admin`, `coordinator` → `department_head`).

Personal information split (owner's rule): teachers see the date of birth and class
record; parent/guardian name, contact and address are visible and editable only by the
registrar office (and System Admin). Parents never see another child's record.

## 5. Data model (Postgres, `src/db/schema.ts`)

Auth (better-auth, keep JS keys): `user` (+ `role`, `permissions` JSON text, `active`),
`session`, `account` (password hash, scrypt), `verification`, `rate_limit`.

School: `school_settings` (single row id `school`), `notification`,
`grade_level` (seeded K–12 ids `grade-k`…`grade-12`; production currently keeps only the 2
levels the school uses), `subject` (per grade level; `code` unique per level; `terms`,
`credit_units`), `class` (section: `name`, `strand` ICT/HUMSS/STEM, `school_year`,
`grade_level_id`, `adviser_id`), `class_subject` (subject offered in a class **per term**
1–3, snapshot `code`/`title`, optional `teacher_id` = subject teacher, and per-offering
assessment weights `ww_weight`/`pt_weight`/`other_weight` that must total 100), `student`
(LRN unique, not an auth account; personal fields `birth_date`, `parent_name`,
`parent_contact`, `address`), `enrollment` (class ↔ student).

Grades and records: `grade` (one final value per `class_subject` × student, DepEd 60–100,
plus optional `written_work`, `performance_task`, `other_assessment` percentages),
`grade_submission` (workflow status per `class_subject`: `draft`/`submitted`/`verified`/
`approved`/`returned`, with who/when and the return note), `signed_sheet` (paper grading
sheet received by the registrar), `academic_record` (previous-school/JHS history with
JSON `subjects`), `record_surrender` (adviser → registrar custody of a permanent record),
`parent_link` (parent account ↔ student), `audit_log` (append-only who-changed-what),
`notification` (per-account in-app messages).

Still not modelled: department-head assignment per class (verification is role-based).

## 6. Code layout and conventions

- `src/db/index.ts` — `getDb()`: per-request `pg` pool on Workers (sockets can't cross
  requests; keyed by the request's ExecutionContext), `DATABASE_URL` locally. Nothing else
  opens connections.
- `src/server/*.ts` — `import "server-only"` data layer. Read functions re-check access
  (`requireModule`, `requireAdmin`); unchecked helpers are named `find*` and called only
  after a check. Pages import reads from here.
- `src/app/**/actions.ts` — `"use server"` mutations only. **Never export a read from a
  "use server" file** (Server Actions are public POST endpoints). Every action
  re-authorizes (guards in `src/server/guards.ts`).
- `src/lib/env.ts` — env access; `requireEnvVar` fails in production when missing.
- `src/lib/demo.ts` + `src/demo/accounts.json` — demo mode (`DEMO_MODE=true` only on the
  demo Worker).
- Bulk writes: batched `INSERT … ON CONFLICT` in a transaction (never per-row queries).
- Uploads: `src/server/spreadsheet.ts` (2 MB / 2000-row caps).
- Line endings: repo files are a mix of CRLF/LF on Windows; scripted edits should
  normalize `\r\n` before matching.

## 7. Everyday commands

```bash
cp .env.example .env.local      # local env (DATABASE_URL, DATABASE_POOL_MAX=1 for PGlite)
npm run db:dev                  # zero-install local Postgres (PGlite) on :5432
npm run db:migrate              # apply drizzle/ migrations to DATABASE_URL
npm run db:seed-dev             # local demo teacher + class (local DBs only)
npm run dev                     # http://localhost:3000 (port 3000 may be taken on the owner's PC; use --port 3100 and set BETTER_AUTH_URL)
npm run check                   # typecheck (next typegen + tsc) + eslint
npm run db:generate             # after editing src/db/schema.ts; commit drizzle/
node scripts/e2e-m1.js          # E2E accounts/bootstrap (wipes local accounts); 17 checks
node scripts/verify-passwords.js  # E2E password-confirmed class changes; 9 steps
```

E2E needs `npx playwright install --only-shell chromium` and the app running
(`E2E_BASE` / `APP_BASE_URL`, default http://localhost:3000).

## 8. Delivery pipeline

- Work on a branch → PR → CI (`.github/workflows/ci.yml`: typecheck, lint, Worker build,
  migration-drift check, both E2E suites on Postgres 17).
- Merge to `main` = **production deploy** (`deploy.yml`): checks → OpenNext build →
  migrations on Neon production → `wrangler deploy` → migrations on demo DB → deploy demo
  Worker → set demo auth secret once. Ask the owner before merging.
- Migrations run before new code is live: keep them backward compatible.
- GitHub secrets (names only): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
  `BETTER_AUTH_SECRET`, `DATABASE_URL`, `DATABASE_URL_DEMO`, `BETTER_AUTH_SECRET_DEMO`.
- One-time setup scripts (already run): `scripts/go-live.mjs` (production),
  `scripts/go-live-demo.mjs` (demo). Both keep secrets in memory and never print them.
- Windows: `opennextjs-cloudflare build` fails locally (symlink EPERM) without Developer
  Mode or WSL; CI builds on Linux. `gh` CLI must be on account `BossG-Innovation2026`
  (has write access; `serErick2026` does not).

## 9. Grades, records and parent portal (implemented 2026-11-06)

Workflow per `class_subject` (one subject, one term):

1. **Subject teacher** (or the class adviser for any subject in their class) encodes one
   whole-number grade per student, then saves a draft or submits the sheet. Submission is
   refused while any student has no grade.
2. **Class adviser** verifies a submitted sheet, or returns it with a note.
3. **Registrar** approves a verified sheet (or returns it with a note); approval locks it.
4. **Registrar** records the signed paper grading sheet received from the teacher
   (`signed_sheet`), which is the paper backup for the encoded grades.
5. **Registrar** prints report cards and the Form 137 permanent record. Only approved
   grades appear on printed/parent cards.

Teacher dashboard (rebuilt 2026-11-09): teacher accounts with `grades_submit` open a
purpose-built dashboard instead of the generic quick-action page. It has four connected
sections: **My Advisory** (section, grade level, strand, school year, student count,
searchable list, selected-student snapshot with profile/academic-card links), **Assessment
Information and Grades** (Written Works, Performance Tasks, Other Components, final grade
and remark with Term 1/2/3 filters), **My Class** (subject-section cards with grade level,
strand, school year, enrolled count, encoding progress, workflow status and a link to the
class record) and **Grades Overview** (section/subject/term filters, inline encoding with
the shared `GradeEntryTable`, validation, save/submit confirmation, CSV export and print).
A notification bell in the top navigation shows grade-workflow messages and supports
mark-one/mark-all-read. Data comes from `src/server/teacher-dashboard.ts` (same
adviser/subject-teacher access rules as `listMyOfferings`); the client components handle
selection, filtering, CSV export and the print view. The save action re-authorises,
recomputes the final grade from the component weights, revalidates `/dashboard`, writes an
audit entry and notifies the next person in the workflow.

The UI uses one dark academic palette — background `#0D171A`, sidebar `#101D21`, cards
`#162429`, elevated surfaces `#1B2C32`, accent `#20B7D3`/`#13C9E8`, text `#E7F0F2`/
`#91A8B0`, borders `#26383E` — defined once in `src/app/globals.css` tokens. Print views
switch the same tokens back to paper colours. There is no theme switcher.

Pages and routes:

| Route | Module | Purpose |
|-------|--------|---------|
| `/dashboard` | — | Teacher academic dashboard; role-aware quick actions and counts for other staff |
| `/grades` | grades_submit | My subject sheets and encoding |
| `/grades/[id]` | grades_submit or grades_approve | One sheet: encode, verify, approve, return, signed sheet |
| `/grades/verify` | grades_approve | Verification/approval queue |
| `/students` | personal_info | Student search (teachers see DOB; registrar sees contact) |
| `/students/[id]` | personal_info | Personal info, grades, academic history, parent access, record custody |
| `/academic` | academic_info | Academic information list |
| `/academic/[id]` | academic_info | Form 137 + JHS records (editable by registrar) |
| `/registrar` | registrar | Registrar dashboard: stats, surrenders, queue, parent links |
| `/registrar/cards` | registrar | Card-printing list |
| `/registrar/cards/[id]` | registrar | Printable report card (approved grades) |
| `/audit` | audit | Append-only audit trail |
| `/parent` | parent_portal | Parent's linked children |
| `/parent/[id]` | parent_portal | One child's approved card |

Decisions taken (owner's answers):
- Grading scale: **DepEd 60–100, 75 passing**. One final grade per student per subject
  per term. Each subject offering stores Written Works / Performance Tasks / Other
  assessment weights (default 30/50/20, must total 100); when all three component scores
  are encoded the final grade is their weighted average, otherwise a final grade can be
  encoded directly.
- Parent access: **parent accounts + `parent_link`**, created/linked by the registrar;
  no voucher codes. A parent can only open children linked to their account, and only
  approved grades are queried.
- Record custody: the adviser holds the permanent record until surrendering it; the
  registrar confirms receipt. Reasons: graduated, transferred, stopped attending.
- Personal information: teachers see DOB; parent/contact/address stay with the registrar
  office (and System Admin), per the owner's instruction.
- School year on classes is now modelled (`class.school_year`; sections also carry
  `class.strand`). Department-head-per-class is still not modelled; the existing
  role-based verification (school head/department head sees all) is used.

Demo seed (`scripts/seed-demo.mjs`) creates four sections (Grade 11/12 ICT A, HUMSS A,
ICT B, HUMSS B), all subjects in all three terms, component + final grades in every
workflow state, signed sheets, JHS records, one pending and one received surrender, an
audit trail, notifications, and a parent account linked to one fake student
(password `DemoPass2026!`). `deploy.yml` re-runs it with `--reset` after deploying the
demo Worker so the demo always matches the current schema; demo data is fake by design.

## 10. Security rules (do not break)

- Never commit or print secrets, tokens, connection strings, or real student data. Exports
  of production data are deleted right after use.
- Never show demo accounts or demo passwords on the production site; `seed-demo.mjs`
  refuses any database with a non-demo account.
- No hard-coded keys or "backdoor" endpoints (an old `/api/admin/seed` was removed).
  Admin promotion is `npm run admin:promote -- <email>` with direct DB access.
- Re-authorize in every Server Action; check ownership (adviser) for class changes.
- Hyperdrive caching must stay disabled for this app.

## 11. Known issues / watch list

- Free-plan 10 ms CPU vs scrypt password hashing: if sign-ins fail with Cloudflare error
  1102, move to Workers Paid ($5/mo).
- The owner's PC has stale `CLOUDFLARE_API_TOKEN` / `CF_API_TOKEN` user environment
  variables that break local `wrangler`; scripts strip them. Owner asked to remove them.
- PGlite dev server: keep `DATABASE_POOL_MAX=1` (parallel connections can mix replies).
- Untracked in the working tree: `.agents/` and `skills-lock.json` (Neon agent skills for
  GitHub Copilot) — intentionally not committed.
- Auto-fix for PRs could not be enabled from Claude Code (identity mismatch); owner can
  enable it from the PR bar.

## 12. History (short)

- 2026-08: Built on Next.js + Cloudflare Workers + D1. Deploys broke on 2026-08-25
  (expired Cloudflare token).
- 2026-11-06: PR #1 — moved to Neon Postgres + Drizzle + Hyperdrive, security fixes,
  CI/CD; data imported from D1; production live again.
- 2026-11-06: PR #2 — owner's role model, demo site with one-click role logins.
- 2026-11-06: grades workflow, student personal/academic records, registrar office,
  parent portal, audit log, report-card printing, migration `0003` (work in progress;
  merge pending owner approval).
- 2026-11-07: teacher academic dashboard (advisory, class sections, assessment table,
  selected-section grade encoding).
- 2026-11-08: dark forest-green redesign (single palette, paper-colour print overrides);
  the light/dark/system theme toggle and its store were removed.
- 2026-11-09: finished and verified the grades/records feature branch (typecheck, lint,
  Next build, both E2E suites) before opening the PR.
- Decisions log: `D:\Knowledge OS\02 - Projects\Grado\DECISIONS.md` (owner's machine).
