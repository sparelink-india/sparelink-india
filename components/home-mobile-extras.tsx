"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { CatalogueProductImage } from "@/components/catalogue-product-image";
import { useI18n } from "@/components/preferences-provider";
import { readRecentlyViewed, type RecentlyViewedItem } from "@/lib/recently-viewed";

/**
 * V3 mobile-only homepage structures.
 *
 * `HomeTrustStrip` has been DELETED. The homepage trust section was rebuilt
 * inline in home-client.tsx as a single hairline-divided strip of five
 * indicators, visible at every breakpoint. This component was a second,
 * narrower three-item version that only rendered below `md` — so on a phone
 * the customer saw three trust claims, and on a desktop five, from two
 * different components. Keeping it would mean maintaining two contradictory
 * trust lists on one page. Nothing imports it.
 *
 * What remains:
 *
 *   RECENTLY VIEWED  a horizontal rail of square product tiles. V2 used a
 *                    white-to-pink gradient image well and a 10px uppercase
 *                    brand line; the sunk square stage and the
 *                    `sl-metric-label` role make a recently-viewed tile the
 *                    same object as a catalogue card seen elsewhere.
 *   OFFERS TEASER    a single row. The badge above a sentence is replaced by a
 *                    label and the count as a figure, and the chevron is always
 *                    visible so the row reads as tappable.
 */

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
    <section
      className="border-b border-[var(--sl-rule)] bg-[var(--sl-surface)] px-4 py-4"
      aria-labelledby="recently-viewed-heading"
    >
      <div className="mb-3 border-b border-[var(--sl-rule)] pb-2.5">
        <h2 id="recently-viewed-heading" className="sl-h3">
          {t("home.recentlyViewed")}
        </h2>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item)}
            className="sl-panel sl-focus group w-[8.5rem] shrink-0 p-2 text-left transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-[var(--sl-e-3)]"
          >
            <span className="relative block aspect-square w-full overflow-hidden rounded-[var(--sl-r)] bg-[var(--sl-sunken)]">
              <CatalogueProductImage
                src={item.imageUrl}
                alt={item.name}
                size="thumb"
                className="h-full w-full p-2 transition-transform duration-300 group-hover:scale-[1.04]"
              />
            </span>
            {item.brand ? (
              <span className="sl-metric-label mt-2 block !text-[0.5rem]">{item.brand}</span>
            ) : null}
            <span className="sl-partno mt-0.5 block truncate !text-[0.6875rem]">
              {item.partNumber}
            </span>
            <span className="sl-clamp-2 mt-1 block text-[0.6875rem] font-semibold leading-snug text-[var(--sl-ink)]">
              {item.name}
            </span>
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

/**
 * Offers teaser.
 *
 * Only rendered when the offers endpoint actually returns rows, so a customer
 * is never sent to an empty page from the homepage. The count is shown as a
 * figure beside the label rather than inside a pill.
 */
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
    <section className="border-b border-[var(--sl-rule)] bg-[var(--sl-surface)] px-4 py-3">
      <Link
        href="/offers"
        className="sl-panel sl-focus group flex min-h-14 items-center justify-between gap-3 px-3.5 py-2.5 transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-[var(--sl-e-3)]"
      >
        <span className="min-w-0">
          <span className="sl-metric-label block !text-[0.5625rem]">
            {t("home.specialOffers")}
          </span>
          <span className="mt-1 block text-[0.8125rem] font-semibold text-[var(--sl-ink)]">
            {t("home.offersCount", { count })}
          </span>
        </span>
        <span className="sl-num flex shrink-0 items-center gap-1.5 text-[1.125rem] font-extrabold text-[var(--sl-brand)]">
          {count}
          <ArrowGlyph />
        </span>
      </Link>
    </section>
  );
}
