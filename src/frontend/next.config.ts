import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.blob.core.windows.net" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
  // NOTE: browser → backend /api/* calls are proxied at runtime by the route
  // handler at app/api/[...path]/route.ts — NOT by a next.config rewrite.
  // Rewrites bake their destination at build time (process.env.API_URL is unset
  // during the CI build), which froze the proxy target to the unreachable
  // http://backend:8000 fallback regardless of the runtime API_URL.
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
      ],
    },
  ],
};

export default nextConfig;
