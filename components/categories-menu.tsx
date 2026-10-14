"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/components/preferences-provider";
import { navGroupLabel } from "@/lib/category-nav-labels";
import type { NavGroup } from "@/lib/category-navigation";

/**
 * V3 catalogue category navigation.
 *
 * THE COMPOSITION CHANGED. V2 opened a 22rem panel whose groups were rows of
 * `uppercase tracking-wide` text on `hover:bg-slate-50` — a slate utility
 * dropdown. The group rows were uppercase 13px, which is the visual language of
 * a filter sidebar, not of a parts catalogue, and the children were indented
 * 24px with no rule or marker connecting them to their parent, so a two-level
 * catalogue read as one flat list of ~40 links.
 *
 * V3 is a two-column catalogue index:
 *
 *   A LEFT RAIL of the top-level groups. Each row carries a monospaced index
 *     (01, 02, …) and the group name in the V3 label role, on a hairline row.
 *     The selected group is marked with a 3px burgundy left rule — the same
 *     device used by the section headings and the category filter rail, so the
 *     three read as one system.
 *   A RIGHT PANEL listing that group's children as specification rows: the
 *     child name on the left, and a chevron on the right that only appears on
 *     hover, so the list stays quiet until it is used.
 *
 * A group with its own href keeps that link in the rail, and its children are
 * still one tap away — nothing is lost, and the panel is no longer a 40-item
 * scroll.
 *
 * The trigger previously rendered a corrupted, emoji-shaped glyph
 * (`\uFFFD~\uFFFD`). It is now a hand-drawn three-bar catalogue mark, which
 * also satisfies the "no emoji as UI icon" rule that the glyph broke.
 *
 * Behaviour is unchanged: the same `/api/catalogue/categories` request, the
 * same outside-click and Escape dismissal, the same `role="menu"` semantics
 * and the same links. That endpoint is only read.
 */

function GridGlyph() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="3" y="3" width="7.5" height="7.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 text-[var(--sl-ink-3)] transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function RowChevron() {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0 text-[var(--sl-rule-2)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--sl-brand)]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function CategoriesMenu() {
  const { t } = useI18n();
  const menuId = useId();
  /* One flyout exists at a time and every category row discloses it, so its id
     is derived from the menu's own id rather than minted separately. */
  const flyoutId = `${menuId}-flyout`;
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<NavGroup[]>([]);
  /*
   * TWO-STEP, so this starts empty and stays empty until a category is chosen.
   * It used to be seeded with the first group that had children, which meant the
   * subcategory panel was already open the moment "All Categories" was clicked -
   * the exact opposite of the intended step 1. Nothing is preselected now.
   */
  const [activeId, setActiveId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch("/api/catalogue/categories", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        /* Groups only. `activeId` is deliberately left null - see above. */
        setGroups(Array.isArray(data.groups) ? data.groups : []);
      })
      .catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const active = groups.find((g) => g.id === activeId) ?? null;
  /* Step 1 has no flyout, so the menu is only as wide as the rail. Without this
     the panel would keep its full width and the space to the right of the rail
     would be the empty rectangle this design is meant to avoid. */
  const hasFlyout = Boolean(active);

  return (
    <div ref={rootRef} className="relative w-full shrink-0 md:w-auto">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="sl-focus inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--sl-r)] border border-[var(--sl-brand)] bg-[var(--sl-brand)] px-3.5 text-[0.8125rem] font-bold text-white transition-colors hover:bg-[var(--sl-brand-hover)] md:w-auto"
      >
        <GridGlyph />
        {t("nav.categories")}
        <Chevron open={open} />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          /* Width follows state, and that is the point of the two-step design.
             With no category chosen the menu is exactly as wide as the rail
             (`md:w-[15rem]`), so step 1 shows the list and nothing else - no
             permanently visible second panel, no empty space. Choosing a
             category widens the menu to rail + flyout (`md:w-[40rem]`).

             `md:flex-row` places the flyout beside the rail; phones keep the
             column, so the mobile menu stays stacked: category list, then
             subcategories beneath. `md:items-start` lets the flyout take its own
             content height instead of being stretched to the rail's 26rem.
             Nothing here clips: the panel is absolutely positioned inside the
             relative trigger, and the nav no longer wraps this in an
             `overflow-x-auto` container. */
          className={`absolute left-0 right-0 z-50 mt-1 flex max-h-[min(80vh,calc(100dvh-6rem))] w-full flex-col overflow-hidden rounded-[var(--sl-r)] border border-[var(--sl-rule-2)] bg-[var(--sl-surface)] shadow-[var(--sl-e-3)] md:flex-row md:items-start md:right-auto ${
            hasFlyout ? "md:w-[40rem]" : "md:w-[15rem]"
          }`}
        >
          {groups.length === 0 ? (
            <p className="px-3 py-4 text-[0.8125rem] text-[var(--sl-ink-3)]">
              {t("categories.empty")}
            </p>
          ) : (
            <>
              {/* ---- LEFT RAIL: the group index. The right-hand divider is
                  drawn only when a flyout is actually open beside it, so step 1
                  has no dangling rule on the right edge. ---- */}
              <nav
                className={`max-h-[13rem] shrink-0 overflow-y-auto border-b border-[var(--sl-rule)] bg-[var(--sl-sunken)] p-1.5 md:max-h-[26rem] md:w-[15rem] md:shrink-0 ${
                  hasFlyout ? "md:border-b-0 md:border-r" : ""
                }`}
                aria-label={t("nav.categories")}
              >
                <ul className="space-y-px">
                  {groups.map((group, index) => {
                    const isActive = group.id === activeId;
                    const label = navGroupLabel(group, t);
                    return (
                      <li key={group.id}>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => setActiveId(group.id)}
                          aria-current={isActive ? "true" : undefined}
                          /* Disclosure semantics: this row owns the flyout, and
                             it is expanded only while it is the active one. They
                             are real <button>s, so Enter and Space already
                             activate them and `sl-focus` draws the focus ring. */
                          aria-expanded={isActive}
                          aria-controls={flyoutId}
                          className={`sl-focus flex min-h-10 w-full items-center gap-2.5 border-l-2 px-2.5 text-left transition-colors ${
                            isActive
                              ? "border-[var(--sl-brand)] bg-[var(--sl-surface)] font-bold text-[var(--sl-brand-ink)]"
                              : "border-transparent text-[var(--sl-ink-2)] hover:bg-[var(--sl-surface)]"
                          }`}
                        >
                          <span className="sl-partno w-5 shrink-0 !text-[0.625rem] !text-[var(--sl-ink-3)]">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="sl-metric-label sl-clamp-1 !text-[0.625rem]">
                            {label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {/* ---- STEP 2: the flyout. Rendered ONLY once a category has been
                  chosen, so opening the menu shows the rail alone. Its height
                  follows its content and it scrolls internally, so a 3-child
                  category stays compact and a 21-child one is contained. ---- */}
              {active ? (
                <div
                  id={flyoutId}
                  aria-label={navGroupLabel(active, t)}
                  className="min-h-0 max-h-[min(26rem,calc(100dvh-12rem))] flex-1 overflow-y-auto p-1.5"
                >
                  <p className="sl-metric-label px-2 py-2">
                    {navGroupLabel(active, t)}
                  </p>

                  {/* A group with its own landing page keeps it, so the
                      top-level category route stays reachable. */}
                  {active.href ? (
                    <Link
                      role="menuitem"
                      href={active.href}
                      onClick={() => setOpen(false)}
                      className="sl-focus group mb-1 flex min-h-11 items-center justify-between gap-2 border border-[var(--sl-brand-line)] bg-[var(--sl-brand-soft)] px-3 transition-colors hover:bg-[var(--sl-surface)]"
                    >
                      <span className="sl-nav font-bold text-[var(--sl-brand-ink)]">
                        {t("footer.allCategories")}
                      </span>
                      <RowChevron />
                    </Link>
                  ) : null}

                  <ul className="border-t border-[var(--sl-rule)]">
                    {active.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          role="menuitem"
                          href={child.href}
                          onClick={() => setOpen(false)}
                          className="sl-focus group flex min-h-11 items-center justify-between gap-2 border-b border-[var(--sl-rule)] px-3 text-[0.8125rem] text-[var(--sl-ink-2)] transition-colors last:border-b-0 hover:bg-[var(--sl-sunken)] hover:text-[var(--sl-ink)]"
                        >
                          <span className="min-w-0 truncate">{child.name}</span>
                          <RowChevron />
                        </Link>
                      </li>
                    ))}
                  </ul>

                  {active.children.length === 0 && !active.href ? (
                    <p className="px-3 py-4 text-[0.8125rem] text-[var(--sl-ink-3)]">
                      {t("categories.empty")}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
