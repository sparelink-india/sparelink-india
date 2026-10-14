"use client";

import Link from "next/link";

import { ProductCard } from "@/components/product/product-card";
import type { ProductCardListing } from "@/components/product/product-card";
import { useI18n } from "@/components/preferences-provider";

/**
 * GENERATION-4 PRODUCT RAIL / GRID.
 *
 * The one place card GEOMETRY is decided. Every product surface — homepage,
 * category, search, a future "related parts" block — renders cards through this
 * component, so the column count lives here exactly once.
 *
 * WHY A RAIL, NOT A CAROUSEL
 * -------------------------
 * No carousel library is introduced. A carousel hides items behind a control
 * and needs its own keyboard, focus-trap and reduced-motion handling; a scroll
 * rail is native scrolling, which the browser already makes keyboard-accessible
 * and which respects `prefers-reduced-motion` for free. It also cannot produce
 * the horizontal PAGE overflow that an off-canvas carousel is prone to.
 *
 * The rail is `overflow-x: auto` on an inner element only, and the outer section
 * never exceeds its container width, so the document itself cannot scroll
 * sideways — which is the failure that actually matters on a phone.
 *
 * `scroll-snap` is used so a card released mid-swipe settles rather than
 * stopping between two cards.
 */

export type RailProduct = {
  id: string;
  name: string;
  brand?: string | null;
  partNumber?: string | null;
  imageUrl?: string | null;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  application?: string | null;
  badge?: string | null;
  href?: string;
  listing?: ProductCardListing | null;
};

type ProductRailProps = {
  products: RailProduct[];
  /** `grid` fills the container and wraps. `rail` scrolls horizontally. */
  variant?: "grid" | "rail";
  /** Heading level, so the rail can sit under any section heading correctly. */
  headingLevel?: 2 | 3;
  title?: string;
  id?: string;
  viewAllHref?: string;
  loading?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  onOpen?: (product: RailProduct) => void;
  onAdd?: (product: RailProduct) => void;
  onToggleWishlist?: (product: RailProduct) => void;
  wishlistedIds?: ReadonlySet<string>;
  addingId?: string | null;
  justAddedId?: string | null;
  className?: string;
};

/**
 * Column widths, per breakpoint. Declared once, here.
 *
 * Mobile is 2 columns rather than 1: a single card per row on a 390px phone
 * turns a browsable grid into a very long scroll, and two columns still leave
 * ~180px per card, which is enough for a part number at 13px mono.
 *
 * `minmax(0, 1fr)` rather than `1fr` throughout: `1fr` resolves to
 * `minmax(auto, 1fr)`, and an `auto` minimum lets a long unbreakable part
 * number push a track wider than its share, which is the usual cause of a
 * one-card horizontal overflow on a real device.
 *
 * `minmax(0, 1fr)` rather than `1fr` throughout: `1fr` resolves to
 * `minmax(auto, 1fr)`, and an `auto` minimum lets a long unbreakable part
 * number push a track wider than its share, which is the usual cause of a
 * one-card horizontal overflow on a real device.
 */
const GRID_CLASS =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5";

const RAIL_CARD_CLASS = "w-[68vw] max-w-[15rem] shrink-0 sm:w-[15rem]";

export function ProductRail({
  products,
  variant = "grid",
  headingLevel = 2,
  title,
  id,
  viewAllHref,
  loading = false,
  emptyTitle,
  emptyHint,
  onOpen,
  onAdd,
  onToggleWishlist,
  wishlistedIds,
  addingId,
  justAddedId,
  className = "",
}: ProductRailProps) {
  const { t } = useI18n();
  const Heading = (headingLevel === 3 ? "h3" : "h2") as "h2" | "h3";

  /* ---- LOADING: render skeleton cards in the real grid so the section does
     not change height when the products arrive. */
  if (loading) {
    return (
      <section id={id} className={`sl-band-tight ${className}`} aria-busy="true">
        <div className="sl-container">
          {title ? (
            <div className="mb-5 flex items-end justify-between gap-4">
              <h2 className="sl-h2">{title}</h2>
            </div>
          ) : null}
          <div className={GRID_CLASS}>
            {Array.from({ length: 5 }).map((_, i) => (
              <ProductCard key={`skeleton-${i}`} name="" loading />
            ))}
          </div>
        </div>
      </section>
    );
  }

  /* ---- EMPTY: an honest, designed state. A rail that has nothing should say
     so rather than collapsing to a 0px band. */
  if (!products.length) {
    return (
      <section id={id} className={`sl-band-tight ${className}`}>
        <div className="sl-container">
          <div className="sl-panel sl-state">
            <p className="sl-state-title">{emptyTitle ?? t("product.emptyTitle")}</p>
            <p className="sl-state-text">{emptyHint ?? t("product.emptyHint")}</p>
            {viewAllHref ? (
              <Link
                href={viewAllHref}
                className="sl-btn sl-btn-secondary mt-2"
              >
                {t("hero.v3browseAll")}
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  const cards = products.map((product) => (
    <ProductCard
      key={product.id}
      name={product.name}
      brand={product.brand}
      partNumber={product.partNumber}
      imageUrl={product.imageUrl}
      thumbUrl={product.thumbUrl}
      mediumUrl={product.mediumUrl}
      application={product.application}
      badge={product.badge}
      listing={product.listing}
      className={variant === "rail" ? RAIL_CARD_CLASS : undefined}
      onOpen={
        onOpen
          ? () => onOpen(product)
          : product.href
            ? undefined
            : undefined
      }
      onAdd={onAdd ? () => onAdd(product) : undefined}
      onToggleWishlist={
        onToggleWishlist ? () => onToggleWishlist(product) : undefined
      }
      wishlisted={wishlistedIds ? wishlistedIds.has(product.id) : false}
      adding={addingId === product.id}
      justAdded={justAddedId === product.id}
    />
  ));

  return (
    <section id={id} className={`sl-band-tight ${className}`}>
      <div className="sl-container">
        {title ? (
          <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <Heading className="sl-h2">{title}</Heading>
            {viewAllHref ? (
              <Link
                href={viewAllHref}
                className="sl-navlink sl-focus shrink-0"
              >
                {t("hero.v3browseAll")}
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            ) : null}
          </div>
        ) : null}

        {variant === "grid" ? (
          <div className={GRID_CLASS}>{cards}</div>
        ) : (
          /* The scroller. `snap-x` + `snap-start` on the cards gives a settle
             point; `pb-1` leaves room for the scrollbar so it cannot overlap
             the last card; the negative inline margin lets a card use the full
             gutter width on a phone without the section itself overflowing. */
          <div
            className="-mx-[var(--dt-gutter)] flex snap-x snap-mandatory gap-3 overflow-x-auto px-[var(--dt-gutter)] pb-1 sm:gap-4 [scrollbar-width:thin]"
            role="group"
            aria-label={title ?? t("product.railLabel")}
          >
            {cards.map((card, i) => (
              <div key={products[i]?.id ?? i} className="snap-start">
                {card}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}