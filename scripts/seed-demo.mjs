// Fill the DEMO database with fake data: one account per role (see
// src/demo/accounts.json), a fake school, Grade 11/12 subjects, two classes
// and fake students. Every name, LRN and email here is invented.
//
// Usage: DATABASE_URL=<demo db> node scripts/seed-demo.mjs [--reset]
//   --reset  wipe classes/students/accounts first (demo visitors change things)
//
// Safety: refuses to run if the database has any account outside @demo.grado,
// so it cannot touch the real school's data.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import { hashPassword } from "better-auth/crypto";

const demo = JSON.parse(readFileSync(new URL("../src/demo/accounts.json", import.meta.url), "utf8"));
const DOMAIN = "@demo.grado";
const reset = process.argv.includes("--reset");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL (the demo database) is not set.");

const SUBJECTS = {
  "grade-11": [
    ["OC11", "Oral Communication in Context", 1, 1],
    ["KPWKP11", "Komunikasyon at Pananaliksik sa Wika at Kulturang Pilipino", 1, 1],
    ["GM11", "General Mathematics", 1, 1],
    ["ELS11", "Earth and Life Science", 1, 1],
    ["PD11", "Personal Development", 1, 1],
    ["PEH11", "Physical Education and Health", 3, 1],
  ],
  "grade-12": [
    ["SP12", "Statistics and Probability", 1, 1],
    ["PS12", "Physical Science", 1, 1],
    ["UCSP12", "Understanding Culture, Society and Politics", 1, 1],
    ["MIL12", "Media and Information Literacy", 1, 1],
    ["PEH12", "Physical Education and Health", 3, 1],
  ],
};
const SURNAMES = ["Santos", "Reyes", "Cruz", "Bautista", "Ocampo", "Garcia", "Mendoza", "Torres", "Flores", "Villanueva", "Ramos", "Aquino", "Castillo", "Rivera", "Navarro", "Domingo", "Salazar", "Mercado", "Pascual", "Valdez"];
const FIRST = ["Juan", "Maria", "Jose", "Ana", "Mark", "Angel", "John", "Princess", "Carlo", "Bea", "Paolo", "Kim", "Miguel", "Jasmine", "Rafael", "Nicole", "Gabriel", "Andrea", "Luis", "Camille"];

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const strangers = await client.query(`SELECT count(*)::int AS n FROM "user" WHERE email NOT LIKE $1`, [`%${DOMAIN}`]);
  if (strangers.rows[0].n > 0) {
    throw new Error(`This database has ${strangers.rows[0].n} non-demo account(s). seed-demo only runs on the demo database.`);
  }

  await client.query("BEGIN");
  if (reset) {
    await client.query('TRUNCATE enrollment, student, class_subject, class, subject, session, account, verification, rate_limit, notification, "user" CASCADE');
    console.log("reset: demo data wiped");
  }

  await client.query(
    `INSERT INTO school_settings (id, name, address, school_id, principal, updated_at)
     VALUES ('school', 'Demo Senior High School (fake data)', 'Sample City', '000000', 'Demo Principal', now())
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, address = excluded.address,
       school_id = excluded.school_id, principal = excluded.principal, updated_at = now()`
  );

  // Accounts: one per role, same demo password.
  const passwordHash = await hashPassword(demo.password);
  const ids = {};
  for (const a of demo.accounts) {
    if (!a.email.endsWith(DOMAIN)) throw new Error(`Demo account ${a.email} must use ${DOMAIN}`);
    const saved = await client.query(
      `INSERT INTO "user" (id, name, email, email_verified, role, permissions, active)
       VALUES ($1, $2, $3, true, $4, $5, true)
       ON CONFLICT (email) DO UPDATE SET name = excluded.name, role = excluded.role,
         permissions = excluded.permissions, active = true, updated_at = now()
       RETURNING id`,
      [randomUUID(), a.name, a.email, a.role, JSON.stringify(a.permissions)]
    );
    const userId = saved.rows[0].id;
    ids[a.role] = userId;
    await client.query(`DELETE FROM account WHERE user_id = $1 AND provider_id = 'credential'`, [userId]);
    await client.query(
      `INSERT INTO account (id, account_id, provider_id, user_id, password) VALUES ($1, $2, 'credential', $2, $3)`,
      [randomUUID(), userId, passwordHash]
    );
  }

  // Curriculum.
  const subjectIds = {};
  for (const [grade, list] of Object.entries(SUBJECTS)) {
    for (const [code, title, terms, units] of list) {
      const r = await client.query(
        `INSERT INTO subject (id, grade_level_id, code, title, terms, credit_units) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (grade_level_id, code) DO UPDATE SET title = excluded.title RETURNING id`,
        [randomUUID(), grade, code, title, terms, units]
      );
      subjectIds[`${grade}:${code}`] = r.rows[0].id;
    }
  }

  // Classes, their Term 1 subjects and fake students.
  const classes = [
    { grade: "grade-11", name: "Grade 11 - A", adviser: ids.teacher, students: 20, lrnBase: 900000000100 },
    { grade: "grade-12", name: "Grade 12 - A", adviser: ids.admin, students: 15, lrnBase: 900000000200 },
  ];
  let studentCount = 0;
  for (const c of classes) {
    const cls = await client.query(
      `INSERT INTO class (id, name, grade_level_id, adviser_id) VALUES ($1, $2, $3, $4)
       ON CONFLICT (grade_level_id, name) DO UPDATE SET adviser_id = excluded.adviser_id RETURNING id`,
      [randomUUID(), c.name, c.grade, c.adviser]
    );
    const classId = cls.rows[0].id;
    for (const [i, [code, title]] of SUBJECTS[c.grade].entries()) {
      await client.query(
        `INSERT INTO class_subject (id, class_id, subject_id, code, title, teacher_id, term)
         VALUES ($1, $2, $3, $4, $5, $6, 1) ON CONFLICT (class_id, code, term) DO NOTHING`,
        [randomUUID(), classId, subjectIds[`${c.grade}:${code}`], code, title, i % 2 === 0 ? ids.teacher : null]
      );
    }
    for (let i = 0; i < c.students; i++) {
      const lrn = String(c.lrnBase + i);
      const s = await client.query(
        `INSERT INTO student (id, lrn, surname, firstname, middlename, sex) VALUES ($1, $2, $3, $4, '', $5)
         ON CONFLICT (lrn) DO UPDATE SET surname = excluded.surname RETURNING id`,
        [randomUUID(), lrn, SURNAMES[(i * 7 + c.students) % SURNAMES.length], FIRST[(i * 3) % FIRST.length], i % 2 ? "F" : "M"]
      );
      await client.query(
        `INSERT INTO enrollment (id, class_id, student_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [randomUUID(), classId, s.rows[0].id]
      );
      studentCount += 1;
    }
  }

  await client.query("COMMIT");
  console.log(`Demo data ready: ${demo.accounts.length} accounts (password ${demo.password}), ` +
    `${Object.values(SUBJECTS).flat().length} subjects, ${classes.length} classes, ${studentCount} fake students.`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`seed-demo failed, nothing was written: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
