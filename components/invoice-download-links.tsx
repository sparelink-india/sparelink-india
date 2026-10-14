/**
 * Firm-scoped tax invoice download links.
 * Multi-firm orders must never share one combined invoice URL.
 *
 * No `"use client"` directive: this module joins the client graph through its
 * callers (every consumer is a client page), exactly like
 * `components/page-states.tsx`, which also renders `<T>` without one.
 */

import { useI18n } from "@/components/preferences-provider";
import { T } from "@/components/t";

export type InvoiceFirmAllocation = {
  firmOrderId: string;
  firmName: string;
};

export function invoiceDownloadHref(
  orderId: string,
  firmOrderId?: string | null,
): string {
  const base = `/api/orders/${encodeURIComponent(orderId)}/invoice`;
  if (!firmOrderId) return base;
  return `${base}?firmOrderId=${encodeURIComponent(firmOrderId)}`;
}

type InvoiceDownloadLinksProps = {
  orderId: string;
  allocations: InvoiceFirmAllocation[];
  className?: string;
  linkClassName: string;
  /**
   * Label for single-firm / unknown-allocation case. When the caller does not
   * supply one, the translated "Download PDF" is rendered instead of a literal.
   */
  singleLabel?: string;
  /** Prefix before firm name when multiple invoices are listed. */
  multiLabelPrefix?: string;
};

export function InvoiceDownloadLinks({
  orderId,
  allocations,
  className,
  linkClassName,
  singleLabel,
  multiLabelPrefix,
}: InvoiceDownloadLinksProps) {
  /* Called before the early return below so the hook order is unconditional. */
  const { t } = useI18n();

  if (allocations.length <= 1) {
    const firmOrderId = allocations[0]?.firmOrderId ?? null;
    return (
      <a
        href={invoiceDownloadHref(orderId, firmOrderId)}
        target="_blank"
        rel="noreferrer"
        download
        className={linkClassName}
      >
        {singleLabel ?? <T k="orderDoc.downloadPdf" />}
      </a>
    );
  }

  return (
    <div className={className ?? "flex flex-wrap items-center gap-2"}>
      {allocations.map((allocation) => (
        <a
          key={allocation.firmOrderId}
          href={invoiceDownloadHref(orderId, allocation.firmOrderId)}
          target="_blank"
          rel="noreferrer"
          download
          className={linkClassName}
          title={t("orderDoc.taxInvoiceFor", { name: allocation.firmName })}
        >
          {multiLabelPrefix ?? <T k="orderDoc.invoice" />} - {allocation.firmName}
        </a>
      ))}
    </div>
  );
}
