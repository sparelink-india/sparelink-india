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

  if (!priced) {
    return (
      <div className={align === "right" ? "text-right" : "text-left"}>
        <p className="text-sm font-bold text-[var(--sl-ink)]">{t("price.onRequest")}</p>
      </div>
    );
  }

  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--sl-ink-3)]">
        {t("price.listRate")}
      </p>
      <p
        className={
          showDiscount
            ? "sl-num text-sm font-semibold text-[var(--sl-ink-3)]"
            : "sl-num text-base font-extrabold text-[var(--sl-ink)]"
        }
      >
        ₹{rupees(list)}
      </p>
      <p className="text-[11px] font-medium text-[var(--sl-ok)]">{t("price.inclGst")}</p>
      {showDiscount ? (
        <>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-[var(--sl-ink-3)]">
            {t("price.netRate")}
          </p>
          <p className="sl-num text-base font-extrabold text-[var(--sl-ink)]">₹{rupees(net)}</p>
          <p className="text-[11px] font-semibold text-[var(--sl-brand)]">
            {t("price.inclTaxDiscount", { percent: String(discountPercent) })}
          </p>
        </>
      ) : null}
      {gstRate != null ? (
        <p className="text-[11px] text-[var(--sl-ink-3)]">GST {gstRate}%</p>
      ) : null}
    </div>
  );
}
