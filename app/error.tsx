"use client";

import Link from "next/link";

import { StorefrontShell } from "@/components/storefront-shell";
import { T } from "@/components/t";

/**
 * Route-level error surface.
 *
 * Like the 404, this had been left in V2: the V2 `ink-` palette
 * (`text-ink-900`), `rounded-xl` buttons where V3 locks 2-5px, raw
 * `bg-slate-950` / `border-slate-300` instead of the token layer, no header,
 * footer or `<main>`, and all copy hardcoded in English. The `h1` also carried
 * a dangling `sm:` variant with no value.
 *
 * It is now a normal shell page so a failed route still looks like part of the
 * storefront and offers a way out. `common.error` and `common.tryAgain` already
 * existed in both dictionaries and are reused rather than duplicated.
 *
 * Styling is Precision (`sl-*`): the wordmark is an eyebrow with the bar
 * suppressed (`.sl-eyebrow-plain`), sized down to the 10px it had and kept in
 * the success green, and the actions are canonical `sl-btn` pairs — the shell's
 * `<main>` already carries `sl-container`, so no wrapper is needed here.
 *
 * The component is named `GlobalError`; that predates the V3 work and renaming
 * it would be churn with no behavioural effect, so it is left alone.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <StorefrontShell>
      <div className="flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
        <p className="sl-eyebrow sl-eyebrow-plain !text-[0.625rem] !text-[var(--sl-ok)]">
          SpareLink India
        </p>
        <h1 className="sl-h1 mt-3">
          <T k="common.error" />
        </h1>
        <p className="sl-body mt-3 max-w-md !text-[var(--sl-ink-2)]">
          <T k="errorPage.body" />
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="sl-btn sl-btn-primary"
          >
            <T k="common.tryAgain" />
          </button>
          <Link href="/" className="sl-btn sl-btn-secondary">
            <T k="errorPage.backToCatalog" />
          </Link>
        </div>
      </div>
    </StorefrontShell>
  );
}
