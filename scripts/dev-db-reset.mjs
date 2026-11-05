// Wipe accounts from the LOCAL database so e2e-m1.js can test first-user bootstrap.
// Refuses to run against anything but localhost.
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (see .env.example).");
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("dev-db-reset only runs against a local database.");

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(
    'TRUNCATE "user", account, session, verification, notification, rate_limit, class, class_subject, enrollment CASCADE'
  );
  console.log("Local DB accounts and classes wiped for a fresh bootstrap.");
} finally {
  await client.end();
}
