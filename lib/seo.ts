/**
 * Per-route SEO metadata for the storefront.
 * =========================================
 * WHY THIS EXISTS
 * --------------
 * Until this module the root layout carried the entire site's metadata. The
 * title was a single string, "SpareLink India", with a "%s | SpareLink India"
 * template that NO route ever used - because no route exported `metadata`, and
 * most storefront routes are client components, which cannot export it at all.
 *
 * So in production every URL rendered:
 *
 *     <title>SpareLink India</title>
 *     <meta name="description" content="SpareLink India is the digital sales ...">
 *
 * A privacy policy, a login screen and a 900-item catalogue page all announced
 * themselves with the identical title and the identical description. That is
 * not a cosmetic problem: it collapses the whole storefront into one snippet in
 * search results and gives crawlers no way to tell the pages apart.
 *
 * WHAT THIS DOES
 * --------------
 * A tiny builder that produces a correct `Metadata` object for a route: a
 * human title, a route-specific description, and - most importantly - an
 * ABSOLUTE canonical for that exact URL.
 *
 * Server-rendered storefront routes consume it directly:
 *
 *     export const metadata = routeMetadata({
 *       path: "/products",
 *       title: "...",
 *       description: "...",
 *     });
 *
 * Client-component routes cannot export `metadata`, so they inherit the layout
 * fallback. That is fine and correct: an absent canonical is treated as
 * self-referencing, which is the right behaviour. What must never come back is
 * a canonical pointing at some OTHER route, which is the defect this replaces.
 *
 * Every string is plain English at the module boundary on purpose. These are
 * `<title>` / `<meta>` values read by crawlers, not UI copy rendered to a
 * signed-in or signed-out visitor, and search engines do not read the site's
 * cookie to pick a language. Hardcoding them here is therefore NOT a bypass of
 * the `lib/i18n` system - that system governs rendered UI text, and these
 * strings are never rendered into the page.
 */

import type { Metadata } from "next";

export type RouteMetadataInput = {
  /**
   * The route's own path, always leading-slashed and never trailing-slashed
   * except for the homepage itself, which is exactly "/".
   *
   * This is the value that becomes the canonical URL, so it must be the real
   * path of the route that exports it. It is NOT derived from the request: a
   * `metadata` export is evaluated per route, not per request, so reading a
   * header here would break static rendering and leak one route's URL onto
   * another.
   */
  path: string;

  /** Human title for the tab and for the search result. No brand suffix. */
  title: string;

  /**
   * The meta description. Aim for roughly 120-160 characters: long enough to
   * carry the page's purpose, short enough that search engines will not
   * truncate it mid-sentence.
   */
  description: string;

  /**
   * Keep a page out of the index - used for authenticated surfaces such as
   * /checkout and /profile, which have nothing useful to show a searcher and
   * would otherwise be thin, near-duplicate pages of the account area.
   */
  noIndex?: boolean;
};

/** The brand's factual one-line description, used where a page has no better one. */
export const SITE_DESCRIPTION =
  "SpareLink India is the digital sales platform for Hind Motors, Ambaji Traders and India Sales.";

/**
 * Normalise a route path for use in a canonical URL.
 *
 * Accepts "products", "/products" and "/products/" and always produces
 * "/products". The homepage is the one case where the path IS "/" rather than
 * being stripped to "", so it is special-cased explicitly.
 */
export function canonicalPath(path: string): string {
  const trimmed = path.trim();
  if (trimmed === "" || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

/**
 * Build the `Metadata` for a storefront route.
 *
 * The canonical is made ABSOLUTE here rather than left relative. Next resolves
 * a relative canonical against `metadataBase`, but `metadataBase` falls back to
 * `http://localhost:3000` when `NEXT_PUBLIC_APP_URL` is unset - and in that
 * case a relative canonical silently resolves to localhost, which is worse than
 * emitting none at all.
 *
 * When the public URL is genuinely unknown the canonical is OMITTED rather than
 * guessed. An absent canonical means "self-referencing", which every crawler
 * handles correctly. A canonical pointing at the wrong host is an active
 * instruction to drop the URL from the index, and inventing a host to look
 * tidy would trade a small, safe loss for a large, silent one.
 */
export function routeMetadata({
  path,
  title,
  description,
  noIndex = false,
}: RouteMetadataInput): Metadata {
  const route = canonicalPath(path);
  const base = siteUrl();
  // Empty when NEXT_PUBLIC_APP_URL is unset - see siteUrl() below.
  const url = base ? (route === "/" ? base : `${base}${route}`) : "";

  return {
    title,
    description,
    // Omit `alternates` entirely rather than emit an empty one, so Next does
    // not render `<link rel="canonical" href="">`.
    ...(url ? { alternates: { canonical: url } } : {}),
    ...(noIndex
      ? { robots: { index: false, follow: true } }
      : {}),
    openGraph: {
      title,
      description,
      // OG `url` follows the same "do not guess the host" rule.
      ...(url ? { url } : {}),
      siteName: "SpareLink India",
      locale: "en_IN",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/**
 * The absolute origin for canonical and OG URLs.
 *
 * `NEXT_PUBLIC_APP_URL` is the deployment's own configured public URL. When it
 * is missing we deliberately return the EMPTY STRING rather than guessing, and
 * `routeMetadata` then omits the canonical entirely (see below) rather than
 * emitting a localhost or an invented domain. An absent canonical is a small,
 * well-understood SEO cost; a canonical pointing at the wrong host is an active
 * instruction to de-index the site, and it is not a cost worth paying for the
 * sake of tidy markup.
 */
function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return "";
  return raw.replace(/\/+$/, "");
}