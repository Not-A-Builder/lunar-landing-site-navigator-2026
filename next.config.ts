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
