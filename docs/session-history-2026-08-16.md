> **Historical note (2026-11-06):** this describes the old SQLite/D1 setup. The app now uses Postgres + Drizzle; see `docs/architecture.md` and `README.md`. Commands below no longer apply.

# Session History — 2026-08-16 (Password Confirmation)

Resume point for future sessions. Tell the agent:

> Read `docs/session-history-2026-08-16.md` and continue from there.

## Project context

- **Project Grado** (SHS grades system). Next.js 16 + React 19 + better-auth, Tailwind v4.
- **Prod:** Cloudflare Workers (opennextjs-cloudflare) + D1 (`shs-db`, wrangler config), migrations in `migrations/` 0001–0006.
- **Local dev:** Next dev server using `dev.sqlite` via `node:sqlite` (`node:sqlite` needs Node >= 22.5; tested on v24.19.0). `dev.sqlite` is gitignored and **not** shared.
- Workerd pinned to `1.20260804.1` so `npm ci` passes on Linux.

## What was done this session

Built a **password-confirmation layer** for class-changing actions on the class detail page:

- New client components (untracked until this commit):
  - `src/app/(protected)/classes/password-confirm-form.tsx` — wrapper form that intercepts submit, opens a password dialog, and on confirmation appends a hidden `password` field and re-submits.
  - `src/app/(protected)/classes/delete-class-dialog.tsx`, `remove-class-subject-button.tsx`, `unenroll-student-button.tsx` — convert existing actions to use the wrapper.
- Refactored existing forms (`rename-class-form.tsx`, `add-class-subject-form.tsx`, `enroll-student-form.tsx`, `upload-students-form.tsx`) and page to use it.
- `src/app/(protected)/classes/actions.ts`: `verifyPassword` uses `better-auth/crypto` against `account.password`.

## Bug found & fixed

**Subject teacher select did not reflect the saved value after the action re-render.**

- Symptom: DB updated correctly (`class_subject.teacherId`), but the `<select>` kept showing "— unassigned —" until a full page reload. Wrong-password and remove flows were unaffected.
- Root cause: React reused the existing `<select>` DOM node after the server action re-render, and `defaultValue` is only applied on mount — the new value never reached the UI.
- Fix: `src/app/(protected)/classes/subject-teacher-select.tsx:23` — added `key={teacherId ?? "none"}` so the select remounts when the assigned teacher changes.

Note: subjects are rendered `ORDER BY cs.title COLLATE NOCASE` (`listClassSubjects` in `actions.ts`), so "General Mathematics" comes **before** "Oral Communication" in the table — tests must locate rows by text, not by `.first()`.

## Verification

`node scripts/verify-passwords.js` (dev server on port 3000) — all green:

1. rename with wrong password → inline "Incorrect password" error
2. rename with correct password → applied
3. assign subject teacher via select (auto-submit → modal) → applied in UI + DB
4. add subject → appears
5. remove subject → row disappears (the Add-subject dropdown still lists the subject — don't assert on whole-body text)
6. enroll student → appears
7. unenroll student → gone
8. delete class with wrong password → inline error in dialog
9. delete with correct password → redirect to `/classes`, class gone

Plus: no page errors / console errors.

## Bootstrap & commands (any machine)

Prereqs: git, Node >= 22.5 (or >= 22.12 for `require(esm)` used by `scripts/seed-dev.js`), Playwright browsers (`npx playwright install chromium` if needed).

```bash
git clone https://github.com/BossG-Innovation2026/Project1.git
cd Project1
npm install
npm run db:migrate        # applies migrations/0001-0006 to dev.sqlite
npm run db:seed           # school_settings
node scripts/seed-dev.js  # repro teacher + subjects + class "Grade 11 - B"
npm run dev               # keep running, port 3000
node scripts/verify-passwords.js   # expect 9/9 OK
```

Env overrides: `SEED_EMAIL`/`SEED_PASSWORD` (seed), `TEST_EMAIL`/`TEST_PASSWORD`/`APP_BASE_URL` (verify).

Seed data: teacher `repro2@school.local` / `ReproPass123!` ("Repro Two"), subjects OC11/GM11/ES11, class id `22222222-3333-4444-5555-666666666666`.

## Environment gotchas

- **PowerShell:** no `&&`; avoid inline `node -e` with `?`/quotes for SQL — write scripts to files instead (base64-eval trick garbles output with this toolchain).
- `next dev` logs to `dev-repro.log` with ANSI codes — unreadable via redirect filters; the DB + Playwright output are ground truth.
- `repro.pid` is a leftover dev-server PID file (gitignored now), `*.tmp.js` test scratch files (`test-seed.tmp.js`, `test-verify-passwords.tmp.js`, etc.) are gitignored — their committed successors are `scripts/seed-dev.js` and `scripts/verify-passwords.js`.
- `dev.sqlite` never ships; always `db:migrate` + seed on a fresh clone.

## Current commit

`feat: require password confirmation for class-changing actions` — includes the 7 modified class-page files, 4 new components, `scripts/seed-dev.js`, `scripts/verify-passwords.js`, this history file, and `.gitignore` (`repro.pid`).