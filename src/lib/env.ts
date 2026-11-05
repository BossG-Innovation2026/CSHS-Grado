import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Read a string variable from the Worker env (production) or process.env (local). */
export function getEnvVar(name: string): string | undefined {
  try {
    const { env } = getCloudflareContext();
    const value = (env as unknown as Record<string, unknown>)[name];
    if (typeof value === "string") return value;
  } catch {
    // not running inside a Cloudflare Worker
  }
  return process.env[name];
}

/** Like getEnvVar, but fails loudly in production when the value is missing. */
export function requireEnvVar(name: string, devFallback: string): string {
  const value = getEnvVar(name);
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} must be set in production.`);
  }
  return devFallback;
}
