// One-time data move from the old Cloudflare D1 (SQLite) database to Postgres.
//
// 1. Export D1:   npx wrangler d1 export shs-db --remote --output d1-export.sql
// 2. Migrate PG:  DATABASE_URL=<neon direct url> npm run db:migrate
// 3. Import:      DATABASE_URL=<neon direct url> npm run db:import-d1 -- d1-export.sql
//
// Accepts a .sql dump (from wrangler) or a .sqlite file. Runs in one
// transaction and refuses to touch a database that already has accounts
// unless --merge is passed (rows whose id already exists are then skipped).
// Sessions are not copied: everyone signs in again after the move.
// The export contains personal data: delete it once the import is verified.
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";

const args = process.argv.slice(2);
const source = args.find((a) => !a.startsWith("--"));
const merge = args.includes("--merge");
if (!source) {
  console.error("Usage: npm run db:import-d1 -- <d1-export.sql | file.sqlite> [--merge]");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set.");

let sqlite;
if (source.endsWith(".sql")) {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(source, "utf8"));
} else {
  sqlite = new DatabaseSync(source, { readOnly: true });
}

/**
 * D1 rows hold dates in more than one shape: the app wrote epoch milliseconds,
 * while better-auth may have written ISO text (or epoch seconds). Accept all.
 */
const toDate = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const text = String(v).trim();
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    const n = Number(text);
    return new Date(Math.abs(n) < 1e11 && n !== 0 ? n * 1000 : n); // seconds vs ms
  }
  const d = new Date(text.includes("T") || text.includes("Z") ? text : text.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? null : d;
};
/** Optional timestamp column. */
const ms = (v) => toDate(v);
/** Required timestamp column: fall back to "now" rather than failing the whole move. */
const msReq = (v) => toDate(v) ?? new Date();
const bool = (v) => v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true";
const tableExists = (name) =>
  Boolean(sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
const columnsOf = (name) => new Set(sqlite.prepare(`PRAGMA table_info("${name}")`).all().map((c) => c.name));
const rowsOf = (name) => (tableExists(name) ? sqlite.prepare(`SELECT * FROM "${name}"`).all() : []);

/** Tables in foreign-key order: [source table, target table, row mapper]. */
const PLAN = [
  ["user", "user", (r) => ({
    id: r.id, name: r.name, email: r.email, email_verified: bool(r.emailVerified), image: r.image ?? null,
    created_at: msReq(r.createdAt), updated_at: msReq(r.updatedAt), role: r.role ?? "teacher",
    permissions: r.permissions ?? "[]", active: r.active === undefined ? true : bool(r.active),
  })],
  ["account", "account", (r) => ({
    id: r.id, account_id: r.accountId, provider_id: r.providerId, user_id: r.userId,
    access_token: r.accessToken ?? null, refresh_token: r.refreshToken ?? null, id_token: r.idToken ?? null,
    access_token_expires_at: msReq(r.accessTokenExpiresAt), refresh_token_expires_at: msReq(r.refreshTokenExpiresAt),
    scope: r.scope ?? null, password: r.password ?? null, created_at: msReq(r.createdAt), updated_at: msReq(r.updatedAt),
  })],
  ["notification", "notification", (r) => ({
    id: r.id, user_id: r.userId, title: r.title, body: r.body ?? "", type: r.type ?? "info",
    read_at: ms(r.readAt), created_at: msReq(r.createdAt),
  })],
  ["school_settings", "school_settings", (r) => ({
    id: r.id, name: r.name ?? "", address: r.address ?? "", school_id: r.schoolId ?? "",
    principal: r.principal ?? "", updated_at: msReq(r.updatedAt),
  })],
  ["grade_level", "grade_level", (r) => ({
    id: r.id, name: r.name, sort_order: r.sortOrder, created_at: msReq(r.createdAt),
  })],
  ["subject", "subject", (r) => ({
    id: r.id, grade_level_id: r.gradeLevelId, code: r.code, title: r.title, terms: r.terms ?? 1,
    credit_units: r.creditUnits ?? 1, created_at: msReq(r.createdAt),
  })],
  ["class", "class", (r) => ({
    id: r.id, name: r.name, grade_level_id: r.gradeLevelId, adviser_id: r.adviserId, created_at: msReq(r.createdAt),
  })],
  ["class_subject", "class_subject", (r) => ({
    id: r.id, class_id: r.classId, subject_id: r.subjectId ?? null, code: r.code, title: r.title,
    description: r.description ?? "", teacher_id: r.teacherId ?? null, term: r.term ?? 1, created_at: msReq(r.createdAt),
  })],
  ["student", "student", (r) => ({
    id: r.id, lrn: r.lrn, surname: r.surname, firstname: r.firstname, middlename: r.middlename ?? "",
    sex: r.sex ?? "M", created_at: msReq(r.createdAt),
  })],
  ["enrollment", "enrollment", (r) => ({
    id: r.id, class_id: r.classId, student_id: r.studentId, created_at: msReq(r.createdAt),
  })],
];

/** Tables whose D1 values replace the defaults the seed migration created. */
const OVERWRITE = new Set(["school_settings"]);

async function insertRows(client, table, rows) {
  const onConflict = OVERWRITE.has(table)
    ? `ON CONFLICT ("id") DO UPDATE SET ${Object.keys(rows[0])
        .filter((c) => c !== "id")
        .map((c) => `"${c}" = excluded."${c}"`)
        .join(", ")}`
    : "ON CONFLICT DO NOTHING";
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const part = rows.slice(i, i + 500);
    const cols = Object.keys(part[0]);
    const values = [];
    const tuples = part.map((row, r) => {
      cols.forEach((c) => values.push(row[c]));
      return `(${cols.map((_, c) => `$${r * cols.length + c + 1}`).join(", ")})`;
    });
    const result = await client.query(
      `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES ${tuples.join(", ")} ${onConflict}`,
      values
    );
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const { rows: [{ n }] } = await client.query('SELECT count(*)::int AS n FROM "user"');
  if (n > 0 && !merge) {
    throw new Error(`Target already has ${n} account(s). Re-run with --merge to add only missing rows.`);
  }

  await client.query("BEGIN");
  const sourceGradeIds = rowsOf("grade_level").map((r) => r.id);
  for (const [from, to, map] of PLAN) {
    const rows = rowsOf(from).map(map);
    if (from === "user" && tableExists("user") && !columnsOf("user").has("active")) {
      console.warn("note: source user table has no 'active' column; everyone is imported as active");
    }
    const inserted = rows.length ? await insertRows(client, to, rows) : 0;
    console.log(`${to.padEnd(16)} source ${String(rows.length).padStart(5)}  inserted ${String(inserted).padStart(5)}`);
  }
  if (sourceGradeIds.length > 0 && !merge) {
    // Grade levels the school deleted in D1 come back from the seed migration; remove them again.
    const removed = await client.query(
      `DELETE FROM grade_level g WHERE NOT (g.id = ANY($1::text[]))
         AND NOT EXISTS (SELECT 1 FROM subject s WHERE s.grade_level_id = g.id)
         AND NOT EXISTS (SELECT 1 FROM class c WHERE c.grade_level_id = g.id)`,
      [sourceGradeIds]
    );
    if (removed.rowCount) console.log(`grade_level      removed ${removed.rowCount} level(s) not present in D1`);
  }
  await client.query("COMMIT");
  console.log("Import complete. Delete the export file now; it contains personal data.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`Import failed, nothing was written: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
  sqlite.close();
}
