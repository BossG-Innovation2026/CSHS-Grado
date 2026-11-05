import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit reads DATABASE_URL (a direct Postgres URL, not the Hyperdrive
 * binding). Locally it comes from .env.local; in CI from the DATABASE_URL secret.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/postgres",
  },
  strict: true,
  verbose: true,
});
