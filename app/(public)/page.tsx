import { getServerSession } from "@/lib/auth-server";
import { loadEnabledBanners } from "@/lib/promotional-banners";
import { loadPublicBrands } from "@/lib/load-public-brands";
import { loadCategoryNav } from "@/lib/load-category-nav";
import { pageMetadata } from "@/lib/seo";
import { HomePageContent } from "./home-client";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Genuine Auto Parts, Filters & Accessories",
  description:
    "Buy genuine spare parts for Maruti, Hyundai, Tata, Mahindra and more. Filters, brakes, engine and electrical parts from Ambaji Traders, Hind Motors and India Sales, with pan-India delivery.",
  path: "/",
});

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialQuery = firstParam(params.q);
  const parsedPage = Number(firstParam(params.page) || "1");
  const initialPage =
    Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1;

  /* Whether anyone is signed in, resolved ONCE on the server.

     The wishlist and saved-vehicle (garage) endpoints are authenticated by
     design, and the client cannot know that before it asks. Fetching them
     anonymously therefore bought nothing but a guaranteed 401 per call, which
     the browser then logs as a console error for every visitor who has not
     signed in. Passing the answer down lets those calls be skipped outright
     while changing nothing for a signed-in visitor. */
  const session = await getServerSession();
  const isAuthenticated = Boolean(session?.user);

  /* Enabled banners are resolved HERE, on the server, and handed to the client
     component. Two reasons, both of which the client-fetch version got wrong:
     the carousel's stage has to occupy its height on the very first paint or
     the page jumps, and "only ENABLED banners appear on the storefront" is a
     filter that belongs on the server path rather than in a client effect.

     A failure here must never take the homepage down, so it degrades to the
     empty state rather than propagating. */
  const banners = await loadEnabledBanners().catch((error) => {
    console.error("Promotional banners could not be loaded:", error);
    return [];
  });

  /* Catalogue categories and brands are ALSO resolved here, on the server, for
     exactly the reason the banners are: the generation-4 homepage renders
     category tiles, brand tiles and a part rail from these lists, and if they
     arrive in a client effect the sections are empty in the server HTML. That
     costs indexable category links on the most-requested page in the site, and
     the grid visibly jumps when the cards appear.

     Both loaders already swallow their own failures, so neither can take the
     homepage down; the sections degrade to fewer cards. */
  const [{ categories }, brands] = await Promise.all([
    loadCategoryNav().catch((error) => {
      console.error("Catalogue categories could not be loaded:", error);
      return { categories: [], groups: [], coverage: null };
    }),
    loadPublicBrands(),
  ]);

  /* NOTE: there is deliberately NO <Suspense> boundary around HomePageContent.

     HomePageContent is a client component that reads useSearchParams(). When it
     is wrapped in a Suspense boundary, Next.js treats that boundary as a
     client-render bailout, and the boundary never hydrates: the server HTML
     stays on screen, React never attaches the client tree, and therefore NO
     effect in the page runs. In practice that meant the storefront search was
     permanently stuck on "Loading…" — performSearch() in home-client.tsx was
     never called, so /api/search/parts was never requested and the customer saw
     zero results for every query, on every route that renders this page.

     Nothing in this subtree suspends (no use(), React.lazy or next/dynamic), so
     the boundary bought nothing but the bug. Do not add one. */
  return (
    <HomePageContent
      initialQuery={initialQuery}
      initialPage={initialPage}
      banners={banners}
      isAuthenticated={isAuthenticated}
      initialCategories={categories}
      initialBrands={brands}
    />
  );
}
