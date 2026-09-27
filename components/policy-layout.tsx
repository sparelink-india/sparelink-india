"use client";

import { useEffect, useRef, useState } from "react";

/**
 * V2 policy reading experience.
 *
 * Long legal pages are hard to navigate linearly, so this renders a sticky
 * table of contents built from the `<section id>` anchors already present in
 * the policy pages. Headings are read from the DOM itself, so the contents can
 * never drift out of sync with the page body.
 *
 * The scroll-progress ring is decorative and hidden from assistive tech. If
 * scroll-driven animation is unavailable the ring simply stays at its initial
 * value \u2014 it is never load-bearing.
 */
export function PolicyToc({
  containerId,
  label,
}: {
  containerId: string;
  /* ReactNode, not string: the policy pages are Server Components and render
     copy through <T k="..." />, which a client hook cannot read. */
  label: React.ReactNode;
}) {
  const [items, setItems] = useState<{ id: string; text: string }[]>([]);
  const [active, setActive] = useState("");
  const [progress, setProgress] = useState(0);
  const foundRef = useRef<{ id: string; text: string }[]>([]);

  useEffect(() => {
    const root = document.getElementById(containerId);
    if (!root) return;

    const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-toc]"));
    const found = sections
      .map((el) => {
        /*
         * Read the heading TEXT from the DOM, not from data-toc. The policy
         * pages are Server Components that render copy through <T k="..." />,
         * so the i18n key is not the human label \u2014 the rendered heading is.
         * This also means the TOC is correct in both English and Hindi with no
         * extra wiring.
         */
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
      const offset = 120;
      let current = foundRef.current[0]?.id ?? "";
      for (const entry of foundRef.current) {
        const node = document.getElementById(entry.id);
        if (node && node.getBoundingClientRect().top <= offset) current = entry.id;
      }
      setActive(current);
    }

    /* Defer the first paint of the list by a frame. Setting state synchronously
       inside the effect would cascade a second render before the browser has
       painted, which React flags as an unnecessary render. */
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

  return (
    <div className="lg:sticky lg:top-24">
      <div className="flex items-center gap-2.5">
        <svg
          className="h-4 w-4 shrink-0 -rotate-90"
          viewBox="0 0 36 36"
          aria-hidden
          focusable="false"
        >
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="var(--sl-border)"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="var(--sl-primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(progress / 100) * 97.4} 97.4`}
          />
        </svg>
        <h2 className="sl-label">{label}</h2>
      </div>

      <nav className="mt-3.5">
        <ol className="space-y-0.5 border-l border-[var(--sl-border)]">
          {items.map((item) => {
            const isActive = item.id === active;
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  aria-current={isActive ? "true" : undefined}
                  className={`sl-v2-focus -ml-px block border-l-2 py-1.5 pl-3.5 text-sm no-underline transition-colors ${
                    isActive
                      ? "border-[var(--sl-primary)] font-semibold text-[var(--sl-primary)]"
                      : "border-transparent text-[var(--sl-text-soft)] hover:border-[var(--sl-border-strong)] hover:text-[var(--sl-text)]"
                  }`}
                >
                  {item.text}
                </a>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

/**
 * Policy page shell: a two-column reading layout on desktop (contents rail +
 * narrow readable column) that collapses to a single column on mobile.
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
    <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
      <aside className="hidden lg:block">
        <PolicyToc containerId={tocContainerId} label={tocLabel} />
      </aside>
      <div className="min-w-0 max-w-[46rem]">{children}</div>
    </div>
  );
}
