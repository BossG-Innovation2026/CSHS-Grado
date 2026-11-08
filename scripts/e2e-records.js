// E2E: student records stay protected between classes, rosters are restricted,
// and deleting a grade level needs a password.
// Prereqs: app running, and scripts/e2e-m1.js already run against the same local
// database (it creates admin2@school.local).
// Usage: node scripts/e2e-records.js
const { chromium } = require("playwright");
const { randomUUID } = require("node:crypto");
const pg = require("pg");

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI sets the variables directly.
}

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const url = process.env.DATABASE_URL;
if (!url || !/127\.0\.0\.1|localhost/.test(url)) throw new Error("e2e-records only runs against a local database.");

const PASSWORD = "Password123!";
const STAMP = Date.now();
// Starts with 9 so it cannot appear inside the class names, which contain STAMP.
const LRN = `9${String(STAMP).slice(-11)}`;
const results = [];

function check(name, cond, extra = "") {
  results.push(!!cond);
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
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

async function createAccount(page, name, email, role) {
  await page.goto(`${BASE}/accounts/new`);
  await page.locator("#name").fill(name);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.locator("#role").selectOption(role);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/accounts");
}

async function enroll(page, classId, surname, firstname) {
  await page.goto(`${BASE}/classes/${classId}`);
  await page.locator('input[name="lrn"]').evaluate((el) => el.removeAttribute("pattern"));
  await page.locator('input[name="lrn"]').fill(enroll.lrn ?? LRN);
  await page.locator('input[name="surname"]').fill(surname);
  await page.locator('input[name="firstname"]').fill(firstname);
  await page.getByRole("button", { name: "Enroll student" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 5000 });
  await dialog.locator('input[type="password"]').fill(PASSWORD);
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await page.waitForTimeout(2500);
  return page.locator("body").innerText();
}

(async () => {
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const email = (who) => `${who}-${STAMP}@school.local`;
  await signIn(page, "admin2@school.local");
  await createAccount(page, "Adviser A", email("adviser-a"), "teacher");
  await createAccount(page, "Adviser B", email("adviser-b"), "teacher");
  await createAccount(page, "Unrelated Teacher", email("unrelated"), "teacher");
  await createAccount(page, "School Registrar", email("registrar"), "registrar");
  await signOut(page);

  const idOf = async (who) =>
    (await db.query('SELECT id FROM "user" WHERE email = $1', [email(who)])).rows[0].id;
  const classA = randomUUID();
  const classB = randomUUID();
  await db.query("INSERT INTO class (id, name, grade_level_id, adviser_id) VALUES ($1, $2, 'grade-11', $3)", [
    classA, `E2E A ${STAMP}`, await idOf("adviser-a"),
  ]);
  await db.query("INSERT INTO class (id, name, grade_level_id, adviser_id) VALUES ($1, $2, 'grade-11', $3)", [
    classB, `E2E B ${STAMP}`, await idOf("adviser-b"),
  ]);

  await signIn(page, email("adviser-a"));
  enroll.lrn = "12345";
  let body = await enroll(page, classA, "Santos", "Maria");
  check("LRN must be 12 digits", body.includes("exactly 12 digits"));
  enroll.lrn = LRN;
  body = await enroll(page, classA, "Santos", "Maria");
  check("adviser enrolls a new student", body.includes(LRN));
  body = await enroll(page, classA, "Santos", "Mariana");
  const own = (await db.query("SELECT firstname FROM student WHERE lrn = $1", [LRN])).rows[0].firstname;
  check("adviser can correct a student only in their class", own === "Mariana", own);
  await signOut(page);

  await signIn(page, email("adviser-b"));
  body = await enroll(page, classB, "Impostor", "Name");
  check("other class cannot overwrite the student", body.includes("belongs to a student in another class"));
  const enrolledInB = await db.query(
    "SELECT 1 FROM enrollment e JOIN student s ON s.id = e.student_id WHERE e.class_id = $1 AND s.lrn = $2",
    [classB, LRN]
  );
  check("student was not enrolled", enrolledInB.rowCount === 0);
  const kept = (await db.query("SELECT surname FROM student WHERE lrn = $1", [LRN])).rows[0].surname;
  check("existing record unchanged", kept === "Santos", kept);
  body = await enroll(page, classB, "santos", "MARIANA");
  check("matching details enroll in a second class", body.includes(LRN));
  await signOut(page);

  await signIn(page, email("unrelated"));
  await page.goto(`${BASE}/classes/${classA}`);
  body = await page.locator("body").innerText();
  check("unrelated teacher cannot see the roster", !body.includes(LRN) && body.includes("can see its students"));
  await signOut(page);

  await signIn(page, email("registrar"));
  await page.goto(`${BASE}/classes/${classA}`);
  check("registrar can see the roster", (await page.locator("body").innerText()).includes(LRN));
  await signOut(page);

  const levelId = `e2e-level-${STAMP}`;
  await db.query("INSERT INTO grade_level (id, name, sort_order) VALUES ($1, $2, 900)", [levelId, `E2E Level ${STAMP}`]);
  const levelExists = async () => (await db.query("SELECT 1 FROM grade_level WHERE id = $1", [levelId])).rowCount === 1;
  await signIn(page, "admin2@school.local");
  await page.goto(`${BASE}/curriculum/${levelId}`);
  await page.getByRole("button", { name: "Delete grade level" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[type="password"]').fill("WrongPass999!");
  await dialog.getByRole("button", { name: "Delete grade level" }).click();
  await page.waitForTimeout(2500);
  check("grade level delete refuses a wrong password", (await dialog.innerText()).includes("Incorrect password") && (await levelExists()));
  await dialog.locator('input[type="password"]').fill(PASSWORD);
  await dialog.getByRole("button", { name: "Delete grade level" }).click();
  await page.waitForURL("**/curriculum", { timeout: 15000 });
  check("grade level delete works with the password", !(await levelExists()));

  // School years and curriculum grouping (the current year comes from a migration).
  const NEW_YEAR = "2099-2100";
  await db.query("DELETE FROM school_year WHERE id = $1", [NEW_YEAR]);
  await page.goto(`${BASE}/settings/school-year`);
  body = await page.locator("body").innerText();
  check("current school year is listed", body.includes("SY 2026-2027") && body.includes("Current"));
  await page.locator('input[name="startsOn"]').first().fill("2099-06-01");
  await page.locator('input[name="endsOn"]').first().fill("2100-04-01");
  await page.getByRole("button", { name: "Add school year" }).click();
  await page.getByText(`SY ${NEW_YEAR}`).waitFor({ timeout: 15000 });
  const added = await db.query("SELECT policy_key, is_current FROM school_year WHERE id = $1", [NEW_YEAR]);
  check("new school year uses zero-based grading", added.rows[0]?.policy_key === "zero-based" && !added.rows[0].is_current);
  const terms = await db.query("SELECT 1 FROM school_year_term WHERE school_year_id = $1", [NEW_YEAR]);
  check("new school year gets three terms", terms.rowCount === 3);

  const newSection = page.locator("section", { hasText: `SY ${NEW_YEAR}` });
  await newSection.locator('input[name="startsOn1"]').fill("2099-06-01");
  await newSection.getByRole("button", { name: "Save term dates" }).click();
  await newSection.getByText("Saved.").waitFor({ timeout: 15000 });
  const term1 = await db.query("SELECT starts_on::text AS d FROM school_year_term WHERE school_year_id = $1 AND term = 1", [NEW_YEAR]);
  check("term dates save", term1.rows[0]?.d === "2099-06-01", term1.rows[0]?.d);
  await db.query("DELETE FROM school_year WHERE id = $1", [NEW_YEAR]);

  const code = `E2E${STAMP}`;
  const subjectId = randomUUID();
  await db.query("INSERT INTO subject (id, grade_level_id, code, title) VALUES ($1, 'grade-11', $2, 'E2E Subject')", [subjectId, code]);
  await db.query(
    "INSERT INTO class_subject (id, class_id, subject_id, code, title, term) VALUES ($1, $2, $3, $4, 'E2E Subject', 1)",
    [randomUUID(), classA, subjectId, code]
  );
  await page.goto(`${BASE}/curriculum/grade-11`);
  await page.locator("tbody tr", { hasText: code }).locator('select[name="gradingGroup"]').selectOption("core");
  await page.waitForFunction(
    (c) => [...document.querySelectorAll("tbody tr")].find((r) => r.textContent.includes(c))?.querySelector("select")?.value === "core",
    code,
    { timeout: 15000 }
  );
  await page.waitForTimeout(1500);
  const saved = await db.query("SELECT grading_group FROM subject WHERE id = $1", [subjectId]);
  check("subject grading group saves", saved.rows[0]?.grading_group === "core", saved.rows[0]?.grading_group);
  const snapshot = await db.query("SELECT grading_group FROM class_subject WHERE subject_id = $1", [subjectId]);
  check("class subjects pick up the grading group", snapshot.rows[0]?.grading_group === "core");
  await page.reload();
  const shown = await page.locator("tbody tr", { hasText: code }).locator('select[name="gradingGroup"]').inputValue();
  check("grading group still shown after reload", shown === "core", shown);
  const do8 = await page.goto(`${BASE}/curriculum/grade-12`);
  body = await page.locator('select[name="gradingGroup"]').first().innerText();
  check("Grade 12 offers DO 8 groups", do8.ok() && body.includes("Academic track") && !body.includes("TechPro"));

  await browser.close();
  await db.end();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
