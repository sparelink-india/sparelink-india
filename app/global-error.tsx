"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-16 text-center text-slate-900">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
          SpareLink India
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-3 max-w-md text-sm text-slate-600">
          The site could not be loaded. Please try again.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-8 inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
