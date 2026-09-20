/** Customer-facing price display helpers. Does not invent or recalculate prices. */

export function isAuthoritativeSellingPricePaise(
  ...candidates: Array<number | null | undefined>
): boolean {
  return candidates.some(
    (value) => typeof value === "number" && Number.isFinite(value) && value > 0,
  );
}
