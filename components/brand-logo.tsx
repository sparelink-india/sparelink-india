"use client";

import { useState } from "react";
import Link from "next/link";

const LOGO_SRC = "/images/brand/sparelink-india-logo.svg?v=2";

export function BrandLogo({
  compact = false,
  invert = false,
}: {
  compact?: boolean;
  invert?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  /* The mark is exactly 2:1 (1774x887), so locking the width and the height to
     the same ratio gives a fixed logo box that cannot reflow the header row at
     any viewport. `object-contain` still guards against distortion if the
     asset is ever replaced with a different ratio. */
  const imgClass = compact
    ? "h-11 w-auto max-w-[150px] object-contain object-left"
    : "h-11 w-[88px] object-contain object-left md:h-[60px] md:w-[120px] lg:h-[72px] lg:w-[144px]";

  return (
    <Link
      href="/"
      aria-label="SpareLink India home"
      className="inline-flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sl-brand-on-dark)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sl-graphite)]"
    >
      {failed ? (
        <span
          className={
            invert
              ? "text-lg font-extrabold tracking-tight text-[var(--sl-graphite)]"
              : "text-lg font-extrabold tracking-tight text-[var(--sl-brand-ink)]"
          }
        >
          SPARELINK INDIA
        </span>
      ) : (
        <span className={invert ? "inline-flex rounded-md bg-white px-1.5 py-1" : "inline-flex"}>
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
