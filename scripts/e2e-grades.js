// E2E: final-grade entry, Excel upload, submission lock, adviser consolidation,
// and the guards that stop grades being deleted. Grado never computes grades.
// Prereqs: app running, and scripts/e2e-m1.js already run against the same local
// database (it creates admin2@school.local).
// Usage: node scripts/e2e-grades.js
const { chromium } = require("playwright");
const { randomUUID } = require("node:crypto");
const { writeFileSync, mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const pg = require("pg");
const XLSX = require("xlsx");

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI sets the variables directly.
}

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const url = process.env.DATABASE_URL;
if (!url || !/127\.0\.0\.1|localhost/.test(url)) throw new Error("e2e-grades only runs against a local database.");

const PASSWORD = "Password123!";
const STAMP = Date.now();
const results = [];

function check(name, cond, extra = "") {
  results.push(!!cond);
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra !== "" ? `  (${extra})` : ""}`);
}

async function signIn(page, email) {
  await page.goto(`${BASE}/login`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30000 });
}

async function signOut(page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
}

async function createTeacher(page, name, email) {
  await page.goto(`${BASE}/accounts/new`);
  await page.locator("#name").fill(name);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.locator("#role").selectOption("teacher");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/accounts");
}

async function submit(page) {
  await page.getByRole("button", { name: "Submit grades" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
  await page.waitForTimeout(2500);
}

(async () => {
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const teacherEmail = `grader-${STAMP}@school.local`;
  const otherEmail = `other-${STAMP}@school.local`;
  await signIn(page, "admin2@school.local");
  await createTeacher(page, "Grading Teacher", teacherEmail);
  await createTeacher(page, "Other Teacher", otherEmail);
  await signOut(page);

  const teacherId = (await db.query('SELECT id FROM "user" WHERE email = $1', [teacherEmail])).rows[0].id;
  const classId = randomUUID();
  const subjectId = randomUUID();
  const excelSubjectId = randomUUID();
  const code = `G${String(STAMP).slice(-6)}`;
  const excelCode = `X${String(STAMP).slice(-6)}`;
  await db.query("INSERT INTO class (id, name, grade_level_id, adviser_id) VALUES ($1, $2, 'grade-11', $3)", [classId, `Grades ${STAMP}`, teacherId]);
  for (const [id, c] of [[subjectId, code], [excelSubjectId, excelCode]]) {
    await db.query(
      "INSERT INTO class_subject (id, class_id, code, title, teacher_id, term) VALUES ($1, $2, $3, 'Graded Subject', $4, 1)",
      [id, classId, c, teacherId]
    );
  }
  const learners = [];
  for (const [i, surname] of ["Alpha", "Bravo"].entries()) {
    const id = randomUUID();
    const lrn = `8${String(STAMP + i).slice(-11)}`;
    await db.query("INSERT INTO student (id, lrn, surname, firstname, sex) VALUES ($1, $2, $3, 'Learner', 'F')", [id, lrn, surname]);
    await db.query("INSERT INTO enrollment (id, class_id, student_id) VALUES ($1, $2, $3)", [randomUUID(), classId, id]);
    learners.push({ id, lrn });
  }
  const [alpha, bravo] = learners;
  const input = (id) => page.locator(`input[data-grade="${id}"]`);
  const consolidated = (s, l) => page.locator(`[data-consolidated="${s}:${l}"]`).innerText();

  await signIn(page, teacherEmail);
  await page.goto(`${BASE}/grades`);
  check("teacher sees assigned subjects", (await page.locator("body").innerText()).includes(code));

  await page.goto(`${BASE}/grades/${subjectId}`);
  await submit(page);
  let body = await page.locator("body").innerText();
  const noSubmission = await db.query("SELECT 1 FROM grade_submission WHERE class_subject_id = $1", [subjectId]);
  check("blank grades block submission", body.includes("have no saved final grade") && noSubmission.rowCount === 0);

  await input(alpha.id).fill("88");
  await input(bravo.id).fill("59");
  check("an out-of-range grade is flagged", (await input(bravo.id).getAttribute("aria-invalid")) === "true");
  await page.getByRole("button", { name: /Save \d+ change/ }).click();
  await page.waitForTimeout(2000);
  body = await page.locator("body").innerText();
  const none = await db.query("SELECT 1 FROM final_grade WHERE class_subject_id = $1", [subjectId]);
  check("invalid save writes nothing", body.includes("Nothing was saved") && none.rowCount === 0);

  await input(bravo.id).fill("74");
  await page.getByRole("button", { name: /Save \d+ change/ }).click();
  await page.getByRole("button", { name: "Saved", exact: true }).waitFor({ timeout: 15000 });
  await page.reload();
  check("grades persist after reload", (await input(alpha.id).inputValue()) === "88" && (await input(bravo.id).inputValue()) === "74");
  const audit = await db.query("SELECT detail FROM audit_log WHERE action = 'final_grades.save' AND entity_id = $1", [subjectId]);
  check("grade changes are audited", audit.rowCount === 1 && audit.rows[0].detail.changes.length === 2);

  await page.goto(`${BASE}/classes/${classId}/grades?term=1`);
  check("drafts stay hidden from the consolidated sheet", (await consolidated(subjectId, alpha.id)).trim() === "—");

  await page.goto(`${BASE}/grades/${subjectId}`);
  await submit(page);
  const submission = await db.query("SELECT status FROM grade_submission WHERE class_subject_id = $1", [subjectId]);
  check("submission is recorded", submission.rows[0]?.status === "submitted");
  await page.reload();
  check("submitted sheet is locked", await input(alpha.id).isDisabled());
  check("submit is no longer offered", (await page.getByRole("button", { name: "Submit grades" }).count()) === 0);

  await page.goto(`${BASE}/classes/${classId}`);
  await page.getByRole("link", { name: "Consolidated grades" }).click();
  await page.waitForURL(`**/classes/${classId}/grades`);
  body = await page.locator("body").innerText();
  check("adviser sees submitted grades consolidated", (await consolidated(subjectId, alpha.id)) === "88" && (await consolidated(subjectId, bravo.id)) === "74");
  check("consolidated sheet shows progress and every subject", body.includes("1 of 2 subject(s) submitted") && body.includes(excelCode));
  await page.goto(`${BASE}/classes/${classId}/grades?term=2`);
  check("other terms are separate", (await page.locator("body").innerText()).includes("No subjects are set up for Term 2"));

  // Excel.
  await page.goto(`${BASE}/grades/${excelSubjectId}`);
  const template = await page.request.get(`${BASE}/grades/${excelSubjectId}/template.xlsx`);
  check("Excel template downloads", template.ok());
  const workbook = XLSX.read(await template.body(), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
  const folder = mkdtempSync(join(tmpdir(), "grado-e2e-"));
  const upload = async (name, data) => {
    const file = join(folder, name);
    const out = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(data), "Final Grades");
    writeFileSync(file, XLSX.write(out, { bookType: "xlsx", type: "buffer" }));
    await page.locator('input[name="file"]').setInputFiles(file);
    await page.getByRole("button", { name: "Upload grades" }).click();
    await page.waitForTimeout(2500);
  };
  const countGrades = async () => (await db.query("SELECT count(*)::int n FROM final_grade WHERE class_subject_id = $1", [excelSubjectId])).rows[0].n;

  await upload("bad.xlsx", rows.map((r) => ({ ...r, "Final Grade": 101 })));
  body = await page.locator("body").innerText();
  check("Excel out-of-range grade writes nothing", body.includes("Nothing was saved") && (await countGrades()) === 0);

  await upload("stranger.xlsx", [{ LRN: "999999999999", Surname: "X", Firstname: "Y", "Final Grade": 90 }]);
  body = await page.locator("body").innerText();
  check("Excel with an unknown LRN writes nothing", body.includes("is not enrolled") && (await countGrades()) === 0);

  await upload("good.xlsx", rows.map((r, i) => ({ ...r, "Final Grade": i === 0 ? 91 : "" })));
  body = await page.locator("body").innerText();
  check("Excel upload saves grades and skips blanks", body.includes("Saved 1 change") && (await countGrades()) === 1, await countGrades());

  // Deleting graded work is refused.
  await page.goto(`${BASE}/classes/${classId}`);
  await page.getByRole("button", { name: "Delete class" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[type="password"]').fill(PASSWORD);
  await dialog.getByRole("button", { name: "Delete class" }).click();
  await page.waitForTimeout(2500);
  const stillThere = await db.query("SELECT 1 FROM class WHERE id = $1", [classId]);
  check("class with grades cannot be deleted", (await dialog.innerText()).includes("has grades") && stillThere.rowCount === 1);
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await page.locator("tbody tr", { hasText: "Alpha" }).getByRole("button", { name: "Unenroll" }).click();
  await page.getByRole("dialog").locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await page.waitForTimeout(2500);
  const enrolled = await db.query("SELECT 1 FROM enrollment WHERE class_id = $1 AND student_id = $2", [classId, alpha.id]);
  check("learner with grades cannot be unenrolled", enrolled.rowCount === 1 && (await page.locator("body").innerText()).includes("cannot be unenrolled"));
  await signOut(page);

  // Access.
  await signIn(page, otherEmail);
  await page.goto(`${BASE}/grades/${subjectId}`);
  body = await page.locator("body").innerText();
  check("another teacher cannot open the sheet", body.includes("not assigned to you") && !body.includes(alpha.lrn));
  const denied = await page.request.get(`${BASE}/grades/${subjectId}/template.xlsx`);
  check("another teacher cannot download the template", denied.status() === 404, denied.status());
  await page.goto(`${BASE}/classes/${classId}/grades`);
  body = await page.locator("body").innerText();
  check("another teacher cannot see consolidated grades", body.includes("do not have access") && !body.includes(alpha.lrn));
  await signOut(page);

  await signIn(page, "admin2@school.local");
  await page.goto(`${BASE}/grades/${subjectId}`);
  check("System Admin cannot enter grades", (await page.locator("body").innerText()).includes("not assigned to you"));

  check("no browser errors", errors.length === 0, errors.join(" | "));
  await browser.close();
  await db.end();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
