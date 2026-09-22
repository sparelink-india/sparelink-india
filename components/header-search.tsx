"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { useI18n } from "@/components/preferences-provider";

type Suggestion = {
  id: string;
  name: string;
  partNumber: string;
  brand: string;
};

export type HeaderSearchProductPick = {
  id: string;
  partNumber: string;
};

function SearchIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.2-5.2m1.2-4.3a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
    </svg>
  );
}

export function HeaderSearchField({
  value,
  onChange,
  onSubmitSearch,
  onSelectProduct,
  searchLoading,
  committedQuery = "",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmitSearch: (nextQuery?: string) => void;
  onSelectProduct?: (item: HeaderSearchProductPick) => void;
  searchLoading: boolean;
  committedQuery?: string;
}) {
  const { t } = useI18n();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const dismissGenRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  function closeDropdown() {
    dismissGenRef.current += 1;
    setOpen(false);
    setActiveIndex(-1);
    setSuggesting(false);
    setSuggestions([]);
  }

  useLayoutEffect(() => {
    if (searchLoading || value.trim() === committedQuery.trim()) {
      setOpen(false);
      setActiveIndex(-1);
    }
  }, [committedQuery, searchLoading, value]);

  useEffect(() => {
    const q = value.trim();
    if (searchLoading || q.length < 2 || q === committedQuery.trim()) {
      return;
    }

    const gen = dismissGenRef.current;
    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      if (gen !== dismissGenRef.current) return;
      setSuggesting(true);
      void fetch(
        `/api/search/parts?q=${encodeURIComponent(q)}&page=1&perPage=12&suggest=1`,
        { signal: controller.signal, cache: "no-store" },
      )
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (gen !== dismissGenRef.current) return;
          const rows: Suggestion[] = Array.isArray(data?.results)
            ? data.results.map((hit: { document?: Record<string, string> }, index: number) => {
                const doc = hit.document ?? {};
                return {
                  id: String(doc.id || doc.part_number || index),
                  name: String(doc.name || t("product.partFallback")),
                  partNumber: String(doc.part_number || ""),
                  brand: String(doc.brand || ""),
                };
              })
            : [];
          setSuggestions(rows);
          setActiveIndex(-1);
          setOpen(rows.length > 0);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (gen !== dismissGenRef.current) return;
          setSuggestions([]);
        })
        .finally(() => {
          if (gen === dismissGenRef.current) setSuggesting(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [committedQuery, searchLoading, t, value]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function chooseSuggestion(item: Suggestion) {
    closeDropdown();
    if (onSelectProduct) {
      onSelectProduct({ id: item.id, partNumber: item.partNumber });
      return;
    }
    const next = item.partNumber || item.name;
    onChange(next);
    onSubmitSearch(next);
  }

  function submitForm() {
    closeDropdown();
    onSubmitSearch(value.trim());
  }

  const canSuggest = value.trim().length >= 2;
  const suppressSuggest =
    searchLoading || value.trim() === committedQuery.trim();
  const showDropdown =
    open &&
    canSuggest &&
    !suppressSuggest &&
    (suggestions.length > 0 || suggesting);

  return (
    <div ref={rootRef} className="relative min-w-0 w-full">
      <form
        className="flex h-11 min-w-0 w-full overflow-hidden rounded-md border border-slate-300 bg-white md:h-12"
        onSubmit={(event) => {
          event.preventDefault();
          submitForm();
        }}
      >
        <input
          type="search"
          value={value}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length && !suppressSuggest) setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitForm();
              return;
            }
            if (event.key === "Escape") {
              closeDropdown();
              return;
            }
            if (!open || !suggestions.length) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => (index + 1) % suggestions.length);
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) =>
                index <= 0 ? suggestions.length - 1 : index - 1,
              );
            }
          }}
          placeholder={t("search.placeholderHeader")}
          className="h-full min-w-0 flex-1 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={searchLoading}
          className="inline-flex h-full shrink-0 items-center gap-1.5 bg-[#7a1233] px-4 text-sm font-bold text-white hover:bg-[#611029] disabled:opacity-60"
        >
          <SearchIcon />
          <span>{searchLoading ? t("nav.searching") : t("nav.search")}</span>
        </button>
      </form>

      {showDropdown ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-[min(420px,70vh)] overflow-y-auto overflow-x-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {suggesting && suggestions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">{t("search.searching")}</li>
          ) : null}
          {suggestions.map((item, index) => (
            <li key={`${item.id}-${index}`} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                className={`flex w-full min-w-0 flex-col px-3 py-2 text-left text-sm ${
                  index === activeIndex ? "bg-slate-100" : "hover:bg-slate-50"
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseSuggestion(item)}
              >
                <span className="truncate font-semibold text-slate-900">{item.name}</span>
                <span className="truncate text-xs text-slate-500">
                  {[item.brand, item.partNumber].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
