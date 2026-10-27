import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ship the /Recording folder with the audio route on Vercel (files are read with fs at runtime).
  outputFileTracingIncludes: {
    "/api/audio/**/*": ["./Recording/**/*"],
    "/admin/**/*": ["./Recording/**/*"],
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
