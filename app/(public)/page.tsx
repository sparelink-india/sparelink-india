import { Suspense } from "react";

import { loadEnabledBanners } from "@/lib/promotional-banners";
import { readHeroSlotAvailability } from "@/lib/hero-slot-availability";
import { HomePageContent } from "./home-client";
import { routeMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

/* The homepage is the one route whose canonical is the bare origin. Until this
   export it had no title of its own either, so it inherited the layout default
   "SpareLink India" with no keyword and no description of its own. */
export const metadata = routeMetadata({
  path: "/",
  title: "SpareLink India - Auto Spare Parts at Wholesale Prices",
  description:
    "Genuine and quality auto spare parts at wholesale prices for cars, trucks, two wheelers, LCV/HCV, agriculture and industrial vehicles, with pan-India delivery.",
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

  /* Which hero vehicle classes have a curated set, resolved HERE for the same
     reason banners are: the hero lives inside a client component, so it cannot
     read the database itself, and a client fetch would put the fallback decision
     behind a round-trip that can fail visibly. A hero dot that 404s is worse than
     one that goes to the fitment browser, so this degrades to "no collections"
     rather than throwing. */
  const heroSlots = await readHeroSlotAvailability();

  return (
    <Suspense fallback={<div className="v3-page-root min-h-screen" />}>
      <HomePageContent
        initialQuery={initialQuery}
        initialPage={initialPage}
        banners={banners}
        heroSlots={heroSlots}
      />
    </Suspense>
  );
}
