export type IntentGroup = {
  key: string;
  synonyms: string[];
  kind: "context" | "product";
};

export type SearchIntent = {
  originalQuery: string;
  typesenseQuery: string;
  groups: IntentGroup[];
  isPartNumberQuery: boolean;
  hasProductIntent: boolean;
};

const PART_NUMBER_QUERY =
  /^[0-9A-Za-z][0-9A-Za-z.,/_-]{0,32}$/;

const EXPANSIONS: Record<string, { synonyms: string[]; kind: IntentGroup["kind"] }> = {
  wr: { synonyms: ["window regulator", "wr"], kind: "product" },
  assy: { synonyms: ["assy", "assembly"], kind: "product" },
  lh: { synonyms: ["lh", "left hand"], kind: "product" },
  rh: { synonyms: ["rh", "right hand"], kind: "product" },
  fr: { synonyms: ["front", "fr"], kind: "product" },
  frt: { synonyms: ["front", "frt"], kind: "product" },
  rr: { synonyms: ["rear", "rr"], kind: "product" },
};

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[.]/g, " ")
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function looksLikePartNumberQuery(query: string): boolean {
  const trimmed = query.trim();
  return PART_NUMBER_QUERY.test(trimmed) && /\d/.test(trimmed);
}

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasWholeToken(haystack: string, token: string): boolean {
  const needle = normalizeSearchText(token);
  if (!needle) return false;
  if (needle.includes(" ")) return ` ${haystack} `.includes(` ${needle} `);
  return new RegExp(`(?:^|\\s)${needle}(?:\\s|$)`).test(haystack);
}

function groupMatches(haystack: string, group: IntentGroup): boolean {
  return group.synonyms.some((synonym) => hasWholeToken(haystack, synonym));
}

export function parseSearchIntent(query: string): SearchIntent {
  const originalQuery = query.trim();
  if (looksLikePartNumberQuery(originalQuery)) {
    return {
      originalQuery,
      typesenseQuery: originalQuery,
      groups: [],
      isPartNumberQuery: true,
      hasProductIntent: false,
    };
  }

  const tokens = tokenize(originalQuery);
  const groups: IntentGroup[] = [];
  const typesenseParts: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const expansion = EXPANSIONS[token];
    if (expansion) {
      const key = expansion.synonyms[0];
      if (!seen.has(key)) {
        seen.add(key);
        groups.push({
          key,
          synonyms: expansion.synonyms,
          kind: expansion.kind,
        });
      }
      typesenseParts.push(expansion.synonyms[0] === "window regulator" ? "window regulator" : token);
      continue;
    }
    if (!seen.has(token)) {
      seen.add(token);
      groups.push({
        key: token,
        synonyms: [token],
        kind: "context",
      });
    }
    typesenseParts.push(token);
  }

  return {
    originalQuery,
    typesenseQuery: typesenseParts.join(" ").trim() || originalQuery,
    groups,
    isPartNumberQuery: false,
    hasProductIntent: groups.some((group) => group.kind === "product"),
  };
}

export type RankedDocument = {
  id?: string | null;
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  description?: string | null;
  part_number?: string | null;
};

export type IntentScore = {
  score: number;
  matchedGroups: number;
  matchedProductGroups: number;
  totalGroups: number;
  totalProductGroups: number;
  strict: boolean;
};

export function scoreSearchDocument(
  intent: SearchIntent,
  document: RankedDocument,
): IntentScore {
  const titleHaystack = normalizeSearchText(
    [document.name, document.brand, document.category, document.part_number]
      .filter(Boolean)
      .join(" "),
  );
  const descriptionHaystack = normalizeSearchText(document.description || "");
  const productGroups = intent.groups.filter((group) => group.kind === "product");
  let score = 0;
  let matchedGroups = 0;
  let matchedProductGroups = 0;

  for (const group of intent.groups) {
    const inTitle = groupMatches(titleHaystack, group);
    const inDescription = !inTitle && groupMatches(descriptionHaystack, group);
    if (inTitle || inDescription) {
      matchedGroups += 1;
      if (group.kind === "product") matchedProductGroups += 1;
      score += inTitle
        ? group.kind === "product"
          ? 80
          : 18
        : group.kind === "product"
          ? 12
          : 4;
    }
  }

  const strict =
    intent.groups.length > 0 &&
    matchedGroups === intent.groups.length &&
    productGroups.every((group) => groupMatches(titleHaystack, group));

  if (strict) score += 100;

  return {
    score,
    matchedGroups,
    matchedProductGroups,
    totalGroups: intent.groups.length,
    totalProductGroups: productGroups.length,
    strict,
  };
}

export function filterAutocompleteHits<T>(
  intent: SearchIntent,
  hits: T[],
  getDocument: (hit: T) => RankedDocument,
  limit = 12,
): T[] {
  if (!hits.length) return [];
  if (intent.isPartNumberQuery || intent.groups.length === 0) {
    return hits.slice(0, limit);
  }

  const ranked = hits
    .map((hit) => ({ hit, ...scoreSearchDocument(intent, getDocument(hit)) }))
    .sort((left, right) => right.score - left.score);

  const strictHits = ranked.filter((row) => row.strict);
  if (strictHits.length) {
    return strictHits.slice(0, limit).map((row) => row.hit);
  }

  if (intent.hasProductIntent) {
    const productHits = ranked.filter(
      (row) => row.matchedProductGroups === row.totalProductGroups && row.totalProductGroups > 0,
    );
    if (productHits.length) {
      return productHits.slice(0, limit).map((row) => row.hit);
    }
    const anyIntent = ranked.filter((row) => row.matchedProductGroups > 0);
    if (anyIntent.length) {
      return anyIntent.slice(0, limit).map((row) => row.hit);
    }
  }

  const contextComplete = ranked.filter(
    (row) => row.matchedGroups === row.totalGroups && row.totalGroups > 0,
  );
  if (contextComplete.length) {
    return contextComplete.slice(0, limit).map((row) => row.hit);
  }

  return ranked.slice(0, limit).map((row) => row.hit);
}

export function rankSearchHits<T>(
  intent: SearchIntent,
  hits: T[],
  getDocument: (hit: T) => RankedDocument,
): T[] {
  if (intent.isPartNumberQuery || intent.groups.length === 0) return hits;
  return [...hits].sort((left, right) => {
    const leftScore = scoreSearchDocument(intent, getDocument(left)).score;
    const rightScore = scoreSearchDocument(intent, getDocument(right)).score;
    return rightScore - leftScore;
  });
}
