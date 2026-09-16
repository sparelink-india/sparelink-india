"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-16 text-center text-slate-900">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
        SpareLink India
      </p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-sm text-slate-600">
        The page could not be loaded. You can try again or return to the parts
        catalog.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Back to catalog
        </Link>
      </div>
    </div>
  );
}
