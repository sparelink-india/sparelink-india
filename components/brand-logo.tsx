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

  const imgClass = compact
    ? "h-11 w-auto max-w-[150px] object-contain object-left"
    : "h-11 w-auto max-w-[min(150px,40vw)] object-contain object-left lg:h-[72px] lg:max-w-[220px] xl:h-[88px] xl:max-w-[280px]";

  return (
    <Link
      href="/"
      aria-label="SpareLink India home"
      className="inline-flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1233]"
    >
      {failed ? (
        <span
          className={
            invert
              ? "text-lg font-extrabold tracking-tight text-white sm:text-xl"
              : "text-lg font-extrabold tracking-tight text-[#7a1233] sm:text-xl"
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
