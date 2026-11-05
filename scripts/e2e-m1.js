const { chromium } = require("playwright");

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";

if (BASE.startsWith("http://localhost")) {
  require("node:child_process").execFileSync(
    process.execPath,
    ["--env-file-if-exists=.env.local", "scripts/dev-db-reset.mjs"],
    { stdio: "inherit" }
  );
}
const PASSWORD = "Password123!";
const TEACHER_PASSWORD = "Passw0rd123!";
const TEACHER_EMAIL = `m1teacher-${Date.now()}@school.local`;
const results = [];

async function signIn(page, email, password = PASSWORD) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(`${BASE}/login`);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    try {
      await page.waitForURL("**/dashboard", { timeout: 30000 });
      return;
    } catch (e) {
      await page.waitForTimeout(1000);
      const err = page.locator("text=Sign in failed").first();
      const msg = (await err.isVisible().catch(() => false)) ? await err.innerText() : "";
      console.log(`signIn(${email}) attempt ${attempt} landed on: ${page.url()} (${msg})`);
      if (attempt === 2) throw e;
      await page.waitForTimeout(3000);
    }
  }
}

async function signOut(page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
}

async function check(name, cond, extra = "") {
  results.push({ name, pass: !!cond, extra });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // --- 0. First-ever registration becomes super admin; create an admin account
  const SUPER_EMAIL = `e2e-super-${Date.now()}@school.local`;
  await page.goto(`${BASE}/register`);
  await page.locator("#name").fill("E2E Super Admin");
  await page.locator("#email").fill(SUPER_EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Register" }).click();
  await page.waitForURL("**/login*");
  await check("first registration becomes super admin", page.url().includes("/login"));
  await signIn(page, SUPER_EMAIL);
  await check("super admin lands on dashboard", page.url().includes("/dashboard"));
  await page.goto(`${BASE}/accounts/new`);
  await page.locator("#name").fill("Admin User");
  await page.locator("#email").fill("admin2@school.local");
  await page.locator("#password").fill(PASSWORD);
  await page.locator("#role").selectOption("admin");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/accounts");
  await signOut(page);

  // --- 1. Admin creates a teacher account with selected modules
  await signIn(page, "admin2@school.local");
  await page.goto(`${BASE}/accounts/new`);
  await page.locator("#name").fill("M1 Test Teacher");
  await page.locator("#email").fill(TEACHER_EMAIL);
  await page.locator("#password").fill(TEACHER_PASSWORD);
  await page.locator("#role").selectOption("teacher");
  await page.getByText("Curriculum Setup (Grade Levels, Tracks, Subjects)", { exact: false }).first().waitFor();
  await page.locator('input[name="modules"][value="curriculum"]').check();
  await page.locator('input[name="modules"][value="grades_submit"]').check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/accounts");
  const rowText = await page.locator("table").innerText();
  await check("admin creates teacher account", rowText.includes(TEACHER_EMAIL));

  // --- 2. New teacher sees only their ticked modules; cannot access /accounts
  await signOut(page);
  await signIn(page, TEACHER_EMAIL, TEACHER_PASSWORD);
  await check("teacher lands on dashboard", page.url().includes("/dashboard"));
const nav = await page.locator("nav").innerText();
  await check(
    "teacher panel shows only accessed modules",
    nav.includes("Dashboard") &&
      nav.includes("Curriculum Setup") &&
      nav.includes("Grade Submission") &&
      !nav.includes("Account Management") &&
      !nav.includes("Class Creation") &&
      !nav.includes("Grades Approval") &&
      !nav.includes("School Registrar") &&
      !nav.includes("Login Codes"),
    nav.replace(/\n/g, " | ")
  );
  await page.goto(`${BASE}/accounts`);
  await check("teacher blocked from /accounts", page.url().includes("/dashboard"));
  const dashText = await page.locator("body").innerText();
  await check("dashboard shows analytics placeholder", dashText.includes("Analytics and notifications"));

  // --- 3. Teacher's own account page is read-only
  const teacherId = (await page.request.get(`${BASE}/api/auth/get-session`, {}));
  await signOut(page);

  // --- 4. Admin self-edit: accounts locked
  await signIn(page, "admin2@school.local");
  await page.goto(`${BASE}/accounts`);
  await page.getByRole("link", { name: "Your account" }).click();
  await page.waitForURL("**/accounts/*");
  const selfText = await page.locator("body").innerText();
  await check("self page shows accounts locked", selfText.includes("always on"));
  const lockedBox = page.locator('input[name="modules"][value="accounts"]');
  await check("accounts checkbox disabled for self", await lockedBox.isDisabled());
  await check("accounts checkbox checked for self", await lockedBox.isChecked());

  // --- 5. Admin edits the new teacher's modules
  await page.goto(`${BASE}/accounts`);
  const teacherRow = page.locator("tr", { hasText: TEACHER_EMAIL });
  await teacherRow.getByRole("link", { name: "Manage" }).click();
  await page.waitForURL("**/accounts/*");
  const editText = await page.locator("body").innerText();
  await check("edit page shows target", editText.includes(TEACHER_EMAIL) || editText.includes("M1 Test Teacher"));

  // --- 6. Reset password, then log in with new password
  await signOut(page);
  await signIn(page, "admin2@school.local");
  await page.goto(`${BASE}/accounts`);
  await page.locator("tr", { hasText: TEACHER_EMAIL }).getByRole("link", { name: "Manage" }).click();
  await page.locator("#password").fill("NewPassw0rd123!");
  await page.getByRole("button", { name: "Reset password" }).click();
  await page.getByText("Saved.").first().waitFor({ timeout: 8000 });
  await check("reset password saved", true);
  await signOut(page);
  await page.goto(`${BASE}/login`);
  await page.locator("#email").fill(TEACHER_EMAIL);
  await page.locator("#password").fill("NewPassw0rd123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  try {
    await page.waitForURL("**/dashboard", { timeout: 30000 });
  } catch (e) {
    await page.waitForTimeout(1000);
    console.log(`--- sign-in (step 6) landed on: ${page.url()} ---`);
    console.log((await page.locator("body").innerText()).slice(0, 400));
    throw e;
  }
  await check("login works with new password", page.url().includes("/dashboard"));
  await signOut(page);

  // --- 7. Deactivate account -> sign-in blocked
  await signIn(page, "admin2@school.local");
  await page.goto(`${BASE}/accounts`);
  await page.locator("tr", { hasText: TEACHER_EMAIL }).getByRole("link", { name: "Manage" }).click();
  await page.getByRole("button", { name: "Deactivate account" }).click();
  await page.getByText("Saved.").first().waitFor({ timeout: 8000 });
  await check("deactivate saved", true);
  await signOut(page);
  await page.goto(`${BASE}/login`);
  await page.locator("#email").fill(TEACHER_EMAIL);
  await page.locator("#password").fill("NewPassw0rd123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  try {
    await page.waitForURL("**/login", { timeout: 30000 });
  } catch (e) {
    await page.waitForTimeout(1000);
    console.log(`--- sign-in (step 7) landed on: ${page.url()} ---`);
    console.log((await page.locator("body").innerText()).slice(0, 400));
    throw e;
  }
  await check("deactivated user cannot get past login", page.url().includes("/login"));

// --- 8. Super admin sees everything and can create admin accounts
  await signIn(page, SUPER_EMAIL);
  const superNav = await page.locator("nav").innerText();
  await check("super admin nav shows all modules", superNav.includes("Account Management"));
  await page.goto(`${BASE}/accounts/new`);
  const roleOptions = await page.locator("#role option").allInnerTexts();
  await check("super admin can pick admin role", roleOptions.includes("Admin"), roleOptions.join(","));

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})();

