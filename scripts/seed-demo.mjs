// Fill the DEMO database with fake data: one account per role (see
// src/demo/accounts.json), a fake school, Grade 11/12 subjects, two classes,
// fake students, grades in every workflow state, parent links, academic
// records, signed sheets and record hand-overs. Every name, LRN, date and
// email here is invented.
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
const PARENT_FIRST = ["Rosa", "Pedro", "Lourdes", "Ramon", "Teresa", "Benito", "Celia", "Arturo", "Gloria", "Mario"];
// One status per subject, so the demo has something in every workflow state.
const STATUSES = ["approved", "submitted", "verified", "draft", "returned", "approved"];

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const strangers = await client.query(`SELECT count(*)::int AS n FROM "user" WHERE email NOT LIKE $1`, [`%${DOMAIN}`]);
  if (strangers.rows[0].n > 0) {
    throw new Error(`This database has ${strangers.rows[0].n} non-demo account(s). seed-demo only runs on the demo database.`);
  }

  await client.query("BEGIN");
  if (reset) {
    await client.query(
      `TRUNCATE audit_log, record_surrender, academic_record, signed_sheet, grade_submission, grade,
         parent_link, enrollment, student, class_subject, class, subject, session, account, verification,
         rate_limit, notification, "user" CASCADE`
    );
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
  const everyone = [
    ...demo.accounts,
    ...demo.extraTeachers.map((t) => ({
      ...t,
      role: "teacher",
      permissions: ["classes", "grades_submit", "grades_approve", "personal_info"],
    })),
  ];
  for (const a of everyone) {
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
    ids[a.email] = userId;
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
  // Grade 11 - A: the Class Adviser also teaches some of its subjects.
  // Grade 12 - A: advised by Reyes; the Subject Teacher teaches in both classes.
  const adviser = ids["adviser@demo.grado"];
  const subjectTeacher = ids["teacher@demo.grado"];
  const reyes = ids["reyes@demo.grado"];
  const registrar = ids["registrar@demo.grado"];
  const parent = ids["parent@demo.grado"];
  const classes = [
    { grade: "grade-11", name: "Grade 11 - A", adviser, teachers: [adviser, subjectTeacher], students: 20, lrnBase: 900000000100 },
    { grade: "grade-12", name: "Grade 12 - A", adviser: reyes, teachers: [subjectTeacher, reyes], students: 15, lrnBase: 900000000200 },
  ];
  const classIds = {};
  const studentsByClass = {};
  const offerings = [];

  for (const c of classes) {
    const cls = await client.query(
      `INSERT INTO class (id, name, grade_level_id, adviser_id) VALUES ($1, $2, $3, $4)
       ON CONFLICT (grade_level_id, name) DO UPDATE SET adviser_id = excluded.adviser_id RETURNING id`,
      [randomUUID(), c.name, c.grade, c.adviser]
    );
    const classId = cls.rows[0].id;
    classIds[c.grade] = classId;
    studentsByClass[classId] = [];

    for (const [i, [code, title]] of SUBJECTS[c.grade].entries()) {
      const teacherId = c.teachers[i % 2];
      const cs = await client.query(
        `INSERT INTO class_subject (id, class_id, subject_id, code, title, teacher_id, term)
         VALUES ($1, $2, $3, $4, $5, $6, 1)
         ON CONFLICT (class_id, code, term) DO UPDATE SET title = excluded.title, teacher_id = excluded.teacher_id
         RETURNING id`,
        [randomUUID(), classId, subjectIds[`${c.grade}:${code}`], code, title, teacherId]
      );
      offerings.push({
        id: cs.rows[0].id,
        classId,
        code,
        title,
        term: 1,
        status: STATUSES[i % STATUSES.length],
        teacherId,
        adviserId: c.adviser,
      });
    }

    for (let i = 0; i < c.students; i++) {
      const lrn = String(c.lrnBase + i);
      const surname = SURNAMES[(i * 7 + c.students) % SURNAMES.length];
      const firstname = FIRST[(i * 3) % FIRST.length];
      const birthYear = c.grade === "grade-11" ? 2008 : 2007;
      const birthDate = `${birthYear}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`;
      const linkedParent = c.grade === "grade-11" && i === 0;
      const s = await client.query(
        `INSERT INTO student (id, lrn, surname, firstname, middlename, sex, birth_date, parent_name, parent_contact, address)
         VALUES ($1, $2, $3, $4, '', $5, $6, $7, $8, $9)
         ON CONFLICT (lrn) DO UPDATE SET surname = excluded.surname, firstname = excluded.firstname,
           sex = excluded.sex, birth_date = excluded.birth_date, parent_name = excluded.parent_name,
           parent_contact = excluded.parent_contact, address = excluded.address
         RETURNING id`,
        [
          randomUUID(),
          lrn,
          surname,
          firstname,
          i % 2 ? "F" : "M",
          birthDate,
          linkedParent ? "Demo Parent" : `${PARENT_FIRST[i % PARENT_FIRST.length]} ${surname}`,
          `0917-000-${String(1000 + i).slice(-4)}`,
          `${i + 1} Sample Street, Sample City`,
        ]
      );
      const studentId = s.rows[0].id;
      studentsByClass[classId].push(studentId);
      await client.query(
        `INSERT INTO enrollment (id, class_id, student_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [randomUUID(), classId, studentId]
      );
    }
  }

  // Grades for every student in every subject, in every workflow state.
  const now = new Date();
  for (const [j, o] of offerings.entries()) {
    const studentIds = studentsByClass[o.classId];
    const subjectTeacherId = o.teacherId ?? o.adviserId;
    for (const [i, studentId] of studentIds.entries()) {
      const value = o.status === "draft" && i % 4 === 0 ? null : 78 + ((i * 3 + j * 5) % 20);
      await client.query(
        `INSERT INTO grade (id, class_subject_id, student_id, value, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (class_subject_id, student_id) DO UPDATE SET value = excluded.value,
           updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
        [randomUUID(), o.id, studentId, value, subjectTeacherId, now]
      );
    }

    const submitted = o.status !== "draft";
    const verified = o.status === "verified" || o.status === "approved";
    const approved = o.status === "approved";
    const submittedAt = submitted ? new Date(now.getTime() - (j + 1) * 86400000) : null;
    const verifiedAt = verified ? new Date(now.getTime() - j * 86400000) : null;
    const approvedAt = approved ? new Date(now.getTime() - j * 43200000) : null;
    await client.query(
      `INSERT INTO grade_submission (id, class_subject_id, status, submitted_by, submitted_at,
         adviser_verified_by, adviser_verified_at, registrar_verified_by, registrar_verified_at,
         approved_by, approved_at, return_note, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (class_subject_id) DO UPDATE SET status = excluded.status,
         submitted_by = excluded.submitted_by, submitted_at = excluded.submitted_at,
         adviser_verified_by = excluded.adviser_verified_by, adviser_verified_at = excluded.adviser_verified_at,
         registrar_verified_by = excluded.registrar_verified_by, registrar_verified_at = excluded.registrar_verified_at,
         approved_by = excluded.approved_by, approved_at = excluded.approved_at,
         return_note = excluded.return_note, updated_at = excluded.updated_at`,
      [
        randomUUID(),
        o.id,
        o.status,
        submitted ? subjectTeacherId : null,
        submittedAt,
        verified ? o.adviserId : null,
        verifiedAt,
        approved ? registrar : null,
        approvedAt,
        approved ? registrar : null,
        approvedAt,
        o.status === "returned" ? "Please double-check the encoded grades for this subject." : "",
        now,
      ]
    );

    if (o.status === "approved" || o.status === "verified") {
      const sheetId = `demo-signed-${o.id}`;
      await client.query(
        `INSERT INTO signed_sheet (id, class_subject_id, reference_no, received_by, received_at, note)
         VALUES ($1, $2, $3, $4, now(), $5)
         ON CONFLICT (id) DO UPDATE SET reference_no = excluded.reference_no,
           received_by = excluded.received_by, note = excluded.note`,
        [sheetId, o.id, `DEMO-${o.code}-${o.term}`, registrar, "Signed paper sheet on file."]
      );
    }
  }

  // Parent portal: link the demo parent to one Grade 11 student.
  const linkedChild = studentsByClass[classIds["grade-11"]][0];
  await client.query(
    `INSERT INTO parent_link (id, user_id, student_id, relationship)
     VALUES ($1, $2, $3, 'Parent')
     ON CONFLICT (user_id, student_id) DO UPDATE SET relationship = excluded.relationship`,
    ["demo-parent-link", parent, linkedChild]
  );

  // Junior high school records that feed Form 137.
  const jhsStudents = studentsByClass[classIds["grade-11"]].slice(0, 3);
  for (const [i, studentId] of jhsStudents.entries()) {
    const subjects = JSON.stringify([
      { subject: "Filipino", grade: String(88 + i) },
      { subject: "English", grade: String(90 + i) },
      { subject: "Mathematics", grade: String(86 + i) },
      { subject: "Science", grade: String(89 + i) },
      { subject: "Araling Panlipunan", grade: String(87 + i) },
      { subject: "Values Education", grade: String(92 + i) },
    ]);
    await client.query(
      `INSERT INTO academic_record (id, student_id, school_name, school_year, grade_level,
         general_average, honors, completed, subjects, note)
       VALUES ($1, $2, $3, $4, 'Grade 10', $5, $6, true, $7, $8)
       ON CONFLICT (id) DO UPDATE SET school_name = excluded.school_name, school_year = excluded.school_year,
         general_average = excluded.general_average, honors = excluded.honors,
         completed = excluded.completed, subjects = excluded.subjects, note = excluded.note`,
      [
        `demo-academic-${studentId}`,
        studentId,
        "Sample National High School (fake data)",
        "2024-2025",
        String(89 + i),
        i === 0 ? "With Honors" : "",
        subjects,
        "Complete JHS record submitted on enrolment.",
      ]
    );
  }

  // Record custody: one student waiting for the registrar, one already filed.
  const g12Students = studentsByClass[classIds["grade-12"]];
  await client.query(
    `INSERT INTO record_surrender (id, student_id, class_id, reason, status, surrendered_by,
       surrendered_at, received_by, received_at, note)
     VALUES ($1, $2, $3, 'transferred', 'pending', $4, now() - interval '2 days', NULL, NULL, $5)
     ON CONFLICT (id) DO UPDATE SET student_id = excluded.student_id, class_id = excluded.class_id,
       reason = excluded.reason, status = excluded.status, surrendered_by = excluded.surrendered_by,
       received_by = excluded.received_by, received_at = excluded.received_at, note = excluded.note`,
    ["demo-surrender-pending", g12Students[0], classIds["grade-12"], reyes, "Student transferred to another school."]
  );
  await client.query(
    `INSERT INTO record_surrender (id, student_id, class_id, reason, status, surrendered_by,
       surrendered_at, received_by, received_at, note)
     VALUES ($1, $2, $3, 'graduated', 'received', $4, now() - interval '10 days', $5, now() - interval '9 days', $6)
     ON CONFLICT (id) DO UPDATE SET student_id = excluded.student_id, class_id = excluded.class_id,
       reason = excluded.reason, status = excluded.status, surrendered_by = excluded.surrendered_by,
       received_by = excluded.received_by, received_at = excluded.received_at, note = excluded.note`,
    ["demo-surrender-received", g12Students[1], classIds["grade-12"], reyes, registrar, "Permanent record filed."]
  );

  // A short audit trail so the registrar's log has something to show.
  const auditRows = [
    [registrar, "Demo Registrar", "grades.approve", "class_subject", offerings[0].id, `${offerings[0].code} · Term 1`],
    [reyes, "Demo Adviser Reyes", "record.surrender", "student", g12Students[0], "transferred"],
    [registrar, "Demo Registrar", "parent.link", "student", linkedChild, "Demo Parent <parent@demo.grado> · Parent"],
    [registrar, "Demo Registrar", "academic.add", "student", jhsStudents[0], "Sample National High School (fake data)"],
    [registrar, "Demo Registrar", "signed_sheet.receive", "class_subject", offerings[0].id, `DEMO-${offerings[0].code}-1`],
  ];
  for (const [i, [actorId, actorName, action, entity, entityId, detail]] of auditRows.entries()) {
    await client.query(
      `INSERT INTO audit_log (id, actor_id, actor_name, action, entity, entity_id, detail, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now() - ($8 || ' hours')::interval)
       ON CONFLICT (id) DO UPDATE SET actor_id = excluded.actor_id, actor_name = excluded.actor_name,
         action = excluded.action, entity = excluded.entity, entity_id = excluded.entity_id,
         detail = excluded.detail`,
      [`demo-audit-${i + 1}`, actorId, actorName, action, entity, entityId, detail, i * 12]
    );
  }

  await client.query("COMMIT");
  console.log(
    `Demo data ready: ${everyone.length} accounts (password ${demo.password}), ` +
      `${Object.values(SUBJECTS).flat().length} subjects, ${classes.length} classes, ` +
      `${offerings.length} subject sheets in every workflow state, ` +
      `${Object.values(studentsByClass).flat().length} fake students, 1 parent link.`
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`seed-demo failed, nothing was written: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
