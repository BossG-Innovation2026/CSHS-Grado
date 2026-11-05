// Zero-install local Postgres for development: PGlite (Postgres compiled to
// WASM) behind a Postgres wire-protocol socket. Data lives in ./.pglite.
// Usage: npm run db:dev   (then, in another terminal: npm run db:migrate)
// For a real Postgres instead, use `docker compose up -d`.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const port = Number(process.env.DEV_DB_PORT ?? 5432);
const dataDir = process.env.DEV_DB_DIR ?? "./.pglite";

// A client that disconnects abruptly can surface ECONNRESET/EPIPE on a socket
// before the server attaches its handlers; that must not kill the database.
process.on("uncaughtException", (error) => {
  if (error && (error.code === "ECONNRESET" || error.code === "EPIPE")) return;
  console.error(error);
  process.exit(1);
});

const db = await PGlite.create(dataDir);
const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 20 });
await server.start();
console.log(`Local Postgres ready: postgres://postgres:postgres@127.0.0.1:${port}/postgres (data: ${dataDir})`);

async function shutdown() {
  await server.stop();
  await db.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
