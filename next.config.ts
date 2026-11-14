import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Ship the compact NASA terrain bundle with the custom-site terrain API (LOGS D-032).
  outputFileTracingIncludes: {
    "/api/terrain": ["./data/deploy/**/*"],
  },
  // The raw downloads are local-only; never trace them into a deployment.
  outputFileTracingExcludes: {
    "/*": ["./data/raw/**/*"],
  },
  experimental: {
    // Turbopack's on-disk dev cache kept serving stale globals.css output from the Tailwind loader
    // below, even across restarts (LOGS D-050). Dev restarts are a little slower without it.
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
