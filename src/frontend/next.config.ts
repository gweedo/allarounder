import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.blob.core.windows.net" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
  // The backend has internal-only ingress and Front Door routes all traffic to
  // the frontend, so browser → backend calls (e.g. admin login) must be proxied
  // through Next.js. Server-side fetches use API_URL directly; this rewrite
  // covers client-side requests to relative /api/* paths.
  rewrites: async () => {
    const apiUrl = process.env.API_URL ?? "http://backend:8000";
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
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
