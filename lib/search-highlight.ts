export type HighlightPart = {
  text: string;
  match: boolean;
};

export function splitHighlight(text: string, query: string): HighlightPart[] {
  const source = String(text || "");
  const needle = query.trim();
  if (!source || needle.length < 2) return [{ text: source, match: false }];
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(${escaped})`, "ig");
  const parts: HighlightPart[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((match = pattern.exec(source))) {
    const key = `${match.index}:${match[0]}`;
    if (seen.has(key)) break;
    seen.add(key);
    if (match.index > last) {
      parts.push({ text: source.slice(last, match.index), match: false });
    }
    parts.push({ text: match[0], match: true });
    last = match.index + match[0].length;
    if (pattern.lastIndex === match.index) pattern.lastIndex += 1;
  }
  if (last < source.length) parts.push({ text: source.slice(last), match: false });
  return parts.length ? parts : [{ text: source, match: false }];
}
