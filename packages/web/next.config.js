const path = require("path");

// Load root .env.local so server-side API routes can read MEMORY_DAEMON_PORT,
// MONGODB_URI, VOYAGE_* etc. — same approach the daemon uses.
// dotenv won't overwrite vars that are already set.
require("dotenv").config({ path: path.resolve(__dirname, "../../.env.local") });
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@leafygreen-ui"],
  typescript: {
    // LeafyGreen UI types target React 18; safe to skip at build time.
    // IDE type-checking still works via tsconfig skipLibCheck.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Web uses eslint-config-next; root flat config is for daemon/cli/client.
    // Prevents Next.js from picking up the root eslint.config.mjs.
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      { source: "/recall", destination: "/search", permanent: true },
      { source: "/browser", destination: "/memories", permanent: true },
      { source: "/timeline", destination: "/memories?view=timeline", permanent: true },
      { source: "/conflicts", destination: "/operations?tab=conflicts", permanent: true },
      { source: "/expiration", destination: "/operations?tab=expiration", permanent: true },
      { source: "/reflection", destination: "/operations?tab=reflection", permanent: true },
      { source: "/health", destination: "/settings?tab=health", permanent: true },
      { source: "/docs", destination: "/settings?tab=docs", permanent: true },
      { source: "/remember", destination: "/dashboard?remember=1", permanent: true },
    ];
  },
};

module.exports = nextConfig;
