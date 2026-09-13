import Link from "next/link";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ number?: string }>;
};

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: Props) {
  const [{ id }, { number }] = await Promise.all([params, searchParams]);
  return (
    <main className="min-h-screen bg-slate-50/80 px-4 py-16 text-slate-900 sm:px-6 sm:py-24">
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 sm:p-10 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <svg className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <p className="mt-5 text-xs font-bold uppercase tracking-widest text-emerald-700">
          Order Successfully Placed
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Thank you for your order!
        </h1>

        <p className="mt-3 text-sm text-slate-600">
          Your order {number ? <strong className="font-mono font-bold text-slate-900">#{number}</strong> : ""} has been
          received and allocated to regional fulfillment partners.
        </p>

        <div className="mt-6 rounded-xl bg-slate-50 border border-slate-100 p-4 text-xs text-slate-500 space-y-1.5 text-left">
          <div className="flex justify-between">
            <span>Order Reference:</span>
            <span className="font-mono text-slate-700">{id}</span>
          </div>
          <div className="flex justify-between">
            <span>Fulfillment Status:</span>
            <span className="text-emerald-700 font-semibold">Allocated to Regional Distributor</span>
          </div>
          <div className="flex justify-between">
            <span>GST Tax Invoice:</span>
            <span className="text-slate-900 font-medium">Ready for Download</span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href={`/api/orders/${id}/invoice`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-xs hover:bg-slate-50"
          >
            <span>🧾</span> View / Print Tax Invoice
          </a>
          <a
            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
              `Hello, I have placed Order #${number || id} on SpareLink India for automotive parts. View status: https://sparelink.in/orders`,
            )}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
          >
            <span>💬</span> Share on WhatsApp
          </a>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center border-t border-slate-100 pt-6">
          <Link
            href="/orders"
            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
          >
            View My Orders →
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Continue Shopping
          </Link>
        </div>
      </section>
    </main>
  );
}
