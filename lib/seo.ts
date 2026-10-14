import type { Metadata } from "next";

/**
 * The public origin every canonical URL points at.
 *
 * WHY THIS IS A CONSTANT AND NOT `metadataBase`. A canonical must name the one
 * URL that should rank, and it must be identical in every environment. Deriving
 * it from `NEXT_PUBLIC_APP_URL` would make the canonical say `localhost` on a
 * developer's machine and change shape per deployment, which is exactly how
 * duplicate-content problems start. `lib/auth-policy.ts` already documents this
 * origin as the production app, so the canonical and the OAuth origin cannot
 * drift apart.
 */
export const SITE_ORIGIN = "https://sparelinkindia.com";

/** Build an absolute, normalised URL for a site-relative path. */
export function canonicalUrl(path: string): string {
  const clean = path.trim();
  if (/^https?:\/\//i.test(clean)) return clean;
  const withSlash = clean.startsWith("/") ? clean : `/${clean}`;
  return new URL(withSlash, SITE_ORIGIN).toString();
}

type PageMetadataInput = {
  /** Page title. The root layout appends the brand via its title template. */
  title: string;
  description: string;
  /** Site-relative path, e.g. "/brands". Used for the canonical URL. */
  path: string;
  /** Set on private or transactional pages so they are never indexed. */
  noindex?: boolean;
};

/**
 * One helper for every page's metadata, so a title, a description and a
 * canonical are always emitted together and can never disagree.
 *
 * The root layout already provides `metadataBase`, OG and the title template;
 * this adds only what a page owns. Because the canonical is emitted here and
 * nowhere else in the app, a page can never end up with two of them.
 */
export function pageMetadata({
  title,
  description,
  path,
  noindex = false,
}: PageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: canonicalUrl(path) },
    robots: noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonicalUrl(path),
      siteName: "SpareLink India",
      locale: "en_IN",
      type: "website",
    },
  };
}

/** Metadata for a page that must never appear in a search index. */
export function privateMetadata(title: string, path: string): Metadata {
  return pageMetadata({
    title,
    description: "Sign in to your SpareLink India account.",
    path,
    noindex: true,
  });
}