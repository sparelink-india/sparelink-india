import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-950 py-10 text-slate-400">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">
        <div className="text-center sm:text-left">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <span className="text-lg font-bold text-white">SpareLink</span>
            <span className="rounded border border-emerald-800 bg-emerald-950 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-400">
              India
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Automotive spare parts catalog and regional fulfillment.
          </p>
        </div>
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-300">
          <Link href="/" className="min-h-11 inline-flex items-center hover:text-white">
            Catalog
          </Link>
          <Link href="/cart" className="min-h-11 inline-flex items-center hover:text-white">
            Cart
          </Link>
          <Link href="/orders" className="min-h-11 inline-flex items-center hover:text-white">
            Orders
          </Link>
          <Link href="/profile" className="min-h-11 inline-flex items-center hover:text-white">
            Profile
          </Link>
          <Link href="/login" className="min-h-11 inline-flex items-center hover:text-white">
            Login
          </Link>
        </nav>
      </div>
      <p className="mt-8 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} SpareLink India. All rights reserved.
      </p>
    </footer>
  );
}
