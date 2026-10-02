"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-[var(--v3-sunk)] px-6 py-16 text-center text-[var(--v3-text)]">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--v3-ok)]">
          SpareLink India
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-3 max-w-md text-sm text-[var(--v3-text-2)]">
          The site could not be loaded. Please try again.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-8 inline-flex min-h-11 items-center rounded-[var(--v3-r)] bg-[var(--v3-brand)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
