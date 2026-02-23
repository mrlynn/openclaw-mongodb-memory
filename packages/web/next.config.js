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
};

module.exports = nextConfig;
