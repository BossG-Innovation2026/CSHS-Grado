// One-time production setup on top of the Neon project: Cloudflare Hyperdrive,
// GitHub secrets, migrations, and the D1 -> Postgres data copy.
//
// Usage (in a real terminal, from the repo root):  node scripts/go-live.mjs [--fresh]
//   --fresh   skip copying the old D1 data (start with an empty database)
//
// You will be asked to: sign in to Neon in the browser (first run only) and paste
// one Cloudflare API token at a hidden prompt. Secrets are passed between tools in
// memory and are never printed. Safe to re-run: finished steps are skipped.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO = "BossG-Innovation2026/CSHS-Grado";
const NEON_PROJECT_ID = "delicate-credit-87024053";
const NEON_BRANCH = "production";
const HYPERDRIVE_NAME = "grado-db";
const D1_NAME = "shs-db";
const PLACEHOLDER = "REPLACE_WITH_HYPERDRIVE_ID";
const fresh = process.argv.includes("--fresh");

const WRANGLER = ["node_modules/wrangler/bin/wrangler.js"];
const DRIZZLE = ["node_modules/drizzle-kit/bin.cjs"];
const NEON = "npx --yes neon@8.23.2";

const step = (n, text) => console.log(`\n\x1b[36m[${n}/7]\x1b[0m ${text}`);
const ok = (text) => console.log(`  \x1b[32m✓\x1b[0m ${text}`);
const fail = (text) => {
  console.error(`\n  \x1b[31m✗ ${text}\x1b[0m`);
  process.exit(1);
};
const lastLines = (text, n = 2) => text.split("\n").filter(Boolean).slice(-n).join(" ");

/** Run a command and capture output (nothing is echoed). */
function capture(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", ...options });
  return { code: result.status ?? 1, out: (result.stdout ?? "").trim(), err: (result.stderr ?? "").trim() };
}
/** Neon CLI via npx (arguments never contain secrets, so a shell is fine). */
function neon(args, { interactive = false } = {}) {
  if (interactive) return spawnSync(`${NEON} ${args}`, { shell: true, stdio: "inherit" }).status ?? 1;
  return capture(`${NEON} ${args}`, [], { shell: true });
}
function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Read a line without echoing it (for the API token). */
function askHidden(prompt) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(prompt);
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    let value = "";
    const onData = (chunk) => {
      for (const c of chunk) {
        if (c === "\r" || c === "\n") {
          if (stdin.isTTY) stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(value.trim());
          return;
        }
        if (c === "\u0003") process.exit(130); // Ctrl+C
        if (c === "\u007f" || c === "\b") value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on("data", onData);
  });
}

function openBrowser(url) {
  if (process.platform === "win32") spawnSync("cmd", ["/c", "start", "", url], { stdio: "ignore" });
  else if (process.platform === "darwin") spawnSync("open", [url], { stdio: "ignore" });
  else spawnSync("xdg-open", [url], { stdio: "ignore" });
}

function setGithubSecret(name, value) {
  const r = capture("gh", ["secret", "set", name, "--repo", REPO], { input: value });
  if (r.code !== 0) fail(`Could not set GitHub secret ${name}: ${lastLines(r.err, 1)}`);
  ok(`GitHub secret ${name} saved`);
}

const toml = readFileSync("wrangler.toml", "utf8");
const accountId = toml.match(/^account_id\s*=\s*"([^"]+)"/m)?.[1];
if (!accountId) fail("account_id not found in wrangler.toml");

// ---------------------------------------------------------------- 1. GitHub
step(1, "Checking GitHub access");
const repoInfo = parseJson(capture("gh", ["api", `repos/${REPO}`]).out);
if (!repoInfo?.permissions?.admin) {
  fail(`The active gh account cannot manage secrets on ${REPO}. Run: gh auth switch --user BossG-Innovation2026`);
}
ok(`gh can manage secrets on ${REPO}`);

// ---------------------------------------------------------------- 2. Neon
step(2, `Neon project ${NEON_PROJECT_ID}, branch "${NEON_BRANCH}"`);
if (neon("me -o json").code !== 0) {
  console.log("  Opening the browser to sign in to Neon (approve it, then come back here)...");
  if (neon("auth", { interactive: true }) !== 0 || neon("me -o json").code !== 0) {
    fail("Neon sign-in did not complete. Run `neon login`, then re-run this script.");
  }
}
ok("Signed in to Neon");
const conn = neon(`connection-string ${NEON_BRANCH} --project-id ${NEON_PROJECT_ID}`);
const databaseUrl = conn.out.split(/\s+/).find((s) => s.startsWith("postgres"));
if (!databaseUrl) fail(`Could not read the Neon connection string: ${lastLines(conn.err, 1)}`);
if (databaseUrl.includes("-pooler.")) fail("Got a pooled Neon URL; Hyperdrive needs the direct one.");
// Hyperdrive takes plain user/password/host/db; Neon's query options (sslmode,
// channel_binding) are for direct clients. Hyperdrive always uses TLS to Neon.
const hyperdriveUrl = databaseUrl.split("?")[0];
ok("Got the direct connection string (kept in memory, not shown)");

// ---------------------------------------------------------------- 3. Cloudflare token
step(3, "Cloudflare API token");
console.log(`  A browser tab will open. Click "Create Token" > "Edit Cloudflare Workers" template, then
  under Permissions click "+ Add more" and add:
      Account | Hyperdrive | Edit
      Account | D1         | Edit
  Account Resources: your account. Click "Continue to summary" > "Create Token" and copy it.`);
openBrowser("https://dash.cloudflare.com/profile/api-tokens");
let cfToken = "";
for (let attempt = 0; attempt < 3 && !cfToken; attempt++) {
  const candidate = await askHidden("  Paste the token here (hidden) and press Enter: ");
  const headers = { Authorization: `Bearer ${candidate}` };
  for (const url of [
    "https://api.cloudflare.com/client/v4/user/tokens/verify",
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`,
  ]) {
    const res = await fetch(url, { headers }).catch(() => null);
    const body = res ? await res.json().catch(() => null) : null;
    if (body?.success && body.result?.status === "active") {
      cfToken = candidate;
      break;
    }
  }
  if (!cfToken) console.log("  Cloudflare did not accept that token. Try again.");
}
if (!cfToken) fail("No valid Cloudflare token.");
ok("Cloudflare token is valid");

// Wrangler must use the new token, not an old one from this PC's environment.
const cfEnv = { ...process.env, CLOUDFLARE_API_TOKEN: cfToken, CLOUDFLARE_ACCOUNT_ID: accountId };
delete cfEnv.CF_API_TOKEN;
delete cfEnv.CLOUDFLARE_API_KEY;
const wrangler = (args) => capture(process.execPath, [...WRANGLER, ...args], { env: cfEnv });
const hide = (text) => text.replaceAll(hyperdriveUrl, "<url>").replaceAll(databaseUrl, "<url>");

// ---------------------------------------------------------------- 4. Hyperdrive
step(4, `Hyperdrive "${HYPERDRIVE_NAME}" (caching disabled)`);
const findHyperdrive = () =>
  wrangler(["hyperdrive", "list"]).out.split("\n").find((line) => line.includes(HYPERDRIVE_NAME))?.match(/[0-9a-f]{32}/)?.[0];
let hyperdriveId = toml.includes(PLACEHOLDER) ? findHyperdrive() : toml.match(/\[\[hyperdrive\]\][\s\S]*?\bid\s*=\s*"([0-9a-f]{32})"/)?.[1];
if (hyperdriveId) {
  const upd = wrangler(["hyperdrive", "update", hyperdriveId, `--connection-string=${hyperdriveUrl}`, "--caching-disabled"]);
  if (upd.code !== 0) fail(`Could not update Hyperdrive: ${hide(lastLines(upd.err || upd.out))}`);
  ok(`Hyperdrive ${hyperdriveId} points at Neon, caching disabled`);
} else {
  const made = wrangler(["hyperdrive", "create", HYPERDRIVE_NAME, "--caching-disabled", `--connection-string=${hyperdriveUrl}`]);
  if (made.code !== 0) fail(`Could not create Hyperdrive (does the token have Hyperdrive: Edit?): ${hide(lastLines(made.err || made.out))}`);
  hyperdriveId = findHyperdrive();
  if (!hyperdriveId) fail("Hyperdrive was created but its id could not be read. Run: npx wrangler hyperdrive list");
  ok(`Created Hyperdrive ${hyperdriveId}`);
}
if (toml.includes(PLACEHOLDER)) {
  writeFileSync("wrangler.toml", toml.replace(PLACEHOLDER, hyperdriveId));
  ok("Saved the id in wrangler.toml");
}

// ---------------------------------------------------------------- 5. GitHub secrets
step(5, "GitHub secrets for the deploy workflow");
setGithubSecret("DATABASE_URL", databaseUrl);
setGithubSecret("CLOUDFLARE_API_TOKEN", cfToken);
setGithubSecret("CLOUDFLARE_ACCOUNT_ID", accountId);

// ---------------------------------------------------------------- 6. Migrations
step(6, "Creating tables in Neon");
const migrate = capture(process.execPath, [...DRIZZLE, "migrate"], { env: { ...process.env, DATABASE_URL: databaseUrl } });
if (migrate.code !== 0) fail(`Migrations failed: ${hide(lastLines(migrate.err || migrate.out, 3))}`);
ok("Migrations applied");

// ---------------------------------------------------------------- 7. Data
step(7, fresh ? "Skipping the D1 data copy (--fresh)" : `Copying data from D1 "${D1_NAME}"`);
if (!fresh) {
  const dir = mkdtempSync(join(tmpdir(), "grado-d1-"));
  const dump = join(dir, "d1-export.sql");
  try {
    const exp = wrangler(["d1", "export", D1_NAME, "--remote", "--output", dump]);
    if (exp.code !== 0) fail(`D1 export failed (does the token have D1: Edit?): ${lastLines(exp.err || exp.out)}`);
    ok("Exported D1 to a temporary file");
    const imp = spawnSync(process.execPath, ["scripts/import-d1.mjs", dump], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
    });
    if (imp.status !== 0) console.log("  (Import skipped or failed — see the message above. Re-running is safe.)");
  } finally {
    rmSync(dir, { recursive: true, force: true });
    ok("Deleted the temporary export (it contained personal data)");
  }
}

console.log(`
\x1b[32mSetup complete.\x1b[0m
  Hyperdrive id: ${hyperdriveId}  (wrangler.toml updated: commit it, or ask Claude to)
  Next: merge the pull request; the Deploy workflow builds, migrates and deploys.
  Note: this PC has an old CLOUDFLARE_API_TOKEN / CF_API_TOKEN in its user environment
  variables. Remove them (Windows: "Edit environment variables for your account")
  so local wrangler commands stop using the expired token.`);
