function PromoBannerStrip({ banners }: { banners: Array<{ id: string; title: string; image_key: string; alt_text: string; destination_url: string }> }) {
  if (!banners || banners.length === 0) return null;
  return (
    <div className="relative bg-[var(--dt-graphite-0)] text-white text-xs py-2 px-4 border-b border-white/10 transition" id="top-promo-banner">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-center sm:text-left">
        <div className="flex items-center gap-2 mx-auto sm:mx-0 flex-wrap justify-center">
          <span className="inline-flex items-center gap-1 font-semibold text-[var(--dt-copper-primary)] bg-white/10 px-2 py-0.5 rounded-full text-[11px]">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h9l-1 8 10-12h-2l1-4h-3v4h-3z" />
            </svg>
            <span>B2B Wholesale Deal</span>
          </span>
          <span className="text-slate-200 font-medium">Festive Workshop Special: Up to 15% Additional Margin on Bulk Lubricants & Filters</span>
          <span className="hidden md:inline text-slate-400">|</span>
          <span className="hidden md:inline font-mono text-amber-300 font-semibold">Code: B2BFIRST</span>
          <span className="hidden lg:inline text-slate-300 text-[11px] bg-white/10 px-2 py-0.5 rounded">100% GST ITC Invoicing</span>
        </div>
        <div className="flex items-center gap-3 shrink-0 hidden sm:flex">
          <a className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-2 flex items-center gap-0.5" href="#partner-wholesale">Claim Margin <span className="material-symbols-outlined text-[14px]">arrow_forward</span></a>
          <button aria-label="Dismiss" className="text-slate-400 hover:text-white p-0.5" onClick={() => { const el = document.getElementById('top-promo-banner'); if (el) el.remove(); }} type="button"><span className="material-symbols-outlined text-[16px]">close</span></button>
        </div>
      </div>
    </div>
  );
}

export { PromoBannerStrip };