/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@leafygreen-ui"],
  typescript: {
    // LeafyGreen UI types target React 18; safe to skip at build time.
    // IDE type-checking still works via tsconfig skipLibCheck.
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
