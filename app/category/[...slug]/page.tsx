import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { CategoryResultsWrapper } from "@/components/category/category-results-wrapper";
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { getServerMessages } from "@/lib/i18n/server";
import { loadCategoryNav } from "@/lib/load-category-nav";
import { resolveCategoryRoute } from "@/lib/category-navigation";
import { findStorefrontCategory } from "@/lib/storefront-categories";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * Category pages are indexable, and each one earns its own title and canonical
 * from the category it actually resolved to. The slug is turned into readable
 * words ("brakes" -> "Brakes") because a raw slug in a <title> reads as noise to
 * a search result, and the canonical always names the resolved category so two
 * slugs resolving to one category cannot compete with each other.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const words = slug
    .filter(Boolean)
    .map((part) => part.replace(/[-_]+/g, " ").trim())
    .filter(Boolean);
  const label = words.length > 0 ? words.join(" ") : "Category";
  const titled = label.charAt(0).toUpperCase() + label.slice(1);
  // The catch-all lives under /category, so the canonical must include that
  // segment. Building it from the slug alone would point every category page at
  // a top-level URL that does not exist.
  const path = `/category/${slug.filter(Boolean).join("/")}`;

  return pageMetadata({
    title: `${titled} Spare Parts`,
    description: `Shop ${titled.toLowerCase()} spare parts for Indian cars and commercial vehicles from Ambaji Traders, Hind Motors and India Sales. Filter by brand, vehicle and price.`,
    path,
  });
}

function CategoryShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="storefront-mobile-pad flex min-h-screen flex-col">
      <StorefrontHeader />
      <main className="flex-1">
        <div className="sl-container sl-page-main">{children}</div>
      </main>
      <SiteFooter />
      <Suspense fallback={null}>
        <MobileBottomNav />
      </Suspense>
    </div>
  );
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const slugs = Array.isArray(slug) ? slug : [slug];
  const messages = await getServerMessages();
  const storefront = slugs.length === 1 ? findStorefrontCategory(slugs[0]) : null;

  if (storefront) {
    return (
      <CategoryShell>
        <CategoryResultsWrapper
          path={`/category/${storefront.slug}`}
          title={messages[storefront.nameKey]}
          titleKey={storefront.nameKey}
          description={messages[storefront.descKey]}
          descriptionKey={storefront.descKey}
          image={storefront.image}
          browse={{ storefrontSlug: storefront.slug }}
          crumbs={[
            { label: messages["nav.home"], href: "/", key: "nav.home" },
            { label: messages["category.categories"], href: "/", key: "category.categories" },
            {
              label: messages[storefront.nameKey],
              href: `/category/${storefront.slug}`,
              key: storefront.nameKey,
            },
          ]}
        />
      </CategoryShell>
    );
  }

  const { categories, groups } = await loadCategoryNav();
  const route = resolveCategoryRoute(slugs, categories, groups);
  if (!route) notFound();

  return (
    <CategoryShell>
      <CategoryResultsWrapper
        path={`/category/${slugs.join("/")}`}
        title={route.title}
        browse={{
          categoryName: route.categoryName,
          nameContains: route.nameContains,
          otherType: route.otherType,
          segment: route.segment,
        }}
        crumbs={route.breadcrumb.map((item) => ({
          label: item.label === "Home" ? messages["nav.home"] : item.label,
          href: item.href,
        }))}
      />
    </CategoryShell>
  );
}
