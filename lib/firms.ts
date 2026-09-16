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
