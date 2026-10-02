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
        <h2 id="recently-viewed-heading" className="text-lg font-bold text-[var(--v3-text)]">
          {t("home.recentlyViewed")}
        </h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item)}
            className="w-36 shrink-0 rounded-[var(--v3-r)] border border-[var(--v3-rule)] bg-[var(--v3-panel)] p-2 text-left "
          >
            <CatalogueProductImage
              src={item.imageUrl}
              alt={item.name}
              size="thumb"
              className="aspect-square rounded-[var(--v3-r)] bg-[var(--v3-sunk)] p-2"
            />
            {item.brand ? (
              <p className="mt-2 truncate text-[10px] font-bold uppercase text-[var(--v3-text-3)]">{item.brand}</p>
            ) : null}
            <p className="truncate font-mono text-[11px] font-semibold text-[var(--v3-text-2)]">{item.partNumber}</p>
            <p className="line-clamp-2 text-xs font-semibold text-[var(--v3-text)]">{item.name}</p>
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
        className="flex min-h-14 items-center justify-between gap-3 rounded-[var(--v3-r)] border border-[var(--v3-warn-line)] bg-[var(--v3-warn-soft)] px-4 py-3"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--v3-warn)]">{t("home.specialOffers")}</p>
          <p className="text-sm font-semibold text-[var(--v3-text)]">{t("home.offersCount", { count })}</p>
        </div>
        <span className="text-sm font-bold text-[var(--v3-brand-ink)]">{t("hero.viewOffers")} →</span>
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
    <section className="border-y border-[var(--v3-rule)] bg-[var(--v3-panel)] px-3 py-4 sm:px-4" aria-label={t("trust.title")}>
      <h2 className="text-sm font-bold text-[var(--v3-text)]">{t("trust.title")}</h2>
      <ul className="mt-2 grid gap-2 sm:grid-cols-3">
        {items.map((item) => (
          <li key={item} className="rounded-[var(--v3-r)] bg-[var(--v3-sunk)] px-3 py-2.5 text-xs font-semibold text-[var(--v3-text-2)]">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
