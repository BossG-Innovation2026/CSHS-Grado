// Promote an existing account to System Admin (all modules).
// Replaces the old public /api/admin/seed endpoint: this runs only on an
// operator's machine with direct database access.
// Usage: DATABASE_URL=... npm run admin:promote -- someone@school.edu.ph
import pg from "pg";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run admin:promote -- <email>");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set.");

const ALL_MODULES = ["accounts", "curriculum", "classes", "grades_submit", "grades_approve", "registrar", "codes"];

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const result = await client.query(
    `UPDATE "user" SET role = 'system_admin', permissions = $1, active = true, updated_at = now()
     WHERE email = $2 RETURNING id`,
    [JSON.stringify(ALL_MODULES), email]
  );
  if (result.rowCount === 0) {
    console.error(`No account with email ${email}.`);
    process.exitCode = 1;
  } else {
    console.log(`${email} is now System Admin.`);
  }
} finally {
  await client.end();
}
