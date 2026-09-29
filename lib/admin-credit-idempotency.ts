/**
 * Idempotency keys for admin ledger entries.
 *
 * Why this exists
 * ---------------
 * `app/api/admin/credit` already honours `idempotencyKey`: the same key is
 * stored against the ledger row and a repeat returns the existing entry with
 * `created: false` instead of writing a second one. The admin page was building
 * its key with `Date.now()`, which made every click unique and therefore
 * defeated that protection entirely - a double click, or a retry after a
 * network timeout, could post the same entry twice.
 *
 * The rule
 * --------
 * A key must be STABLE for the same user action, and must CHANGE when the user
 * genuinely means something different. So the key is derived from the content
 * of the entry (dealer, type, amount, notes) plus a submission nonce:
 *
 *  - a double click sends byte-identical content and the same nonce, so the
 *    key repeats and the server returns the original entry
 *  - editing any field changes the key, because the user means something new
 *  - the nonce only resets after a successful post, so the admin can
 *    deliberately post the same amount and notes again
 *
 * The nonce is supplied by the caller (a ref in the page). It is never derived
 * from the clock, so two submissions in the same millisecond still collide
 * correctly.
 */

export type LedgerEntryIntent = {
  dealerId: string;
  entryType: string;
  /** Amount in paise. */
  amountPaise: number;
  /** Signed amount, only meaningful for adjustments. */
  signedAmountPaise?: number;
  notes?: string | null;
  /** Submission counter supplied by the caller. */
  nonce: number;
};

/**
 * Normalise free text so trivial whitespace or casing differences do not create
 * a second ledger entry, while a genuinely different note still does.
 */
export function normaliseNote(note: string | null | undefined): string {
  return (note ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Paise are integers; render them without locale or float noise. */
function normaliseAmount(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "0";
  return String(Math.trunc(value));
}

export function buildLedgerIdempotencyKey(intent: LedgerEntryIntent): string {
  const dealer = intent.dealerId.trim();
  if (!dealer) {
    throw new Error("A dealer must be selected before posting a ledger entry.");
  }
  const entryType = intent.entryType.trim().toLowerCase();
  if (!entryType) {
    throw new Error("A ledger entry type is required.");
  }

  const parts = [
    "admin",
    dealer,
    entryType,
    normaliseAmount(intent.amountPaise),
    normaliseNote(intent.notes),
    String(Math.max(0, Math.trunc(intent.nonce ?? 0))),
  ];

  // An adjustment's signed amount is what actually moves the ledger, so it must
  // participate in the key.
  if (entryType === "adjustment") {
    parts.splice(4, 0, normaliseAmount(intent.signedAmountPaise ?? intent.amountPaise));
  }

  return parts.join(":");
}
