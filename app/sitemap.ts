import type { MetadataRoute } from "next";

const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

const publicRoutes = [
  "",
  "/brands",
  "/vehicle-fitment",
  "/offers",
  "/about-us",
  "/contact-us",
  "/help-support",
  "/terms-and-conditions",
  "/privacy-policy",
  "/shipping-policy",
  "/returns-refunds",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return publicRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.6,
  }));
}
