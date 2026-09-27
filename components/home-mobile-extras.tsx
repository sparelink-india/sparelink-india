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
        <h2 id="recently-viewed-heading" className="sl-h2 text-lg">
          {t("home.recentlyViewed")}
        </h2>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item)}
            className="sl-v2-card sl-v2-card-hover w-36 shrink-0 p-2 text-left"
          >
            <CatalogueProductImage
              src={item.imageUrl}
              alt={item.name}
              size="thumb"
              className="aspect-square rounded-[var(--sl-radius)] bg-gradient-to-b from-white to-brand-50/40 p-2"
            />
            {item.brand ? (
              <p className="mt-2 truncate text-[10px] font-bold uppercase text-[var(--sl-primary)]">
                {item.brand}
              </p>
            ) : null}
            <p className="sl-type-partno truncate">{item.partNumber}</p>
            <p className="line-clamp-2 text-xs font-semibold text-[var(--sl-text)]">{item.name}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function ArrowGlyph({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
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
        className="sl-v2-card sl-v2-card-hover sl-v2-rule flex min-h-14 items-center justify-between gap-3 px-4 py-3"
      >
        <div>
          <p className="sl-v2-badge sl-v2-badge-brand">{t("home.specialOffers")}</p>
          <p className="mt-1 text-sm font-semibold text-[var(--sl-text)]">
            {t("home.offersCount", { count })}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-bold text-[var(--sl-primary)]">
          {t("hero.viewOffers")}
          <ArrowGlyph />
        </span>
      </Link>
    </section>
  );
}

export function HomeTrustStrip() {
  const { t } = useI18n();
  const items = [t("trust.genuine"), t("trust.panIndia"), t("trust.support")];
  return (
    <section
      className="border-y border-[var(--sl-border)]/70 bg-gradient-to-b from-brand-50/50 to-white px-3 py-4 sm:px-4"
      aria-label={t("trust.title")}
    >
      <h2 className="sl-h2 text-sm">{t("trust.title")}</h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {items.map((item) => (
          <li
            key={item}
            className="rounded-[var(--sl-radius)] border border-[var(--sl-border)]/80 bg-white px-3 py-2.5 text-xs font-semibold text-[var(--sl-text-soft)]"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
