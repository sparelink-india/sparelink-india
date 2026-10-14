/**
 * Intra-state vs inter-state GST determination.
 *
 * WHY THIS EXISTS
 * The codebase computed a single, undifferentiated GST amount. An Indian tax
 * invoice must present it as CGST + SGST for an intra-state supply and as IGST
 * for an inter-state supply, so a single line was not a compliant presentation
 * even though the arithmetic total was correct.
 *
 * DATA HONESTY
 * The split is only shown when it can be determined from real data:
 *
 *   - the supplier's state code (`firm.stateCode` / `firm.gstin` prefix), and
 *   - the place of supply (`order.placeOfSupplyCode`, from the shipping state).
 *
 * When either is unknown we return `mode: "undivided"`, and the invoice prints
 * a single GST line labelled as such. We never guess a state, because a wrong
 * CGST/SGST/IGST split is a filing error, not a cosmetic one.
 *
 * All money stays in integer paise. The half-rounding rule below matches the
 * convention used for tax tables: CGST is the rounded half and SGST takes the
 * remainder, so the two always sum back to the original amount exactly.
 */

export type GstSplitMode = "intra_state" | "inter_state" | "undivided";

export type GstSplit = {
  mode: GstSplitMode;
  /** Present only when mode is intra_state or inter_state. */
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  /** Human-readable explanation, used on the invoice and in admin views. */
  placeOfSupply: string;
};

/**
 * Canonical GSTIN shape, identical to the one `lib/gst.ts` enforces:
 * 2 state digits, 5 letters, 4 digits, 1 letter, 1 non-zero entity code, Z,
 * and 1 checksum character.
 */
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Extract the two-digit state code embedded in the first two characters of a
 * GSTIN. Returns null for a malformed or absent GSTIN rather than guessing.
 */
export function stateCodeFromGstin(
  gstin: string | null | undefined,
): string | null {
  if (!gstin) return null;
  const value = gstin.trim().toUpperCase();
  if (!GSTIN_PATTERN.test(value)) return null;
  return value.slice(0, 2);
}

/**
 * Best-effort mapping from a free-text state name to its GST state code.
 *
 * Returns null when the text is not recognisably a state, so the caller can
 * fall back to the undivided presentation rather than mis-labelling.
 */
const STATE_NAME_TO_CODE: Readonly<Record<string, string>> = {
  "andaman and nicobar islands": "35",
  "andhra pradesh": "37",
  "arunachal pradesh": "12",
  assam: "18",
  bihar: "10",
  chandigarh: "04",
  chhattisgarh: "22",
  "dadra and nagar haveli and daman and diu": "26",
  "daman and diu": "26",
  delhi: "07",
  goa: "30",
  gujarat: "24",
  haryana: "06",
  "himachal pradesh": "02",
  "jammu and kashmir": "01",
  jharkhand: "20",
  karnataka: "29",
  kerala: "32",
  ladakh: "38",
  "lakshadweep islands": "31",
  "madhya pradesh": "23",
  maharashtra: "27",
  manipur: "14",
  meghalaya: "01",
  mizoram: "15",
  nagaland: "13",
  odisha: "21",
  puducherry: "34",
  punjab: "03",
  rajasthan: "08",
  sikkim: "11",
  "tamil nadu": "33",
  telangana: "36",
  "tripura": "16",
  "uttar pradesh": "09",
  uttarakhand: "05",
  "west bengal": "19",
};

export function stateCodeFromName(
  name: string | null | undefined,
): string | null {
  if (!name) return null;
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return null;
  return STATE_NAME_TO_CODE[key] ?? null;
}

export type ResolveGstSplitInput = {
  /** Total GST for the line, in paise. */
  gstPaise: number;
  /** Supplier state code, from firm.stateCode or the firm GSTIN prefix. */
  supplierStateCode: string | null | undefined;
  /** Place of supply state code, from the order snapshot. */
  placeOfSupplyCode: string | null | undefined;
  /** Free-text place of supply, used only for display. */
  placeOfSupplyName?: string | null;
};

/**
 * Decide how to present a GST amount.
 *
 * Never throws and never invents a state: an unknown supplier or destination
 * yields the undivided presentation, which is honest.
 */
export function resolveGstSplit(input: ResolveGstSplitInput): GstSplit {
  const gstPaise = Math.max(0, Math.round(input.gstPaise || 0));

  const supplier = input.supplierStateCode?.trim() || null;
  const destination = input.placeOfSupplyCode?.trim() || null;
  const placeName = input.placeOfSupplyName?.trim() || null;

  if (!supplier || !destination) {
    return {
      mode: "undivided",
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      placeOfSupply: placeName ?? "As per delivery address",
    };
  }

  if (supplier === destination) {
    // CGST takes the rounded half so the pair sums back to gstPaise exactly.
    const cgstPaise = Math.round(gstPaise / 2);
    return {
      mode: "intra_state",
      cgstPaise,
      sgstPaise: gstPaise - cgstPaise,
      igstPaise: 0,
      placeOfSupply: placeName ?? `State ${destination}`,
    };
  }

  return {
    mode: "inter_state",
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: gstPaise,
    placeOfSupply: placeName ?? `State ${destination}`,
  };
}

/**
 * Per-rate aggregation for an invoice.
 *
 * GST is charged per rate band, so the split must be presented per rate and
 * not once for the invoice total.
 */
export type RateBand = {
  gstRate: number;
  basePaise: number;
  gstPaise: number;
};

export type RateBandBreakup = {
  mode: GstSplitMode;
  gstRate: number;
  basePaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  /** Column label for the tax amount, matching the invoice line. */
  taxLabel: string;
};

export function buildRateBandBreakups(input: {
  bands: readonly RateBand[];
  supplierStateCode: string | null | undefined;
  placeOfSupplyCode: string | null | undefined;
  placeOfSupplyName?: string | null;
}): RateBandBreakup[] {
  return input.bands
    .filter((band) => band.basePaise > 0 || band.gstPaise > 0)
    .sort((left, right) => left.gstRate - right.gstRate)
    .map((band) => {
      const split = resolveGstSplit({
        gstPaise: band.gstPaise,
        supplierStateCode: input.supplierStateCode,
        placeOfSupplyCode: input.placeOfSupplyCode,
        placeOfSupplyName: input.placeOfSupplyName,
      });
      return {
        mode: split.mode,
        gstRate: band.gstRate,
        basePaise: band.basePaise,
        taxablePaise: band.basePaise,
        cgstPaise: split.cgstPaise,
        sgstPaise: split.sgstPaise,
        igstPaise: split.igstPaise,
        taxLabel:
          split.mode === "intra_state"
            ? "CGST / SGST"
            : split.mode === "inter_state"
              ? "IGST"
              : "GST",
      };
    });
}

/** Round-off, so the printed grand total equals the sum of printed lines. */
export function computeRoundOff(
  sumOfLinesPaise: number,
  grandTotalPaise: number,
): number {
  return Math.round(grandTotalPaise) - Math.round(sumOfLinesPaise);
}