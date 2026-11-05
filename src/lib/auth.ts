import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb, schema, type Db } from "@/db";
import { getEnvVar, requireEnvVar } from "@/lib/env";

function createAuth(db: Db) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema: schema.authSchema }),
    secret: requireEnvVar("BETTER_AUTH_SECRET", "dev-secret-change-in-production"),
    baseURL: getEnvVar("BETTER_AUTH_URL") ?? "http://localhost:3000",
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: true,
          defaultValue: "teacher",
          input: false,
        },
        permissions: {
          type: "string",
          required: true,
          defaultValue: "[]",
          input: false,
        },
        active: {
          type: "boolean",
          required: true,
          defaultValue: true,
          input: false,
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
    },
    rateLimit: {
      // Counters live in Postgres so the limit holds across Worker isolates
      // (in-memory counters reset per isolate and are easy to bypass).
      storage: "database",
      window: 60,
      max: 300,
      customRules: {
        "/sign-in/**": { window: 10, max: 20 },
      },
    },
  });
}

type Auth = ReturnType<typeof createAuth>;
const authByDb = new WeakMap<Db, Auth>();

/** better-auth bound to the current request's database connection. */
export function getAuth(): Auth {
  const db = getDb();
  let auth = authByDb.get(db);
  if (!auth) {
    auth = createAuth(db);
    authByDb.set(db, auth);
  }
  return auth;
}
