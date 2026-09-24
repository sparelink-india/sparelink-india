/**
 * Canonical internal fulfillment firms for SpareLink India.
 * These are the ONLY firms allowed for listing assignment and order allocation.
 */

export type SpareLinkFirmCode = "AMB" | "HIN" | "IND";

export type SpareLinkFirm = {
  id: string;
  code: SpareLinkFirmCode;
  name: string;
};

export const SPARELINK_FIRMS: readonly SpareLinkFirm[] = [
  {
    id: "firm-ambaji-traders",
    code: "AMB",
    name: "Ambaji Traders",
  },
  {
    id: "firm-hind-motors",
    code: "HIN",
    name: "Hind Motors",
  },
  {
    id: "firm-india-sales",
    code: "IND",
    name: "India Sales",
  },
] as const;

export const ALLOWED_FIRM_IDS: ReadonlySet<string> = new Set(
  SPARELINK_FIRMS.map((firm) => firm.id),
);

export const ALLOWED_FIRM_CODES: ReadonlySet<string> = new Set(
  SPARELINK_FIRMS.map((firm) => firm.code),
);

/** True when firmId is one of the three internal firm IDs. */
export function isAllowedFirmId(firmId: string): boolean {
  return ALLOWED_FIRM_IDS.has(firmId);
}

/**
 * Admin listing assignment: null unassigns; otherwise must be an allowed firm.
 * Empty string is treated as invalid (not null).
 */
export function isAssignableFirmId(
  firmId: string | null,
): firmId is string | null {
  if (firmId === null) return true;
  return typeof firmId === "string" && isAllowedFirmId(firmId);
}

export const AMBAJI_TRADERS_FIRM_ID = "firm-ambaji-traders";
export const HIND_MOTORS_FIRM_ID = "firm-hind-motors";
export const INDIA_SALES_FIRM_ID = "firm-india-sales";

/**
 * Per-firm payment capabilities for COD + future independent Cashfree merchants.
 * No Easy Split. Cashfree credentials stay in env and are not invented here.
 */
export type FirmOnlinePaymentCapability = "cashfree" | "coming_soon";

export type FirmPaymentCapability = {
  firmId: string;
  firmName: string;
  cod: true;
  online: FirmOnlinePaymentCapability;
};

export const FIRM_PAYMENT_CAPABILITIES: readonly FirmPaymentCapability[] = [
  {
    firmId: AMBAJI_TRADERS_FIRM_ID,
    firmName: "Ambaji Traders",
    cod: true,
    online: "cashfree",
  },
  {
    firmId: HIND_MOTORS_FIRM_ID,
    firmName: "Hind Motors",
    cod: true,
    online: "coming_soon",
  },
  {
    firmId: INDIA_SALES_FIRM_ID,
    firmName: "India Sales",
    cod: true,
    online: "coming_soon",
  },
] as const;

export function getFirmPaymentCapability(
  firmId: string,
): FirmPaymentCapability | null {
  if (!isAllowedFirmId(firmId)) return null;
  return (
    FIRM_PAYMENT_CAPABILITIES.find((item) => item.firmId === firmId) ?? null
  );
}

export type ParentPaymentMethod =
  | "cash_on_delivery"
  | "bank_transfer"
  | "online_payment";

export type AllocationPaymentMethod =
  | "cash_on_delivery"
  | "bank_transfer"
  | "online_payment"
  | "online_coming_soon";

/**
 * Parent checkout order may use `online_payment` only when every firm in the
 * cart can take Cashfree on its own merchant account. Mixed carts with any
 * unconfigured firm must use COD or bank transfer — no Easy Split / cross-firm charge.
 */
export function cartSupportsParentOnlinePayment(
  cartFirmIds: readonly string[],
  isFirmOnlineCapable: (firmId: string) => boolean,
): boolean {
  if (cartFirmIds.length === 0) return false;
  return cartFirmIds.every((firmId) => isFirmOnlineCapable(firmId));
}

/**
 * Map the customer's parent payment choice onto one firm allocation.
 * Online checkout only lands on Ambaji when that firm can take Cashfree later.
 * Hind Motors and India Sales stay COD (online coming soon).
 */
export function resolveAllocationPaymentMethod(
  parentPaymentMethod: ParentPaymentMethod,
  firmId: string,
): AllocationPaymentMethod {
  const capability = getFirmPaymentCapability(firmId);
  if (!capability) {
    return "cash_on_delivery";
  }
  if (parentPaymentMethod === "bank_transfer") {
    return "bank_transfer";
  }
  if (parentPaymentMethod === "online_payment") {
    return capability.online === "cashfree"
      ? "online_payment"
      : "online_coming_soon";
  }
  return "cash_on_delivery";
}

/**
 * Seller identity for tax invoices. Reads firm table fields first; optional
 * env overlays (`AMBAJI_TRADERS_GSTIN`, `HIND_MOTORS_GSTIN`, `INDIA_SALES_GSTIN`,
 * and matching `*_LEGAL_NAME` / `*_ADDRESS` / `*_PHONE` / `*_EMAIL`) follow the
 * same per-firm prefix pattern as bank payment config. Never invents GSTINs.
 */
export type FirmSellerProfile = {
  firmId: string;
  firmCode: string;
  displayName: string;
  legalName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
};

function firmSellerEnvPrefix(
  firmName: string,
  firmCode?: string | null,
): "AMBAJI_TRADERS" | "HIND_MOTORS" | "INDIA_SALES" | null {
  const normalizedName = firmName.trim().toLowerCase();
  const normalizedCode = firmCode?.trim().toUpperCase();
  if (normalizedName === "ambaji traders" || normalizedCode === "AMB") {
    return "AMBAJI_TRADERS";
  }
  if (normalizedName === "hind motors" || normalizedCode === "HIN") {
    return "HIND_MOTORS";
  }
  if (normalizedName === "india sales" || normalizedCode === "IND") {
    return "INDIA_SALES";
  }
  return null;
}

function readOptionalEnv(key: string): string | null {
  const value = process.env[key]?.trim();
  return value ? value : null;
}

export function resolveFirmSellerProfile(firm: {
  id: string;
  name: string;
  code: string;
  legalName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
}): FirmSellerProfile {
  const prefix = firmSellerEnvPrefix(firm.name, firm.code);
  const envLegalName = prefix ? readOptionalEnv(`${prefix}_LEGAL_NAME`) : null;
  const envAddress = prefix ? readOptionalEnv(`${prefix}_ADDRESS`) : null;
  const envPhone = prefix ? readOptionalEnv(`${prefix}_PHONE`) : null;
  const envEmail = prefix ? readOptionalEnv(`${prefix}_EMAIL`) : null;
  const envGstin = prefix ? readOptionalEnv(`${prefix}_GSTIN`) : null;

  const gstinRaw = (firm.gstin?.trim() || envGstin || null)?.toUpperCase() ?? null;

  return {
    firmId: firm.id,
    firmCode: firm.code,
    displayName: firm.name,
    legalName: firm.legalName?.trim() || envLegalName || firm.name,
    address: firm.address?.trim() || envAddress,
    phone: firm.phone?.trim() || envPhone,
    email: firm.email?.trim() || envEmail,
    gstin: gstinRaw,
  };
}
