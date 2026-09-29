import { Suspense } from "react";

import { loadEnabledBanners } from "@/lib/promotional-banners";
import { HomePageContent } from "./home-client";

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

  return (
    <Suspense fallback={<div className="v3-page-root min-h-screen" />}>
      <HomePageContent
        initialQuery={initialQuery}
        initialPage={initialPage}
        banners={banners}
      />
    </Suspense>
  );
}
