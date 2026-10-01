"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/preferences-provider";

const LOGO_SRC = "/images/brand/sparelink-india-logo.svg?v=2";

export function BrandLogo({
  compact = false,
  invert = false,
}: {
  compact?: boolean;
  invert?: boolean;
}) {
  const { t } = useI18n();
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
        /* THE PLATE.
           This SVG is a raster-traced lockup - 287 pure #000000 fills, a
           dark navy wordmark, red and orange accents - authored for a light
           ground. There is no dark variant of it and no colour decision
           makes dark artwork readable on a dark surface, so dark mode puts
           a light plate back under it. `html.dark .brand-logo-plate` in
           globals.css owns the padding and the background, which means:

             - LIGHT MODE IS UNCHANGED. The class adds nothing without the
               `.dark` ancestor, so the wrapper stays a bare `inline-flex`
               exactly as it was.
             - the `invert` branch is untouched. It already had its own
               `bg-white` plate for the auth pages' dark ground, and
               changing it would break that.
             - Admin is not affected. `admin-shell.tsx:95` supplies its
               own `bg-white/95` plate on a hardcoded `bg-[#0f172a]`
               sidebar, and this class does not apply there.

           It mirrors `.fitment-logo-plate`, the established pattern for the
           vehicle brand logos, which exists for the identical reason. */
        <span
          className={
            invert
              ? "inline-flex rounded-md bg-white px-1.5 py-1"
              : "brand-logo-plate inline-flex"
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO_SRC}
            alt="SpareLink India"
            className={imgClass}
            onError={() => setFailed(true)}
          />
        </span>
      )}
    </Link>
  );
}
