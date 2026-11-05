import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` loads `pg-cloudflare` only under the Workers ("workerd") export
  // condition. Next traces with Node conditions and would copy just the empty
  // stub, so the Cloudflare build (OpenNext) could not resolve the real files.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/pg-cloudflare/**/*"],
    "/**/*": ["./node_modules/pg-cloudflare/**/*"],
  },
};

export default nextConfig;
