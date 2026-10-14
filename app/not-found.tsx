import Link from "next/link";

import { StorefrontShell } from "@/components/storefront-shell";
import { T } from "@/components/t";

/**
 * 404.
 *
 * The previous version of this file was the only customer-facing surface the
 * V3 pass never reached, and it was still V2 in every respect: it carried the
 * V2 `ink-` palette (`text-ink-900`, `text-ink-500`), `rounded-xl` buttons
 * where V3 locks 2-5px, raw `bg-slate-950` instead of an inverse token, no
 * storefront header or footer, no `<main>` landmark, and every string
 * hardcoded in English - so a Hindi customer following a dead link was
 * dropped into an untranslated page.
 *
 * It is now a normal shell page: the same header, container, footer and mobile
 * nav as every other route, wrapped in `<main>` by the shell. The `h1` also
 * carried a dangling `sm:` variant with no value after it (a leftover from an
 * earlier edit); that is gone with the rest of the class list.
 *
 * Styling is Precision (`sl-*`): eyebrow (bar suppressed, wordmark-sized,
 * success green), `sl-h1` / `sl-body`, and a canonical `sl-btn` pair — same
 * construction as `app/error.tsx`.
 *
 * "SpareLink India" stays as literal text: it is the firm's own name and is
 * never translated.
 */
export default function NotFound() {
  return (
    <StorefrontShell>
      <div className="flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
        <p className="sl-eyebrow sl-eyebrow-plain !text-[0.625rem] !text-[var(--sl-ok)]">
          SpareLink India
        </p>
        <h1 className="sl-h1 mt-3">
          <T k="notFound.title" />
        </h1>
        <p className="sl-body mt-3 max-w-md !text-[var(--sl-ink-2)]">
          <T k="notFound.body" />
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="sl-btn sl-btn-primary">
            <T k="notFound.findParts" />
          </Link>
          <Link href="/orders" className="sl-btn sl-btn-secondary">
            <T k="nav.orders" />
          </Link>
        </div>
      </div>
    </StorefrontShell>
  );
}
