import { Suspense } from "react";

import { HomePageContent } from "./home-client";
import { loadEnabledBanners } from "@/lib/promotional-banners";

export const dynamic = "force-dynamic";

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

  /* Enabled banners are resolved HERE, on the server, and handed to the client
     component. The banner table is never queried from the browser, and a
     deployment without a configured image origin simply gets an empty list and
     renders the empty state rather than failing the page. */
  const banners = await loadEnabledBanners();

  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <HomePageContent
        initialQuery={initialQuery}
        initialPage={initialPage}
        banners={banners}
      />
    </Suspense>
  );
}
