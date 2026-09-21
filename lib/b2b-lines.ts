/**
 * Phase 6 B2B line pricing helpers.
 * Prices are GST-inclusive; server owns all totals.
 */

export type InclusiveLineInput = {
  unitInclusivePaise: number;
  quantity: number;
  gstRate: number;
};

export type InclusiveLineResult = {
  unitInclusivePaise: number;
  quantity: number;
  gstRate: number;
  lineTotalPaise: number;
  lineGstPaise: number;
  lineTaxablePaise: number;
};

export type DocumentLineTotals = {
  lineTotalPaise: number;
  lineGstPaise: number;
};

const MONEY_FIELDS = [
  "pricePaise",
  "unitPricePaise",
  "unitCostPaise",
  "listPricePaise",
  "listInclusivePaise",
  "netInclusivePaise",
  "mrpPaise",
  "dlpPaise",
  "gstRate",
  "gstPaise",
  "lineGstPaise",
  "lineTotalPaise",
  "subtotalPaise",
  "totalPaise",
  "amountPaise",
] as const;

/** GST-inclusive line: gst = total - total / (1 + rate/100). */
export function computeInclusiveLine({
  unitInclusivePaise,
  quantity,
  gstRate,
}: InclusiveLineInput): InclusiveLineResult {
  const unit = Math.max(0, Math.round(Number(unitInclusivePaise) || 0));
  const qty =
    Number.isInteger(quantity) && quantity > 0 ? quantity : 0;
  const rate =
    typeof gstRate === "number" &&
    Number.isFinite(gstRate) &&
    gstRate >= 0 &&
    gstRate <= 100
      ? Math.round(gstRate)
      : 18;
  const lineTotalPaise = unit * qty;
  const lineTaxablePaise = Math.round((lineTotalPaise * 100) / (100 + rate));
  const lineGstPaise = lineTotalPaise - lineTaxablePaise;
  return {
    unitInclusivePaise: unit,
    quantity: qty,
    gstRate: rate,
    lineTotalPaise,
    lineGstPaise,
    lineTaxablePaise,
  };
}

export function sumDocumentTotals(lines: DocumentLineTotals[]) {
  let totalPaise = 0;
  let gstPaise = 0;
  for (const line of lines) {
    totalPaise += Math.max(0, Math.round(line.lineTotalPaise || 0));
    gstPaise += Math.max(0, Math.round(line.lineGstPaise || 0));
  }
  const subtotalPaise = totalPaise - gstPaise;
  return { subtotalPaise, gstPaise, totalPaise };
}

/** Strip client-supplied money fields. Line firm/part come from DB listings. */
export function stripClientMoneyFields<T extends Record<string, unknown>>(
  body: T,
): T {
  const next = { ...body };
  for (const key of MONEY_FIELDS) {
    delete next[key];
  }
  return next;
}

export function nextB2bDocNumber(prefix: string): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

export function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ];
  return lines.join("\r\n") + "\r\n";
}
