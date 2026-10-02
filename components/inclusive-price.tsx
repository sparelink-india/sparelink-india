"use client";

import { useI18n } from "@/components/preferences-provider";
import { isAuthoritativeSellingPricePaise } from "@/lib/storefront-price-display";

export type InclusivePriceFields = {
  pricePaise: number;
  listInclusivePaise?: number;
  netInclusivePaise?: number;
  discountPercent?: number;
  gstRate?: number | null;
  align?: "left" | "right";
};

function rupees(paise: number) {
  return (paise / 100).toLocaleString("en-IN");
}

/**
 * The one price block in the storefront.
 *
 * Written in V3 tokens rather than raw palette classes because it appears in
 * the product card, the catalogue table, the product modal, the cart, the
 * checkout summary and the order detail - so a single colour decision made with
 * a token here is a colour decision made correctly in six places, in both
 * themes.
 *
 * The price ITSELF is the emphasis on the page, so it wears `v3-price`
 * (tabular numerals, tight tracking). Everything around it - the "list rate"
 * caption, the GST note - is deliberately quiet, because four equally loud
 * numbers would give the buyer no way to tell which one to pay.
 */
export function InclusivePrice({
  pricePaise,
  listInclusivePaise,
  netInclusivePaise,
  discountPercent,
  gstRate,
  align = "right",
}: InclusivePriceFields) {
  const { t } = useI18n();
  const list = listInclusivePaise ?? pricePaise;
  const net = netInclusivePaise ?? list;
  const priced = isAuthoritativeSellingPricePaise(list, net, pricePaise);
  const showDiscount = priced && (discountPercent ?? 0) > 0 && net !== list;
  const alignClass = align === "right" ? "text-right" : "text-left";

  if (!priced) {
    return (
      <div className={alignClass}>
        <p className="text-sm font-bold text-[var(--v3-text)]">{t("price.onRequest")}</p>
      </div>
    );
  }

  return (
    <div className={alignClass}>
      <p className="v3-label">{t("price.listRate")}</p>
      <p className={showDiscount ? "text-sm font-semibold text-[var(--v3-text-3)]" : "v3-price"}>
        ₹{rupees(list)}
      </p>
      <p className="text-[11px] font-medium text-[var(--v3-ok)]">{t("price.inclGst")}</p>
      {showDiscount ? (
        <>
          <p className="v3-label mt-1">{t("price.netRate")}</p>
          <p className="v3-price">₹{rupees(net)}</p>
          <p className="text-[11px] font-semibold text-[var(--v3-brand-ink)]">
            {t("price.inclTaxDiscount", { percent: String(discountPercent) })}
          </p>
        </>
      ) : null}
      {gstRate != null ? (
        <p className="text-[11px] text-[var(--v3-text-3)]">GST {gstRate}%</p>
      ) : null}
    </div>
  );
}
