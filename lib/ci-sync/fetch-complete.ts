/**
 * Decide whether a CI catalogue fetch was complete enough to allow
 * SOURCE_REMOVED diffs. Never treat a partial page as complete.
 */
export function evaluateCiFetchCompleteness(input: {
  productsMapped: number;
  total: number | null;
  pagesFetched: number;
  hitMaxPages: boolean;
  lastPageEmpty: boolean;
  hasMore: boolean | null;
}): { fetchComplete: boolean; errorSummary: string | null } {
  const {
    productsMapped,
    total,
    pagesFetched,
    hitMaxPages,
    lastPageEmpty,
    hasMore,
  } = input;

  if (pagesFetched === 0) {
    return {
      fetchComplete: false,
      errorSummary: "CI source returned no pages",
    };
  }

  if (total != null && total > 0 && productsMapped === 0) {
    return {
      fetchComplete: false,
      errorSummary: "CI source returned empty catalogue while total > 0",
    };
  }

  // Hit the safety page cap while more data was still expected.
  if (hitMaxPages && (hasMore === true || (total != null && productsMapped < total))) {
    return {
      fetchComplete: false,
      errorSummary: `CI source pagination stopped at max pages with incomplete catalogue (${productsMapped}${total != null ? `/${total}` : ""})`,
    };
  }

  const endedCleanly =
    lastPageEmpty || hasMore === false || (total != null && productsMapped >= total);

  if (!endedCleanly) {
    return {
      fetchComplete: false,
      errorSummary: `CI source catalogue appears truncated (${productsMapped}${total != null ? `/${total}` : ""} products)`,
    };
  }

  if (total != null && productsMapped < total) {
    return {
      fetchComplete: false,
      errorSummary: `CI source undercount: mapped ${productsMapped} of claimed ${total}`,
    };
  }

  if (productsMapped === 0) {
    // Empty catalogue with total 0 / unknown — complete, no removals of "missing" SKUs
    // would still be wrong if existing rows exist; callers only remove when complete.
    // An intentionally empty source with total=0 is complete.
    return { fetchComplete: true, errorSummary: null };
  }

  return { fetchComplete: true, errorSummary: null };
}
