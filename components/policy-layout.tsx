"use client";

import { useEffect, useRef, useState } from "react";

/**
 * V3 policy reading system.
 *
 * Three changes from V2, all structural:
 *
 * 1. THE CONTENTS EXIST ON MOBILE. V2 wrapped the rail in `hidden lg:block`, so
 *    on a 375px screen a four-section privacy policy was an undifferentiated
 *    wall of legal text with no way to jump. The contents are now a real
 *    disclosure panel above the reading column on small screens — a summary
 *    that expands, not a hidden rail.
 *
 * 2. THE PROGRESS INDICATOR IS A RULE, NOT A RING. V2 drew an SVG donut that
 *    rotated as you scrolled. It was decorative, it could not be read at a
 *    glance, and it forced the rail to reserve a 36px square. V3 uses a 2px
 *    burgundy bar that fills across the rail width: the same information, a
 *    twelfth of the space, and it reads as a document being read rather than a
 *    gauge.
 *
 * 3. SECTIONS ARE NUMBERED. Legal documents are referenced by clause
 *    ("clause 4.2"), so each contents row carries a monospaced index. This is
 *    also what makes a long contents list scannable at 13px.
 *
 * The heading TEXT is read from the rendered DOM rather than from a `data-toc`
 * attribute, because the policy pages are Server Components that render copy
 * through `<T k="..." />` — the i18n key is not the human label, and this way
 * the contents is correct in English and Hindi with no extra wiring.
 */
export function PolicyToc({
  containerId,
  label,
}: {
  containerId: string;
  /* ReactNode, not string: a client hook cannot read a Server Component's
     rendered copy. */
  label: React.ReactNode;
}) {
  const [items, setItems] = useState<{ id: string; text: string }[]>([]);
  const [active, setActive] = useState("");
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);
  const foundRef = useRef<{ id: string; text: string }[]>([]);

  useEffect(() => {
    const root = document.getElementById(containerId);
    if (!root) return;

    const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-toc]"));
    const found = sections
      .map((el) => {
        const heading = el.querySelector("h2, h3");
        const text = (heading?.textContent ?? "").trim();
        return { id: el.id, text };
      })
      .filter((entry) => entry.id && entry.text.length > 0);
    foundRef.current = found;

    function onScroll() {
      const el = document.getElementById(containerId);
      if (!el) return;
      const box = el.getBoundingClientRect();
      const scrolled = -box.top;
      const total = box.height - window.innerHeight;
      setProgress(total > 0 ? Math.min(100, Math.max(0, (scrolled / total) * 100)) : 0);

      // Active heading = the last one whose top has passed the offset line.
      // 132px clears the sticky site header plus this row.
      const offset = 132;
      let current = foundRef.current[0]?.id ?? "";
      for (const entry of foundRef.current) {
        const node = document.getElementById(entry.id);
        if (node && node.getBoundingClientRect().top <= offset) current = entry.id;
      }
      setActive(current);
    }

    /* Defer the first paint of the list by a frame: setting state synchronously
       inside the effect would trigger a second render before the browser has
       painted, which React reports as an unnecessary render. */
    const frame = requestAnimationFrame(() => {
      setItems(found);
      setActive(found[0]?.id ?? "");
      onScroll();
    });

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [containerId]);

  if (items.length < 2) return null;

  const activeText =
    items.find((item) => item.id === active)?.text ?? items[0]?.text ?? "";

  const list = (
    <ol className="border-l border-[var(--sl-rule)]">
      {items.map((item, index) => {
        const isActive = item.id === active;
        return (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={isActive ? "true" : undefined}
              onClick={() => setOpen(false)}
              className={`sl-focus -ml-px flex items-baseline gap-2.5 border-l-2 py-2 pl-3.5 no-underline transition-colors ${
                isActive
                  ? "border-[var(--sl-brand)] text-[var(--sl-brand-ink)]"
                  : "border-transparent text-[var(--sl-ink-2)] hover:border-[var(--sl-rule-2)] hover:text-[var(--sl-ink)]"
              }`}
            >
              {/* Clause number. Referenced constantly in practice, so it is
                  the first thing in the row. */}
              <span className="sl-partno w-6 shrink-0 !text-[0.6875rem] !text-[var(--sl-ink-3)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                className={`text-[0.8125rem] leading-snug ${
                  isActive ? "font-bold" : "font-medium"
                }`}
              >
                {item.text}
              </span>
            </a>
          </li>
        );
      })}
    </ol>
  );

  return (
    <>
      {/* ---- MOBILE: a disclosure, not a hidden rail ---- */}
      <details
        className="sl-panel mb-4 lg:hidden"
        open={open}
        onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}
      >
        <summary className="sl-focus flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5">
          <span className="sl-eyebrow sl-eyebrow-plain flex items-center gap-2">
            <span className="inline-block h-3 w-[3px] bg-[var(--sl-brand)]" aria-hidden />
            {label}
          </span>
          <span className="flex items-center gap-2">
            <span className="sl-clamp-1 max-w-[9rem] text-[0.75rem] font-semibold text-[var(--sl-ink-2)]">
              {activeText}
            </span>
            <svg
              className={`h-3.5 w-3.5 shrink-0 text-[var(--sl-ink-3)] transition-transform ${
                open ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </summary>
        <div className="border-t border-[var(--sl-rule)] px-3 py-2">{list}</div>
      </details>

      {/* ---- DESKTOP: the rail ---- */}
      <div className="hidden lg:sticky lg:top-[var(--v3-header-h)] lg:block">
        <div className="sl-eyebrow sl-eyebrow-plain flex items-center gap-2">
          <span className="inline-block h-3 w-[3px] bg-[var(--sl-brand)]" aria-hidden />
          {label}
        </div>

        {/* Reading progress as a filling rule. */}
        <div
          className="mt-3 h-0.5 w-full bg-[var(--sl-rule)]"
          role="presentation"
          aria-hidden
        >
          <div
            className="h-full bg-[var(--sl-brand)] transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>

        <nav className="mt-3.5">{list}</nav>
      </div>
    </>
  );
}

/**
 * Policy page shell.
 *
 * Desktop: a contents rail beside a narrow reading column. The rail is sticky
 * and the reading column is capped at 72ch, which is the measure long legal
 * copy is actually readable at — V2 used 46rem, which is close, but paired it
 * with a 15rem rail in a 1280px container and left a 400px dead gutter on the
 * right of every policy page.
 *
 * Mobile: the contents disclosure, then the reading column. One column, no
 * horizontal scroll, no hidden navigation.
 */
export function PolicyLayout({
  tocContainerId,
  tocLabel,
  children,
}: {
  tocContainerId: string;
  tocLabel: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="min-w-0">
        <PolicyToc containerId={tocContainerId} label={tocLabel} />
      </aside>
      <div className="sl-container-prose min-w-0 mx-auto lg:mx-0">{children}</div>
    </div>
  );
}
