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
    <main className="min-h-screen bg-zinc-50 px-6 py-20 text-zinc-950">
      <section className="mx-auto max-w-xl rounded-2xl border border-zinc-200 bg-white p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-green-700">
          Order placed
        </p>
        <h1 className="mt-3 text-3xl font-bold">Thanks for your order.</h1>
        <p className="mt-4 text-zinc-600">
          Your order {number ? <strong>#{number}</strong> : ""} has been
          received. The dealer will prepare it for dispatch.
        </p>
        <p className="mt-3 text-xs text-zinc-400">Reference: {id}</p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Continue shopping
        </Link>
        <Link
          href="/orders"
          className="mt-3 block text-sm font-medium underline"
        >
          View my orders
        </Link>
      </section>
    </main>
  );
}
