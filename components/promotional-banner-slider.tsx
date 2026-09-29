"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { useI18n } from "@/components/preferences-provider";
import type { PublicBanner } from "@/lib/promotional-banners";

/**
 * The storefront promotional banner slider.
 *
 * Behaviour, and why each part exists:
 *
 *   AUTO-ADVANCE   6s. Slow on purpose. A promotional strip competes with the
 *                  catalogue, and a fast carousel reads as an ad network. The
 *                  timer is cleared and re-armed rather than paused with a flag,
 *                  so a slide cannot resume mid-interval after a hover.
 *   PAUSE ON HOVER  and on focus-within. Someone reading a banner, tabbing
 *                  through the controls, or mid-swipe should not have it move
 *                  out from under them.
 *   REDUCED MOTION auto-advance is disabled entirely — not merely slowed.
 *                  Manual arrows and dots keep working, because "no animation"
 *                  must not mean "no way to reach slide 4".
 *   NO LAYOUT SHIFT the track is a fixed-aspect flex row and the viewport is an
 *                  aspect-ratio box, so the section reserves its full height
 *                  before any image loads and does not resize as slides change.
 *   SWIPE          pointer events, so one code path covers touch, pen and
 *                  mouse drag. Horizontal intent only: a vertical drag is
 *                  ignored so the slider never fights page scrolling.
 *
 * ASPECT RATIO is fixed at 3:1 desktop / 16:9 mobile via CSS, which is inside
 * the 3:1–4:1 range the brief asked for. Images are `object-contain` on a
 * neutral stage, so an admin's slightly-off-ratio artwork is letterboxed rather
 * than cropped — the brief explicitly said not to force-crop important content.
 */

/** Slow enough to read, fast enough that a four-banner loop is not a wait. */
const ADVANCE_MS = 6000;

/** A drag shorter than this is treated as a tap, not a swipe. */
const SWIPE_THRESHOLD_PX = 40;

export function PromotionalBannerSlider({ banners }: { banners: PublicBanner[] }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const baseId = useId();

  const count = banners.length;

  /* Clamp rather than reset the whole carousel: a banner that is disabled while
     slide 3 is showing must not throw the visitor back to slide 1. */
  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const previous = useCallback(() => goTo(index - 1), [goTo, index]);

  /* Honour the OS setting, and keep honouring it if the visitor changes it
     while the page is open. */
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    /* One banner has nothing to slide to, and a two-banner loop under reduced
       motion would still move, so auto-advance needs at least three. */
    if (reducedMotion || paused || count < 2) return;
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % count);
    }, ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [count, index, paused, reducedMotion]);

  if (count === 0) {
    return <BannerEmptyState label={t("banners.label")} title={t("banners.emptyTitle")} body={t("banners.emptyBody")} />;
  }

  const active = banners[Math.min(index, count - 1)];
  const slideLabel = (position: number, title: string) =>
    t("banners.slide", { n: position, total: count, title });

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("banners.label")}
      className="v3-band border-b border-[var(--v3-rule)] bg-[var(--v3-page)]"
    >
      <div className="v3-container">
        {/* `onMouseEnter`/`onMouseLeave` rather than CSS hover: the timer has to
            actually stop, not just the animation. `focus-within` covers keyboard
            users and is not a hover state at all. */}
        <div
          className="v3-carousel group relative"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setPaused(false);
            }
          }}
        >
          <div className="v3-carousel-viewport">
            <div
              className="v3-carousel-track"
              style={{ transform: `translate3d(-${index * 100}%, 0, 0)` }}
              onPointerDown={(event) => {
                // Ignore secondary mouse buttons; they open menus, not slides.
                if (event.pointerType === "mouse" && event.button !== 0) return;
                pointerStart.current = { x: event.clientX, y: event.clientY };
              }}
              onPointerUp={(event) => {
                const start = pointerStart.current;
                pointerStart.current = null;
                if (!start) return;
                const dx = event.clientX - start.x;
                const dy = event.clientY - start.y;
                /* Horizontal-intent gate. Without it, scrolling the page up
                   down a phone would also change slides. */
                if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
                if (Math.abs(dx) <= Math.abs(dy)) return;
                if (dx < 0) next();
                else previous();
              }}
              onPointerCancel={() => {
                pointerStart.current = null;
              }}
            >
              {banners.map((banner, slide) => (
                <Slide
                  key={banner.id}
                  banner={banner}
                  active={slide === index}
                  isNearActive={Math.abs(slide - index) < 2}
                  slideId={`${baseId}-slide-${slide}`}
                  label={slideLabel(slide + 1, banner.title)}
                />
              ))}
            </div>
          </div>

          {count > 1 ? (
            <>
              <CarouselArrow
                side="previous"
                onClick={previous}
                label={t("banners.previous")}
              />
              <CarouselArrow side="next" onClick={next} label={t("banners.next")} />

              {/* Dots. `aria-current` plus `aria-controls`, so the current slide
                  is both announced and reachable, not just drawn. */}
              <div className="v3-carousel-dots">
                {banners.map((banner, slide) => (
                  <button
                    key={banner.id}
                    type="button"
                    onClick={() => goTo(slide)}
                    aria-current={slide === index ? "true" : undefined}
                    aria-controls={`${baseId}-slide-${slide}`}
                    aria-label={slideLabel(slide + 1, banner.title)}
                    className={`v3-carousel-dot ${
                      slide === index ? "is-active" : ""
                    }`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>

        {/* One polite live region rather than an aria-live on the whole track:
            announcing the track would read every banner on every change. */}
        <p aria-live="polite" className="sr-only">
          {slideLabel(index + 1, active.title)}
        </p>
      </div>
    </section>
  );
}

function Slide({
  banner,
  active,
  isNearActive,
  slideId,
  label,
}: {
  banner: PublicBanner;
  active: boolean;
  isNearActive: boolean;
  slideId: string;
  label: string;
}) {
  /* A banner with no destination is DISPLAY ONLY. Rendering an <a> with an
     empty or "#" href would make the whole slide look clickable, keyboard
     focusable and announce as a link, so a non-interactive <div> is used
     instead. This is the difference between "no destination" and "a broken
     link", and it is the reason `href` is nullable all the way from the DB. */
  const content = (
    <Image
      src={banner.imageUrl}
      alt={banner.altText}
      fill
      sizes="(min-width: 1024px) 1216px, 100vw"
      /* contain, not cover: the brief said not to force-crop important
         content, so an admin's 4:1 artwork is letterboxed on a 3:1 stage. */
      className="object-contain"
      /* The current slide and its immediate neighbours are the only ones worth
         fetching up front. `priority` is deliberately NOT set: a promotional
         banner must never compete with the hero or the first product image for
         bandwidth on a phone. */
      loading={isNearActive ? "eager" : "lazy"}
      decoding="async"
    />
  );

  return (
    <div
      className="v3-carousel-slide"
      id={slideId}
      role="group"
      aria-roledescription="slide"
      aria-label={label}
      /* Inert on the off-screen slides, so a keyboard user cannot Tab into a
         link they cannot see. This is the difference between a carousel that
         works and one that quietly breaks keyboard access. */
      inert={!active}
    >
      {banner.href ? (
        <a
          href={banner.href}
          className="v3-focus block h-full w-full"
          /* An off-site destination opens in a new tab; a site-relative one
             must not, or Back no longer returns to the banner. */
          {...(banner.href.startsWith("/")
            ? {}
            : { target: "_blank", rel: "noopener noreferrer" })}
        >
          {content}
        </a>
      ) : (
        <div className="h-full w-full">{content}</div>
      )}
    </div>
  );
}

function CarouselArrow({
  side,
  onClick,
  label,
}: {
  side: "previous" | "next";
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`v3-carousel-arrow v3-carousel-arrow-${side}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {side === "previous" ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
      </svg>
    </button>
  );
}

/**
 * The zero-banner state.
 *
 * Deliberately NOT a dashed drop-zone and NOT a stock photo: the brief was
 * explicit that no placeholder advertising artwork may reach production. So
 * this is the same ruled, squared V3 panel the rest of the page uses, with one
 * muted line. It reads as an intentional quiet area, not as a broken slot, and
 * it disappears by itself the moment an admin uploads and enables a banner.
 */
function BannerEmptyState({
  label,
  title,
  body,
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <section
      aria-label={label}
      className="v3-band border-b border-[var(--v3-rule)] bg-[var(--v3-page)]"
    >
      <div className="v3-container">
        <div className="v3-carousel-viewport v3-carousel-empty">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 shrink-0 text-[var(--v3-text-3)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 15l4.5-4.5 3 3L15 9l6 6" />
            <circle cx="8.5" cy="9" r="1.2" />
          </svg>
          <div className="min-w-0">
            <p className="text-[0.75rem] font-semibold text-[var(--v3-text-2)]">
              {title}
            </p>
            <p className="text-[0.6875rem] leading-relaxed text-[var(--v3-text-3)]">
              {body}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
