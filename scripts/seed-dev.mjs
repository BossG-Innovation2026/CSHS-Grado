// Local development seed: one teacher account, three Grade 11 subjects, and
// the class "Grade 11 - B" with two subjects. Used by scripts/verify-passwords.js.
// Usage: npm run db:migrate && npm run db:seed-dev
// Env overrides: SEED_EMAIL, SEED_PASSWORD, SEED_NAME. Never run against production.
import { randomUUID } from "node:crypto";
import pg from "pg";
import { hashPassword } from "better-auth/crypto";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (see .env.example).");
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("seed-dev only runs against a local database.");

const EMAIL = (process.env.SEED_EMAIL || "repro2@school.local").toLowerCase();
const PASSWORD = process.env.SEED_PASSWORD || "ReproPass123!";
const NAME = process.env.SEED_NAME || "Repro Two";
const CLASS_ID = "22222222-3333-4444-5555-666666666666";
const PERMISSIONS = JSON.stringify(["classes", "curriculum"]);

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("BEGIN");
  const existing = await client.query('SELECT id FROM "user" WHERE email = $1', [EMAIL]);
  let userId = existing.rows[0]?.id;
  if (userId) {
    await client.query(`UPDATE "user" SET role = 'teacher', permissions = $1, active = true WHERE id = $2`, [PERMISSIONS, userId]);
    console.log("user exists; role/permissions refreshed ->", userId);
  } else {
    userId = randomUUID();
    await client.query(
      `INSERT INTO "user" (id, name, email, email_verified, role, permissions, active) VALUES ($1, $2, $3, true, 'teacher', $4, true)`,
      [userId, NAME, EMAIL, PERMISSIONS]
    );
    await client.query(
      `INSERT INTO account (id, account_id, provider_id, user_id, password) VALUES ($1, $2, 'credential', $2, $3)`,
      [randomUUID(), userId, await hashPassword(PASSWORD)]
    );
    console.log("user created ->", userId);
  }

  const subjectIds = {};
  for (const [id, code, title] of [
    ["sub-a", "OC11", "Oral Communication"],
    ["sub-b", "GM11", "General Mathematics"],
    ["sub-c", "ES11", "Earth and Life Science"],
  ]) {
    const saved = await client.query(
      `INSERT INTO subject (id, grade_level_id, code, title) VALUES ($1, 'grade-11', $2, $3)
       ON CONFLICT (grade_level_id, code) DO UPDATE SET title = excluded.title
       RETURNING id`,
      [id, code, title]
    );
    subjectIds[code] = saved.rows[0].id;
  }

  await client.query("DELETE FROM class WHERE id = $1 OR (grade_level_id = 'grade-11' AND name = 'Grade 11 - B')", [CLASS_ID]);
  await client.query(
    `INSERT INTO class (id, name, grade_level_id, adviser_id) VALUES ($1, 'Grade 11 - B', 'grade-11', $2)`,
    [CLASS_ID, userId]
  );
  await client.query(
    `INSERT INTO class_subject (id, class_id, subject_id, code, title, term) VALUES
       ('cs-a', $1, $2, 'OC11', 'Oral Communication', 1),
       ('cs-b', $1, $3, 'GM11', 'General Mathematics', 1)`,
    [CLASS_ID, subjectIds.OC11, subjectIds.GM11]
  );
  await client.query("COMMIT");
  console.log("seeded: subjects OC11/GM11/ES11, class 'Grade 11 - B' + 2 class subjects");
  console.log(`login -> ${EMAIL} (password from SEED_PASSWORD or the script default)`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
