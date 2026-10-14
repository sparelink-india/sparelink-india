/**
 * Firm availability rules.
 *
 * WHY THIS EXISTS
 * `firm.isActive` existed in the schema and was read in exactly one place
 * (the admin firms list). Nothing enforced it, so a firm deactivated in the
 * database still accepted cart adds, order allocations, payments and invoices.
 * That is a three-firm integrity hole: an inactive firm must not be able to
 * take money or issue a tax invoice.
 *
 * HOW IT IS ENFORCED
 * A firm is orderable only when it is one of the three canonical IDs AND its
 * row is active. `isAssignableFirmId` is intentionally NOT changed: assigning
 * a firm to a listing is an admin act and must be allowed while the firm is
 * being configured. Orderability is the narrower, order-time concern handled
 * here.
 */

import { eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { ALLOWED_FIRM_IDS, isAllowedFirmId } from "@/lib/firms";
import { stateCodeFromGstin } from "@/lib/gst-split";
import { firm } from "@/drizzle/schema";

/** True when the id is a canonical firm AND that firm is active in the DB. */
export async function isFirmOrderable(
  firmId: string | null | undefined,
): Promise<boolean> {
  if (!firmId || !isAllowedFirmId(firmId)) return false;

  try {
    const db = getDb();
    const rows = await db
      .select({ isActive: firm.isActive })
      .from(firm)
      .where(eq(firm.id, firmId))
      .limit(1);
    const row = rows[0];
    // A missing row is treated as not orderable: fail closed rather than
    // accepting a firm we cannot prove is active.
    return row?.isActive === true;
  } catch {
    // If the lookup fails we must not silently allow the order. Report the firm
    // as unavailable and let the checkout surface a clear error.
    return false;
  }
}

/**
 * Filter to the subset of the given firm ids that are orderable.
 * Always returns a list; never throws.
 */
export async function orderableFirmIds(
  firmIds: ReadonlyArray<string | null | undefined>,
): Promise<string[]> {
  const candidates = [...new Set(firmIds.filter((id): id is string => Boolean(id)))];
  if (candidates.length === 0) return [];

  try {
    const db = getDb();
    const rows = await db
      .select({ id: firm.id })
      .from(firm)
      .where(inArray(firm.id, candidates));
    return rows.map((row) => row.id);
  } catch {
    return [];
  }
}

/**
 * Resolve each firm's GST state code, for CGST/SGST vs IGST determination.
 * Falls back to the GSTIN prefix when `firm.stateCode` is not populated.
 * Never throws: an unreachable database yields an empty map, which makes the
 * invoice fall back to an undivided GST line.
 */
export async function resolveFirmStateCodes(
  firmIds: readonly string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (firmIds.length === 0) return result;
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: firm.id,
        stateCode: firm.stateCode,
        gstin: firm.gstin,
      })
      .from(firm)
      .where(inArray(firm.id, [...firmIds]));
    for (const row of rows) {
      const code = row.stateCode?.trim() || stateCodeFromGstin(row.gstin);
      if (code) result.set(row.id, code);
    }
  } catch {
    return result;
  }
  return result;
}

export const CANONICAL_FIRM_IDS: readonly string[] = [...ALLOWED_FIRM_IDS];