import Link from "next/link";

/**
 * The "back to the dealer dashboard" link on the dealer sub-pages.
 *
 * Both dealer sub-pages had this link as a plain text-coloured link whose
 * colour came straight from the body-text token — the same near-black as
 * body text — so the link had no colour of its own and read as a stray
 * word next to the page title. Underline-on-hover was the only cue, which
 * does not survive touch and is not a focus indicator.
 *
 * It is now a Precision accent link at a readable size with a real focus ring.
 * The href and the label are passed in so the caller keeps owning its own
 * wording and destination; this component only owns the affordance.
 */
export function DealerBackLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="sl-focus inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[var(--sl-brand-ink)] underline-offset-4 transition-colors duration-200 hover:text-[var(--sl-brand-hover)] hover:underline"
    >
      <svg
        className="h-3.5 w-3.5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M15 6l-6 6 6 6" />
      </svg>
      {children}
    </Link>
  );
}
