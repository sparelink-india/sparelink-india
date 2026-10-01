import type { NextConfig } from "next";

const catalogueImageTraceExcludes = [
  "./data/source-catalogue/images/**",
  "./data/source-catalogue/images/**/*",
  "**/data/source-catalogue/images/**",
  "./data/catalogue-image-store/**",
  "./data/catalogue-image-store/**/*",
  "**/data/catalogue-image-store/**",
  "./public/catalogue-images/**",
  "./public/catalogue-images/**/*",
  "**/public/catalogue-images/**",
  "./data/meko-catalogue/**",
  "./data/meko-catalogue/**/*",
  "**/data/meko-catalogue/**",
];

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  outputFileTracingExcludes: {
    "*": catalogueImageTraceExcludes,
    "/api/*": catalogueImageTraceExcludes,
    "/api/catalogue/image": catalogueImageTraceExcludes,
    "/api/admin/source-catalogue/image": catalogueImageTraceExcludes,
    "/api/admin/source-catalogue": catalogueImageTraceExcludes,
    "/api/search/parts": catalogueImageTraceExcludes,
  },
  async headers() {
    return [
      {
        // Baseline response hardening for every route.
        //
        // These three are safe here and were missing:
        //   X-Frame-Options SAMEORIGIN - nothing legitimately frames this site,
        //     and SAMEORIGIN (not DENY) leaves the door open for a future
        //     same-origin embed without needing another release.
        //   X-Content-Type-Options nosniff - stops a browser re-interpreting a
        //     response's type. No asset here depends on sniffing.
        //   Referrer-Policy strict-origin-when-cross-origin - the modern default:
        //     full referrer same-origin, origin only cross-origin, none cross-site.
        //     Catalogue/product queries stay useful internally while third-party
        //     clicks do not leak the path.
        //
        // NO Content-Security-Policy is added deliberately. This app ships
        // inline bootstrap scripts (`PREFERENCE_BOOTSTRAP` in app/layout.tsx) and
        // Next.js injects inline runtime chunks, so a static CSP would break the
        // page unless nonces were threaded through every render. That is a
        // separate, larger change and is not smuggled in here.
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/catalogue-images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
