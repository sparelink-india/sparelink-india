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
        <p className="text-sm font-bold text-slate-800">{t("price.onRequest")}</p>
      </div>
    );
  }

  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {t("price.listRate")}
      </p>
      <p
        className={
          showDiscount
            ? "text-sm font-semibold text-slate-500"
            : "text-base font-extrabold text-slate-950"
        }
      >
        ₹{rupees(list)}
      </p>
      <p className="text-[11px] font-medium text-emerald-700">{t("price.inclGst")}</p>
      {showDiscount ? (
        <>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {t("price.netRate")}
          </p>
          <p className="text-base font-extrabold text-slate-950">₹{rupees(net)}</p>
          <p className="text-[11px] font-semibold text-[#7a1233]">
            {t("price.inclTaxDiscount", { percent: String(discountPercent) })}
          </p>
        </>
      ) : null}
      {gstRate != null ? (
        <p className="text-[11px] text-slate-500">GST {gstRate}%</p>
      ) : null}
    </div>
  );
}
