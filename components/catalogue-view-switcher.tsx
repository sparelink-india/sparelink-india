"use client";

import { useI18n } from "@/components/preferences-provider";
import {
  CATALOGUE_VIEW_MODES,
  type CatalogueViewMode,
} from "@/lib/catalogue-view";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * GRID / TILES / LIST / DETAILED switcher for any catalogue listing.
 *
 * Implemented as a radio group rather than four buttons: the four modes are
 * mutually exclusive, and `role="radiogroup"` with `aria-checked` is what a
 * screen reader needs to say "one of four, currently the second". Arrow-key
 * navigation and Home/End come free from the native radio inputs, which are
 * visually hidden but still focusable, so keyboard support does not need to be
 * re-implemented.
 *
 * No random colours: every surface here uses the existing V3 tokens
 * (`--v3-brand`, `--v3-rule`, `--v3-sunk`, `--v3-text-*`), so the switcher sits
 * beside the sort control without looking like it was added later.
 *
 * It wraps rather than scrolls, so it cannot introduce horizontal overflow on a
 * narrow phone.
 */

const LABEL_KEY: Record<CatalogueViewMode, MessageKey> = {
  grid: "search.gridView",
  tiles: "search.tilesView",
  list: "search.listView",
  detailed: "search.detailedView",
};

function ViewIcon({ mode, className = "h-4 w-4" }: { mode: CatalogueViewMode; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    "aria-hidden": true,
  } as const;

  if (mode === "grid") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7.5" height="7.5" rx="1" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="1" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="1" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1" />
      </svg>
    );
  }
  if (mode === "tiles") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="5" height="5" rx="1" />
        <rect x="9.5" y="3" width="5" height="5" rx="1" />
        <rect x="16" y="3" width="5" height="5" rx="1" />
        <rect x="3" y="9.5" width="5" height="5" rx="1" />
        <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
        <rect x="16" y="9.5" width="5" height="5" rx="1" />
        <rect x="3" y="16" width="5" height="5" rx="1" />
        <rect x="9.5" y="16" width="5" height="5" rx="1" />
        <rect x="16" y="16" width="5" height="5" rx="1" />
      </svg>
    );
  }
  if (mode === "list") {
    return (
      <svg {...common}>
        <path d="M8 6h13M8 12h13M8 18h13" strokeLinecap="round" />
        <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" strokeLinecap="round" strokeWidth="2.4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M7 6.5h.01M10 6.5h.01" strokeLinecap="round" />
      <path d="M7 13h6M7 16.5h10" strokeLinecap="round" />
    </svg>
  );
}

export function CatalogueViewSwitcher({
  value,
  onChange,
  className = "",
}: {
  value: CatalogueViewMode;
  onChange: (mode: CatalogueViewMode) => void;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <div
      role="radiogroup"
      aria-label={t("search.viewModeLabel")}
      className={`flex flex-wrap items-center gap-1 ${className}`}
    >
      {CATALOGUE_VIEW_MODES.map((mode) => {
        const active = mode === value;
        const label = t(LABEL_KEY[mode]);
        return (
          <label
            key={mode}
            title={label}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[2px] border px-2 py-1.5 text-xs font-semibold transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--v3-brand)] ${
              active
                ? "border-[var(--v3-brand)] bg-[var(--v3-brand)] text-white"
                : "border-[var(--v3-rule)] bg-white text-[var(--v3-text-2)] hover:bg-[var(--v3-sunk)]"
            }`}
          >
            <input
              type="radio"
              name="catalogue-view"
              value={mode}
              checked={active}
              onChange={() => onChange(mode)}
              className="sr-only"
            />
            <ViewIcon mode={mode} className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sr-only sm:hidden">{label}</span>
          </label>
        );
      })}
    </div>
  );
}
