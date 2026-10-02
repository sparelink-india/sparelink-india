import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--v3-sunk)] px-6 py-16 text-center text-[var(--v3-text)]">
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--v3-ok)]">
        SpareLink India
      </p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-sm text-[var(--v3-text-2)]">
        This address is not a SpareLink page. Check the link or continue from
        the catalog.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-[var(--v3-r)] bg-[var(--v3-brand)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--v3-brand-hover)]"
        >
          Find parts
        </Link>
        <Link
          href="/orders"
          className="inline-flex min-h-11 items-center rounded-[var(--v3-r)] border border-[var(--v3-rule-strong)] bg-[var(--v3-panel)] px-5 py-2.5 text-sm font-semibold text-[var(--v3-text)] hover:bg-[var(--v3-sunk)]"
        >
          My orders
        </Link>
      </div>
    </div>
  );
}
