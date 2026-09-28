import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The framework version is nobody's business.
  poweredByHeader: false,
  // The local (PGlite) data backend ships a WASM build of PostgreSQL. It must stay
  // outside the bundler graph so Node can load it at runtime. It is only ever imported
  // on the server when Supabase credentials are absent (see src/lib/db/index.ts).
  serverExternalPackages: ["@electric-sql/pglite"],
  typedRoutes: false,
  experimental: {
    // Image uploads are validated and sent as base64 to the Gemini vision API.
    serverActions: { bodySizeLimit: "12mb" },
  },
  images: {
    // Listing / profile images are served from Supabase Storage, a local file route,
    // or remote URLs that the uploader validated. Keep the list narrow and explicit.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
