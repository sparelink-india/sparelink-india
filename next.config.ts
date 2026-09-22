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
        source: "/catalogue-images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
