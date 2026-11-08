// E2E verification of password-confirmed actions on the class detail page.
// Prereqs: dev server on localhost:3000, seeded DB (npm run db:seed-dev).
// Usage: node scripts/verify-passwords.js
// Env overrides: APP_BASE_URL, TEST_EMAIL, TEST_PASSWORD.
// Expect: 1-9 all OK, "JS failures: none".
const { chromium } = require("playwright");
const { execFileSync } = require("node:child_process");

const BASE = process.env.APP_BASE_URL || "http://localhost:3000";
const EMAIL = process.env.TEST_EMAIL || "repro2@school.local";
const PASSWORD = process.env.TEST_PASSWORD || "ReproPass123!";
const CLASS_ID = "22222222-3333-4444-5555-666666666666";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const failures = [];
  page.on("pageerror", (e) => { failures.push("PAGEERROR: " + e.message); });
  page.on("console", (m) => { if (m.type() === "error") failures.push("CONSOLE: " + m.text().slice(0, 200)); });

  // create the account and its role/permissions/subjects/class (scripts/seed-dev.mjs)
  execFileSync(process.execPath, ["--env-file-if-exists=.env.local", "scripts/seed-dev.mjs"], {
    stdio: "inherit",
    env: { ...process.env, SEED_EMAIL: EMAIL, SEED_PASSWORD: PASSWORD },
  });

  // login
  await page.goto(BASE + "/login");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15000 }).catch(() => {});

  await page.goto(BASE + "/classes/" + CLASS_ID);
  await page.waitForTimeout(4000);

  async function confirmPassword(pass) {
    await page.getByRole("dialog").locator('input[type="password"]').fill(pass);
    await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await page.waitForTimeout(2000);
  }

  // 1. rename with WRONG password -> inline error
  await page.locator('input[name="name"]').fill("Grade 11 - B2");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 }).catch(() => failures.push("rename: no password modal"));
  await confirmPassword("WrongPass999!");
  const err1 = await page.locator("body").innerText();
  console.log("1. wrong-password rename ->", /Incorrect password/.test(err1) ? "OK" : "FAIL: " + err1.slice(0, 200));

  // 2. rename with CORRECT password
  await page.locator('input[name="name"]').fill("Grade 11 - B2");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 }).catch(() => failures.push("rename2: no modal"));
  await confirmPassword(PASSWORD);
  const body2 = await page.locator("body").innerText();
  console.log("2. correct-password rename ->", body2.includes("Grade 11 - B2") && body2.includes("Grade 11 · Adviser") ? "OK" : "FAIL");

  // 3. assign subject teacher (select triggers modal)
  await page.evaluate(() => {
    window.__logs = [];
    document.addEventListener("submit", (e) => {
      const fd = new FormData(e.target);
      window.__logs.push("submit: defaultPrevented=" + e.defaultPrevented + " names=" + [...fd.keys()].join(","));
    }, true);
    const orig = HTMLFormElement.prototype.requestSubmit;
    HTMLFormElement.prototype.requestSubmit = function (...a) {
      window.__logs.push("requestSubmit: names=" + [...new FormData(this).keys()].join(","));
      return orig.apply(this, a);
    };
  });
  const ocRow = page.locator("tbody tr", { hasText: "Oral Communication" });
  const myId = await ocRow.locator('select[name="teacherId"] option', { hasText: "Repro Two" }).getAttribute("value");
  await ocRow.locator('select[name="teacherId"]').selectOption({ label: "Repro Two" });
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 }).catch(() => failures.push("teacher: no modal"));
  await confirmPassword(PASSWORD);
  const assigned = await page.waitForFunction(
    (id) => {
      const rows = [...document.querySelectorAll("tbody tr")];
      const row = rows.find((r) => r.textContent.includes("Oral Communication"));
      return row && row.querySelector('select[name="teacherId"]')?.value === id;
    },
    myId, { timeout: 10000 }
  ).then(() => true).catch(() => false);
  const logs3 = await page.evaluate(() => window.__logs);
  console.log("3. teacher assign ->", assigned ? "OK" : "FAIL");
  if (!assigned) {
    console.log("   before reload all values:", await page.locator('select[name="teacherId"]').evaluateAll((els) => els.map((e) => e.value)));
    await page.reload();
    await page.waitForTimeout(2500);
    const ocVal = await page.locator("tbody tr", { hasText: "Oral Communication" }).locator('select[name="teacherId"]').inputValue();
    console.log("   OC row select after reload:", JSON.stringify(ocVal));
    console.log("   all after reload:", await page.locator('select[name="teacherId"]').evaluateAll((els) => els.map((e) => e.value)));
    console.log("   EVENT LOG:\n   " + logs3.join("\n   "));
    console.log("   dialog count:", await page.getByRole("dialog").count());
  }

  // 4. add subject
  await page.locator('select[name="subjectId"]').selectOption({ label: "ES11 — Earth and Life Science" });
  await page.getByRole("button", { name: "Add subject" }).click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 }).catch(() => failures.push("addsubject: no modal"));
  await confirmPassword(PASSWORD);
  const body4 = await page.locator("body").innerText();
  console.log("4. add subject ->", body4.includes("Earth and Life Science") ? "OK" : "FAIL");

  // 5. remove subject (first row remove -> cs-a OC11)
  await page.locator('tbody tr', { hasText: "Oral Communication" }).getByRole("button", { name: "Remove" }).click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 }).catch(() => failures.push("remove: no modal"));
  await confirmPassword(PASSWORD);
  const removed = await page.waitForFunction(() => {
    const rows = [...document.querySelectorAll("tbody tr")];
    return rows.length > 0 && !rows.some((r) => r.textContent.includes("Oral Communication"));
  }, { timeout: 10000 }).then(() => true).catch(() => false);
  console.log("5. remove subject ->", removed ? "OK" : "FAIL");

  // 6. enroll student
  await page.locator('input[name="lrn"]').fill("136789010123");
  await page.locator('input[name="surname"]').fill("Dela Cruz");
  await page.locator('input[name="firstname"]').fill("Juan");
  await page.getByRole("button", { name: "Enroll student" }).click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 }).catch(() => failures.push("enroll: no modal"));
  await confirmPassword(PASSWORD);
  const body6 = await page.locator("body").innerText();
  console.log("6. enroll student ->", body6.includes("Dela Cruz") ? "OK" : "FAIL");

  // 7. unenroll student
  await page.locator('tbody tr', { hasText: "Dela Cruz" }).getByRole("button", { name: "Unenroll" }).click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 }).catch(() => failures.push("unenroll: no modal"));
  await confirmPassword(PASSWORD);
  const body7 = await page.locator("body").innerText();
  console.log("7. unenroll student ->", !body7.includes("Dela Cruz") ? "OK" : "FAIL");

  // 8. delete with WRONG password -> inline error in dialog
  await page.getByRole("button", { name: "Delete class" }).first().click();
  const dlg = page.getByRole("dialog");
  await dlg.waitFor({ state: "visible", timeout: 5000 });
  await dlg.locator('input[type="password"]').fill("WrongPass999!");
  await dlg.getByRole("button", { name: "Delete class" }).click();
  await page.waitForTimeout(2500);
  const dlgText = await dlg.innerText();
  console.log("8. delete wrong password ->", /Incorrect password/.test(dlgText) ? "OK" : "FAIL: " + dlgText.slice(0, 120));

  // 9. delete with CORRECT password -> redirect to /classes, class gone
  await dlg.locator('input[type="password"]').fill(PASSWORD);
  await dlg.getByRole("button", { name: "Delete class" }).click();
  await page.waitForURL("**/classes", { timeout: 15000 }).catch(() => failures.push("delete: no redirect"));
  await page.waitForTimeout(2000);
  const body9 = await page.locator("body").innerText();
  console.log("9. delete correct password ->", page.url().endsWith("/classes") && !body9.includes("Grade 11 - B2") ? "OK" : "FAIL: " + page.url());

  console.log("\nJS failures:", failures.length ? failures.join(" | ") : "none");
  await browser.close();
})();