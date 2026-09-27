import { splitHighlight } from "@/lib/search-highlight";

export function SearchHighlight({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  return (
    <>
      {splitHighlight(text, query).map((part, index) =>
        part.match ? (
          <mark
            key={`${part.text}-${index}`}
            className="rounded-sm bg-[var(--sl-primary)]/15 px-0.5 font-semibold text-inherit"
          >
            {part.text}
          </mark>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        ),
      )}
    </>
  );
}
