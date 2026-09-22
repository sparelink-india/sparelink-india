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
    <div className="storefront-mobile-pad flex min-h-screen flex-col bg-slate-50">
      <StorefrontHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-10">{children}</div>
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
        <Suspense fallback={<p className="text-sm text-slate-500">{messages["common.loading"]}</p>}>
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
      <Suspense fallback={<p className="text-sm text-slate-500">{messages["common.loading"]}</p>}>
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
