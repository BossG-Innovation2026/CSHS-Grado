import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
export { schema };

declare global {
  var __gradoDb: Db | undefined;
}

/**
 * Cloudflare Workers forbid sharing sockets between requests, so on Workers
 * we keep one pool per request (keyed by the request's ExecutionContext).
 * Hyperdrive does the real connection pooling at the edge.
 */
const perRequest = new WeakMap<object, Db>();

function workerDb(): Db | null {
  let context: ReturnType<typeof getCloudflareContext>;
  try {
    context = getCloudflareContext();
  } catch {
    return null; // not running inside a Cloudflare Worker (next dev, scripts)
  }
  const hyperdrive = context.env.HYPERDRIVE;
  if (!hyperdrive) return null;

  const requestKey = context.ctx as object;
  const existing = perRequest.get(requestKey);
  if (existing) return existing;

  const pool = new Pool({ connectionString: hyperdrive.connectionString, max: 5 });
  const db = drizzle(pool, { schema });
  perRequest.set(requestKey, db);
  return db;
}

function nodeDb(): Db {
  if (!globalThis.__gradoDb) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env.local and start a local database (npm run db:dev)."
      );
    }
    // DATABASE_POOL_MAX=1 for the PGlite dev server (npm run db:dev): it runs
    // one embedded database, and parallel connections can interleave messages.
    const max = Number(process.env.DATABASE_POOL_MAX ?? 5) || 5;
    const pool = new Pool({ connectionString, max });
    globalThis.__gradoDb = drizzle(pool, { schema });
  }
  return globalThis.__gradoDb;
}

/** The database for the current request (Hyperdrive on Workers, DATABASE_URL elsewhere). */
export function getDb(): Db {
  return workerDb() ?? nodeDb();
}
