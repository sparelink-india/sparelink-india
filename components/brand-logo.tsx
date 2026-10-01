"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n, type ThemeName } from "@/components/preferences-provider";

/* THE ASSETS.
   The mark is supplied as a matched pair of 2:1 masters (3840x1920) in
   docs/logo-source/:

     sparelink-india-logo-4k.png       dark ink on an opaque WHITE PLATE
     sparelink-india-logo-dark-4k.png  light ink on real TRANSPARENCY

   The masters are the source of record and are never edited, resized in
   place, or served. What ships is a 1200px WebP derivative of each - a plain
   proportional scale, 4-6x oversampled for the widest slot this component
   renders at (xl:max-w-[280px] on a 2x display), so nothing is cropped,
   stretched or squared off. Both derivatives stay exactly 2:1, so the
   intrinsic ratio the header comment relies on is unchanged and swapping
   themes cannot reflow the row.

   `?v=1` is cache-busting only; the filenames are new, so the first load is
   a genuine miss either way. */
const LOGO_SRC = {
  light: "/images/brand/sparelink-india-logo.webp?v=1",
  dark: "/images/brand/sparelink-india-logo-dark.webp?v=1",
} as const;

export function BrandLogo({
  compact = false,
  invert = false,
  forceTheme,
}: {
  compact?: boolean;
  invert?: boolean;
  /** Pins the artwork regardless of the site preference. Admin's sidebar is a
   *  hardcoded dark surface in BOTH themes, so it must not follow the cookie. */
  forceTheme?: ThemeName;
}) {
  const { t, theme } = useI18n();
  const logoSrc = LOGO_SRC[forceTheme ?? theme];
  const [failed, setFailed] = useState(false);

  const imgClass = compact
    ? "h-11 w-auto max-w-[150px] object-contain object-left"
    : "h-11 w-auto max-w-[min(150px,40vw)] object-contain object-left lg:h-[72px] lg:max-w-[220px] xl:h-[88px] xl:max-w-[280px]";

  return (
    <Link
      href="/"
      aria-label={t("common.homeAria")}
      className="inline-flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1233]"
    >
      {failed ? (
        <span
          className={
            invert
              ? "text-lg font-extrabold tracking-tight text-white sm:text-xl"
              : // The image-failed fallback is TEXT, not a fill, so it takes
                // the dark-theme-safe brand ink rather than the burgundy
                // fill colour, which measures 1.61:1 on a dark surface.
                "text-lg font-extrabold tracking-tight text-[var(--v3-brand-ink)] sm:text-xl"
          }
        >
          SPARELINK INDIA
        </span>
      ) : (
        /* NO PLATE.
           The previous asset here was a raster-traced SVG - 287 pure
           #000000 fills, a dark navy wordmark - authored for a light ground
           with no dark variant. Dark mode therefore painted a light box
           behind it: `.brand-logo-plate` / `--logo-plate` in globals.css,
           plus Admin's own `bg-white/95` on its sidebar.

           That premise is gone. There is now a real dark artwork, so the
           wrapper is a bare `inline-flex` again in BOTH themes and nothing
           is painted behind the mark. Dark mode swaps the artwork, not the
           background, so no white box appears in dark mode.

           The `invert` branch is untouched and keeps its own `bg-white`
           plate. That is still correct: `html.dark .bg-white` remaps that
           token to a dark value in step with the theme, so the plate and
           the artwork stay paired. */
        <span
          className={
            invert
              ? "inline-flex rounded-md bg-white px-1.5 py-1"
              : "inline-flex"
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt="SpareLink India"
            className={imgClass}
            onError={() => setFailed(true)}
          />
        </span>
      )}
    </Link>
  );
}
