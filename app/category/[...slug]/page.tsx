import { Suspense } from "react";
import { notFound } from "next/navigation";

import { CategoryResults } from "@/components/category/category-results";
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { SiteFooter } from "@/components/site-footer";
import { StorefrontHeader } from "@/components/storefront-header";
import { getServerMessages } from "@/lib/i18n/server";
import { loadCategoryNav } from "@/lib/load-category-nav";
import { resolveCategoryRoute } from "@/lib/category-navigation";
import { findStorefrontCategory } from "@/lib/storefront-categories";

export const dynamic = "force-dynamic";

function CategoryShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="storefront-mobile-pad sl-page flex min-h-screen flex-col">
      <StorefrontHeader />
      <main className="flex-1">
        <div className="sl-container sl-container-wide sl-page-main">{children}</div>
      </main>
      <SiteFooter />
      <Suspense fallback={null}>
        <MobileBottomNav />
      </Suspense>
    </div>
  );
}

/**
 * Catalogue skeleton matching the real results layout (header + product grid).
 * Replaces a bare "Loading..." sentence so the page never flashes bare text.
 */
function CatalogueSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <div className="sl-v2-card p-4 sm:p-5">
        <div className="sl-skeleton h-3 w-24" />
        <div className="sl-skeleton mt-3 h-7 w-2/5" />
        <div className="sl-skeleton mt-2.5 h-3.5 w-3/4" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="sl-v2-card overflow-hidden">
            <div className="sl-skeleton aspect-[4/3] w-full !rounded-none" />
            <div className="space-y-2 p-3.5">
              <div className="sl-skeleton h-2.5 w-1/3" />
              <div className="sl-skeleton h-3.5 w-full" />
              <div className="sl-skeleton h-3 w-4/5" />
              <div className="sl-skeleton h-5 w-2/5" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading catalogue</span>
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
        <Suspense fallback={<CatalogueSkeleton />}>
          <CategoryResults
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
        </Suspense>
      </CategoryShell>
    );
  }

  const { categories, groups } = await loadCategoryNav();
  const route = resolveCategoryRoute(slugs, categories, groups);
  if (!route) notFound();

  return (
    <CategoryShell>
      <Suspense fallback={<CatalogueSkeleton />}>
        <CategoryResults
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
      </Suspense>
    </CategoryShell>
  );
}
