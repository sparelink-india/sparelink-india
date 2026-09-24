"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { CatalogueProductImage } from "@/components/catalogue-product-image";
import { useI18n } from "@/components/preferences-provider";
import { readRecentlyViewed, type RecentlyViewedItem } from "@/lib/recently-viewed";

function subscribeRecentlyViewed(callback: () => void) {
  window.addEventListener("focus", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("focus", callback);
    window.removeEventListener("storage", callback);
  };
}

const emptyItems: RecentlyViewedItem[] = [];

export function RecentlyViewedSection({
  onOpen,
}: {
  onOpen: (item: RecentlyViewedItem) => void;
}) {
  const { t } = useI18n();
  const getSnapshot = useCallback(() => JSON.stringify(readRecentlyViewed()), []);
  const getServerSnapshot = useCallback(() => "[]", []);
  const rawItems = useSyncExternalStore(
    subscribeRecentlyViewed,
    getSnapshot,
    getServerSnapshot,
  );
  const items: RecentlyViewedItem[] = rawItems ? JSON.parse(rawItems) : emptyItems;

  if (items.length === 0) return null;

  return (
    <section className="px-3 py-4 sm:px-4" aria-labelledby="recently-viewed-heading">
      <div className="mb-3 flex items-end justify-between gap-2">
        <h2 id="recently-viewed-heading" className="text-lg font-bold text-slate-950">
          {t("home.recentlyViewed")}
        </h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item)}
            className="w-36 shrink-0 rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-xs"
          >
            <CatalogueProductImage
              src={item.imageUrl}
              alt={item.name}
              size="thumb"
              className="aspect-square rounded-xl bg-slate-50 p-2"
            />
            {item.brand ? (
              <p className="mt-2 truncate text-[10px] font-bold uppercase text-slate-500">{item.brand}</p>
            ) : null}
            <p className="truncate font-mono text-[11px] font-semibold text-slate-700">{item.partNumber}</p>
            <p className="line-clamp-2 text-xs font-semibold text-slate-900">{item.name}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

export function HomeOffersTeaser() {
  const { t } = useI18n();
  const [count, setCount] = useState(0);

  useEffect(() => {
    void fetch("/api/offers", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setCount(Array.isArray(data?.offers) ? data.offers.length : 0))
      .catch(() => setCount(0));
  }, []);

  if (count <= 0) return null;

  return (
    <section className="px-3 py-2 sm:px-4">
      <Link
        href="/offers"
        className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">{t("home.specialOffers")}</p>
          <p className="text-sm font-semibold text-slate-900">{t("home.offersCount", { count })}</p>
        </div>
        <span className="text-sm font-bold text-[#7a1233]">{t("hero.viewOffers")} →</span>
      </Link>
    </section>
  );
}

export function HomeTrustStrip() {
  const { t } = useI18n();
  const items = [
    t("trust.genuine"),
    t("trust.panIndia"),
    t("trust.support"),
  ];
  return (
    <section className="border-y border-slate-200 bg-white px-3 py-4 sm:px-4" aria-label={t("trust.title")}>
      <h2 className="text-sm font-bold text-slate-950">{t("trust.title")}</h2>
      <ul className="mt-2 grid gap-2 sm:grid-cols-3">
        {items.map((item) => (
          <li key={item} className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
