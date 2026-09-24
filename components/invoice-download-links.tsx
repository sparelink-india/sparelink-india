/**
 * Firm-scoped tax invoice download links.
 * Multi-firm orders must never share one combined invoice URL.
 */

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
  /** Label for single-firm / unknown-allocation case. */
  singleLabel?: string;
  /** Prefix before firm name when multiple invoices are listed. */
  multiLabelPrefix?: string;
};

export function InvoiceDownloadLinks({
  orderId,
  allocations,
  className,
  linkClassName,
  singleLabel = "Download PDF",
  multiLabelPrefix = "Invoice",
}: InvoiceDownloadLinksProps) {
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
        {singleLabel}
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
          title={`Tax invoice for ${allocation.firmName}`}
        >
          {multiLabelPrefix} - {allocation.firmName}
        </a>
      ))}
    </div>
  );
}
