import "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    /** Postgres (Neon) through Cloudflare Hyperdrive. */
    HYPERDRIVE: Hyperdrive;
    BETTER_AUTH_SECRET?: string;
    BETTER_AUTH_URL?: string;
  }
}

export {};
