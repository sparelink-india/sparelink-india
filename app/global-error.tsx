"use client";

/*
 * Stylesheets: this file has to carry its own.
 *
 * `global-error.tsx` replaces the ROOT LAYOUT when that layout itself throws,
 * and Next injects only the CSS imported by this module (getGlobalErrorStyles
 * in next/dist/server/app-render/app-render.js) — the layout's stylesheet
 * stack never reaches this document. Without the imports below the page renders
 * as raw HTML on the browser's default font.
 *
 * The order mirrors app/layout.tsx: globals.css first (Tailwind v4 plus the
 * `theme, base, components, utilities` layer order), then sparelink.css, whose
 * `@layer components` block therefore lands beneath Tailwind's utilities
 * exactly as it does everywhere else. v3.css is deliberately NOT imported:
 * no `v3-*` class or `--v3-*` token survives in this file.
 */
import "./globals.css";
import "./sparelink.css";

/**
 * Global error surface.
 *
 * This one is deliberately different from `app/error.tsx` and from the 404.
 * `global-error.tsx` replaces the ROOT LAYOUT when that layout itself throws,
 * so it must render its own `<html>` and `<body>`, and nothing that depends on
 * the root layout is available to it.
 *
 * That rules out the storefront shell, and it also rules out translation: the
 * locale lives in `PreferencesProvider`, which is mounted by the root layout,
 * and `useI18n` deliberately THROWS when called outside that provider. Using
 * the `<T>` component here would turn a recoverable error page into a second
 * crash, so the copy below stays English by necessity rather than oversight.
 *
 * Everything that IS in scope is Precision (`sl-*`): the wordmark is a
 * bar-less eyebrow in the success green, the heading and body use `sl-h1` /
 * `sl-body`, and the retry action is a canonical `sl-btn sl-btn-primary`.
 *
 * Two things cannot come from the design system here and are noted rather than
 * faked:
 *   - the ground sits on `<main>`, not on `<body>`: globals.css carries an
 *     UNLAYERED `html, body { background: var(--background); color: var(--foreground); min-height: 100% }` rule,
 *     and an unlayered rule outranks
 *     anything in `@layer utilities`, so `bg-[var(--sl-page)]` on the body
 *     would silently lose. `<main>` is not matched by that rule, so the
 *     Precision tokens apply as written — and it gives the document its `main`
 *     landmark.
 *   - the font stack is written out instead of using `font-sans`: Geist and
 *     Noto Devanagari are attached by next/font through variables on the root
 *     layout's `<html>`, which is exactly what is missing here, so
 *     `font-sans` would resolve to an undefined variable and fall back to the
 *     UA default. The light ground is likewise the safe fallback: the `dark`
 *     class is applied by the root layout, so it cannot be known at this level.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--sl-page)] px-6 py-16 text-center text-[var(--sl-ink)] font-[family-name:ui-sans-serif,system-ui,sans-serif]">
          <p className="sl-eyebrow sl-eyebrow-plain !text-[0.625rem] !text-[var(--sl-ok)]">
            SpareLink India
          </p>
          <h1 className="sl-h1 mt-3">Something went wrong</h1>
          <p className="sl-body mt-3 max-w-md !text-[var(--sl-ink-2)]">
            The site could not be loaded. Please try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="sl-btn sl-btn-primary mt-8"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
