/**
 * GST Calculation Utilities for SpareLink India
 *
 * Implements line-item level GST rate extraction and authoritative paise-based calculations.
 */

/**
 * Extracts the GST rate percentage for a given part based on its database description or metadata.
 * Defaults to 18% (the standard automotive parts GST rate in India).
 *
 * Examples:
 * - "HSN: 87089900, GST: 18%" -> 18
 * - "GST 5%" -> 5
 * - "28% GST" -> 28
 */
export function extractGSTRate(description?: string | null): number {
  if (!description) {
    return 18;
  }

  // Look for "GST: 18%", "GST: 5%", "GST 18%", "18% GST", etc.
  const match =
    description.match(/GST[:\s]*(\d+(?:\.\d+)?)\s*%/i) ||
    description.match(/(\d+(?:\.\d+)?)\s*%\s*GST/i);

  if (match && match[1]) {
    const rate = parseFloat(match[1]);
    if (!isNaN(rate) && rate >= 0 && rate <= 100) {
      return rate;
    }
  }

  return 18;
}

export type LineItemGST = {
  pricePaise: number;
  quantity: number;
  gstRate: number;
  itemSubtotalPaise: number;
  itemGstPaise: number;
  itemTotalPaise: number;
};

/**
 * Calculates item-level subtotal and GST in paise.
 */
export function calculateLineItemGST(
  pricePaise: number,
  quantity: number,
  description?: string | null,
): LineItemGST {
  const gstRate = extractGSTRate(description);
  const itemSubtotalPaise = pricePaise * quantity;
  const itemGstPaise = Math.round((itemSubtotalPaise * gstRate) / 100);
  const itemTotalPaise = itemSubtotalPaise + itemGstPaise;

  return {
    pricePaise,
    quantity,
    gstRate,
    itemSubtotalPaise,
    itemGstPaise,
    itemTotalPaise,
  };
}

export type CartTaxBreakdown = {
  subtotalPaise: number;
  gstPaise: number;
  shippingPaise: number;
  totalPaise: number;
};

/**
 * Computes the aggregate subtotal, GST, shipping, and grand total in paise for a list of items.
 */
export function calculateCartTotals(
  items: Array<{
    pricePaise: number;
    quantity: number;
    partDescription?: string | null;
  }>,
  shippingPaise = 0,
): CartTaxBreakdown {
  let subtotalPaise = 0;
  let gstPaise = 0;

  for (const item of items) {
    const line = calculateLineItemGST(
      item.pricePaise,
      item.quantity,
      item.partDescription,
    );
    subtotalPaise += line.itemSubtotalPaise;
    gstPaise += line.itemGstPaise;
  }

  const totalPaise = subtotalPaise + gstPaise + shippingPaise;

  return {
    subtotalPaise,
    gstPaise,
    shippingPaise,
    totalPaise,
  };
}

export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (Old)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
};

/**
 * Validates the syntax of an Indian GSTIN (Goods and Services Tax Identification Number).
 * Format: 2 digits (State Code) + 5 chars (PAN entity) + 4 digits (PAN serial) + 1 char (PAN check) + 1 digit (entity number) + 'Z' + 1 checksum char.
 */
export function validateGSTIN(gstin?: string | null): {
  valid: boolean;
  stateCode?: string;
  stateName?: string;
  message: string;
  isSelfDeclared: boolean;
} {
  if (!gstin || !gstin.trim()) {
    return {
      valid: false,
      message: "GSTIN is empty",
      isSelfDeclared: true,
    };
  }

  const clean = gstin.trim().toUpperCase();
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  if (!gstRegex.test(clean)) {
    return {
      valid: false,
      message: "Invalid GSTIN format. Must be 15 alphanumeric characters (e.g. 24AAACR1234K1Z0).",
      isSelfDeclared: true,
    };
  }

  const stateCode = clean.slice(0, 2);
  const stateName = GST_STATE_CODES[stateCode] || "Unknown State";

  return {
    valid: true,
    stateCode,
    stateName,
    message: `Format Validated (State: ${stateName}) — Self-Declared`,
    isSelfDeclared: true,
  };
}
