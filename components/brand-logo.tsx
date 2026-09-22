"use client";

import Link from "next/link";
import { useState } from "react";

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
    : "h-11 w-auto max-w-[150px] object-contain object-left md:h-[80px] md:max-w-[250px] lg:h-[88px] lg:max-w-[280px]";

  return (
    <Link
      href="/"
      className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1233]"
      aria-label="SpareLink India home"
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
