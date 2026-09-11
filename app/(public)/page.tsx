export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <main className="w-full max-w-xl text-center">
        <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
          SpareLink India
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Spare parts marketplace
        </h1>
        <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">
          Foundation is in place. Catalog, search, enquiries, checkout, and
          dealer tools will ship in later steps.
        </p>
      </main>
    </div>
  );
}
