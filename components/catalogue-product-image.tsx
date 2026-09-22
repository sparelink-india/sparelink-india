"use client";

import { useState } from "react";

import { catalogueImageFallbackChain } from "@/lib/catalogue-display-image";

type CatalogueProductImageProps = {
  src?: string | null;
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  alt: string;
  size?: "thumb" | "medium";
  className?: string;
  imgClassName?: string;
};

export function CatalogueProductImage({
  src,
  thumbUrl,
  mediumUrl,
  alt,
  size = "thumb",
  className = "",
  imgClassName = "h-full w-full object-contain",
}: CatalogueProductImageProps) {
  const chain = catalogueImageFallbackChain({
    thumbUrl,
    mediumUrl,
    imageUrl: src,
    size,
  });
  const [index, setIndex] = useState(0);
  const current = chain[Math.min(index, chain.length - 1)];

  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={imgClassName}
        onError={() => {
          setIndex((prev) => (prev + 1 < chain.length ? prev + 1 : prev));
        }}
      />
    </div>
  );
}
