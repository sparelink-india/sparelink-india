"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/components/preferences-provider";
import { navGroupLabel } from "@/lib/category-nav-labels";
import type { NavGroup } from "@/lib/category-navigation";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
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

export function CategoriesMenu() {
  const { t } = useI18n();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<NavGroup[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch("/api/catalogue/categories", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setGroups(Array.isArray(data.groups) ? data.groups : []))
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

  function toggleGroup(id: string) {
    setExpanded((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <div ref={rootRef} className="relative w-full md:w-auto">
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
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#7a1233] px-4 py-2.5 text-sm font-semibold text-white md:w-auto"
      >
        <span aria-hidden>☰</span>
        {t("nav.categories")}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 right-0 z-50 mt-1 max-h-[min(80vh,calc(100dvh-6rem))] w-full overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white py-1.5 shadow-lg md:right-auto md:w-[22rem]"
        >
          {groups.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">{t("categories.empty")}</p>
          ) : (
            groups.map((group) => {
              const isOpen = Boolean(expanded[group.id]);
              const hasChildren = group.children.length > 0;
              const label = navGroupLabel(group, t);
              return (
                <div key={group.id} className="border-b border-slate-100 last:border-b-0">
                  <div className="flex items-stretch">
                    {group.href ? (
                      <Link
                        role="menuitem"
                        href={group.href}
                        className="min-w-0 flex-1 px-3 py-2 text-left text-[13px] font-semibold uppercase tracking-wide text-slate-800 hover:bg-slate-50"
                        onClick={() => setOpen(false)}
                      >
                        {label}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="min-w-0 flex-1 px-3 py-2 text-left text-[13px] font-semibold uppercase tracking-wide text-slate-800 hover:bg-slate-50"
                        onClick={() => toggleGroup(group.id)}
                      >
                        {label}
                      </button>
                    )}
                    {hasChildren ? (
                      <button
                        type="button"
                        className="px-3 text-slate-500 hover:bg-slate-50"
                        aria-expanded={isOpen}
                        aria-label={isOpen ? t("nav.collapseGroup") : t("nav.expandGroup")}
                        onClick={() => toggleGroup(group.id)}
                      >
                        <Chevron open={isOpen} />
                      </button>
                    ) : null}
                  </div>
                  {isOpen && hasChildren ? (
                    <div className="pb-1.5">
                      {group.children.map((child) => (
                        <Link
                          key={child.id}
                          role="menuitem"
                          href={child.href}
                          className="block py-1.5 pl-6 pr-3 text-[13px] text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                          onClick={() => setOpen(false)}
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
