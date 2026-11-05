// One-time setup of the DEMO site (grado-demo): its own Neon project with fake
// data, its own Hyperdrive, and the GitHub secrets the Deploy workflow needs.
//
// Usage (real terminal, repo root):  node scripts/go-live-demo.mjs
// Asks you to: click "Allow" in the browser for Cloudflare (and Neon if needed).
// Secrets stay in memory and are never printed. Safe to re-run.
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const REPO = "BossG-Innovation2026/CSHS-Grado";
const NEON_ORG = "org-cold-art-36882071";
const NEON_PROJECT = "grado-demo";
const NEON_REGION = "aws-ap-southeast-1"; // Singapore
const HYPERDRIVE_NAME = "grado-demo-db";
const PLACEHOLDER = "REPLACE_WITH_DEMO_HYPERDRIVE_ID";
const NEON = "npx --yes neon@8.23.2";
const WRANGLER = ["node_modules/wrangler/bin/wrangler.js"];

const step = (n, text) => console.log(`\n\x1b[36m[${n}/6]\x1b[0m ${text}`);
const ok = (text) => console.log(`  \x1b[32m✓\x1b[0m ${text}`);
const fail = (text) => {
  console.error(`\n  \x1b[31m✗ ${text}\x1b[0m`);
  process.exit(1);
};
const last = (text, n = 2) => text.split("\n").filter(Boolean).slice(-n).join(" ");
const capture = (cmd, args, options = {}) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...options });
  return { code: r.status ?? 1, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
};
const neon = (args, interactive = false) =>
  interactive
    ? (spawnSync(`${NEON} ${args}`, { shell: true, stdio: "inherit" }).status ?? 1)
    : capture(`${NEON} ${args}`, [], { shell: true });
const parseJson = (t) => {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
};

const toml = readFileSync("wrangler.toml", "utf8");
const accountId = toml.match(/^account_id\s*=\s*"([^"]+)"/m)?.[1];

// Use wrangler's browser login, not stale tokens from this PC's environment.
const cfEnv = { ...process.env };
for (const k of ["CLOUDFLARE_API_TOKEN", "CF_API_TOKEN", "CLOUDFLARE_API_KEY"]) delete cfEnv[k];
cfEnv.CLOUDFLARE_ACCOUNT_ID = accountId;
const wrangler = (args, interactive = false) =>
  interactive
    ? (spawnSync(process.execPath, [...WRANGLER, ...args], { env: cfEnv, stdio: "inherit" }).status ?? 1)
    : capture(process.execPath, [...WRANGLER, ...args], { env: cfEnv });

// 1. GitHub
step(1, "Checking GitHub access");
if (!parseJson(capture("gh", ["api", `repos/${REPO}`]).out)?.permissions?.admin) {
  fail(`The active gh account cannot manage secrets on ${REPO}. Run: gh auth switch --user BossG-Innovation2026`);
}
ok(`gh can manage secrets on ${REPO}`);

// 2. Neon project for demo data
step(2, `Neon project "${NEON_PROJECT}" (Singapore, fake data only)`);
if (neon("me -o json").code !== 0) {
  console.log("  Opening the browser to sign in to Neon...");
  if (neon("auth", true) !== 0 || neon("me -o json").code !== 0) fail("Neon sign-in did not complete. Run `neon login` and re-run.");
}
const listed = parseJson(neon(`projects list -o json --org-id ${NEON_ORG}`).out);
const projects = Array.isArray(listed) ? listed : (listed?.projects ?? []);
let projectId = projects.find((p) => p.name === NEON_PROJECT)?.id;
if (projectId) {
  ok(`Using existing project ${projectId}`);
} else {
  const made = neon(`projects create --name ${NEON_PROJECT} --region-id ${NEON_REGION} --org-id ${NEON_ORG} -o json`);
  const body = parseJson(made.out);
  projectId = body?.project?.id ?? body?.id;
  if (!projectId) fail(`Could not create the Neon project: ${last(made.err, 1)}`);
  ok(`Created project ${projectId}`);
}
const databaseUrl = neon(`connection-string --project-id ${projectId}`).out.split(/\s+/).find((s) => s.startsWith("postgres"));
if (!databaseUrl || databaseUrl.includes("-pooler.")) fail("Could not read the direct Neon connection string.");
const hyperdriveUrl = databaseUrl.split("?")[0];
const hide = (t) => t.replaceAll(hyperdriveUrl, "<url>").replaceAll(databaseUrl, "<url>");
ok("Got the connection string (kept in memory, not shown)");

// 3. Cloudflare login
step(3, "Cloudflare sign-in");
let who = wrangler(["whoami"]);
if (who.code !== 0 || !who.out.includes(accountId)) {
  console.log("  Opening the browser: sign in to the Cloudflare account that owns Grado and click Allow.");
  wrangler(["login"], true);
  who = wrangler(["whoami"]);
}
if (!who.out.includes(accountId)) fail(`Signed in, but this Cloudflare login cannot reach account ${accountId}.`);
ok("Cloudflare login can reach Grado's account");

// 4. Hyperdrive for the demo database
step(4, `Hyperdrive "${HYPERDRIVE_NAME}" (caching disabled)`);
const findHd = () =>
  wrangler(["hyperdrive", "list"]).out.split("\n").find((l) => l.includes(HYPERDRIVE_NAME))?.match(/[0-9a-f]{32}/)?.[0];
let hdId = findHd();
if (hdId) {
  const upd = wrangler(["hyperdrive", "update", hdId, `--connection-string=${hyperdriveUrl}`, "--caching-disabled"]);
  if (upd.code !== 0) fail(`Could not update Hyperdrive: ${hide(last(upd.err || upd.out))}`);
  ok(`Hyperdrive ${hdId} points at the demo database`);
} else {
  const made = wrangler(["hyperdrive", "create", HYPERDRIVE_NAME, "--caching-disabled", `--connection-string=${hyperdriveUrl}`]);
  if (made.code !== 0) fail(`Could not create Hyperdrive: ${hide(last(made.err || made.out))}`);
  hdId = findHd();
  if (!hdId) fail("Hyperdrive created but its id could not be read. Run: npx wrangler hyperdrive list");
  ok(`Created Hyperdrive ${hdId}`);
}
if (toml.includes(PLACEHOLDER)) {
  writeFileSync("wrangler.toml", toml.replace(PLACEHOLDER, hdId));
  ok("Saved the id in wrangler.toml ([env.demo])");
}

// 5. GitHub secrets
step(5, "GitHub secrets for the demo deploy");
const setSecret = (name, value) => {
  const r = capture("gh", ["secret", "set", name, "--repo", REPO], { input: value });
  if (r.code !== 0) fail(`Could not set ${name}: ${last(r.err, 1)}`);
  ok(`GitHub secret ${name} saved`);
};
setSecret("DATABASE_URL_DEMO", databaseUrl);
const existing = capture("gh", ["secret", "list", "--repo", REPO]).out;
if (/^BETTER_AUTH_SECRET_DEMO\s/m.test(existing)) ok("GitHub secret BETTER_AUTH_SECRET_DEMO already exists");
else setSecret("BETTER_AUTH_SECRET_DEMO", randomBytes(32).toString("base64url"));

// 6. Tables + fake data
step(6, "Creating tables and fake demo data");
const dbEnv = { ...process.env, DATABASE_URL: databaseUrl };
const mig = capture(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "migrate"], { env: dbEnv });
if (mig.code !== 0) fail(`Migrations failed: ${hide(last(mig.err || mig.out, 3))}`);
ok("Migrations applied");
const seed = capture(process.execPath, ["scripts/seed-demo.mjs"], { env: dbEnv });
if (seed.code !== 0) fail(`Seeding failed: ${hide(last(seed.err || seed.out, 2))}`);
ok(last(seed.out, 1));

console.log(`
\x1b[32mDemo infrastructure ready.\x1b[0m Hyperdrive ${hdId} (wrangler.toml updated).
  Next: merge the demo pull request; the Deploy workflow publishes
  https://grado-demo.innov-proj2026.workers.dev`);
