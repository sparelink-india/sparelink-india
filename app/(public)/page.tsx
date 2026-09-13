"use client";

import { FormEvent, useState } from "react";

type Listing = {
  id: string;
  dealerId: string;
  dealerName: string;
  sku: string | null;
  pricePaise: number;
  mrpPaise: number | null;
  status: string;
  stock: number | null;
};

type SearchHit = {
  document?: {
    id?: string;
    part_number?: string;
    name?: string;
    description?: string;
    brand?: string;
    category?: string;
  };
  listings?: Listing[];
};

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [found, setFound] = useState(0);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const categories = [
    { name: "Engine Parts", icon: "??" },
    { name: "Brakes", icon: "??" },
    { name: "Electrical", icon: "??" },
    { name: "Filters", icon: "??" },
    { name: "Suspension", icon: "??" },
    { name: "Cooling", icon: "??" },
  ];

  async function searchParts(searchQuery: string) {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      setResults([]);
      setFound(0);
      setError("Please enter a part name or part number.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/search/parts?q=${encodeURIComponent(trimmedQuery)}`,
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Search failed");
      }

      setResults(data.results ?? []);
      setFound(data.found ?? 0);
    } catch (searchError) {
      console.error(searchError);
      setResults([]);
      setFound(0);
      setError("Unable to search parts right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function addToCart(listingId: string) {
    setAddingId(listingId);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dealerListingId: listingId,
          quantity: 1,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to add to cart");
      }

      setMessage("Part added to cart.");
    } catch (cartError) {
      console.error(cartError);
      setError(
        cartError instanceof Error
          ? cartError.message
          : "Unable to add to cart.",
      );
    } finally {
      setAddingId("");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void searchParts(query);
  }

  function handleExampleSearch(example: string) {
    setQuery(example);
    void searchParts(example);
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xl font-bold tracking-tight">SpareLink</p>
            <p className="text-xs text-zinc-500">India</p>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <a href="#categories" className="hover:text-zinc-600">
              Categories
            </a>
            <a href="#how-it-works" className="hover:text-zinc-600">
              How it works
            </a>
            <a
              href="/cart"
              className="rounded-full border border-zinc-300 px-4 py-2 hover:bg-zinc-100"
            >
              Cart
            </a>
            <a href="/orders" className="hover:text-zinc-600">
              My Orders
            </a>
          </nav>

          <a
            href="#search"
            className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Find Parts
          </a>
        </div>
      </header>

      <main>
        <section id="search" className="bg-white">
          <div className="mx-auto max-w-5xl px-6 py-20 text-center md:py-28">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              SpareLink India
            </p>

            <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
              Find the right spare part for your vehicle.
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-zinc-600 md:text-lg">
              Search genuine and compatible automotive spare parts from dealers
              across India.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mx-auto mt-9 flex max-w-2xl flex-col gap-3 sm:flex-row"
            >
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by part name or part number..."
                className="h-12 flex-1 rounded-xl border border-zinc-300 bg-white px-4 outline-none placeholder:text-zinc-400 focus:border-zinc-950"
              />

              <button
                type="submit"
                disabled={loading}
                className="h-12 rounded-xl bg-zinc-950 px-7 font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Searching..." : "Search Parts"}
              </button>
            </form>

            <div className="mt-5 flex flex-wrap justify-center gap-2 text-sm text-zinc-500">
              <span>Try:</span>

              {["Engine Oil Filter", "Brake Pad", "Car Battery"].map(
                (example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => handleExampleSearch(example)}
                    className="rounded-full bg-zinc-100 px-3 py-1 hover:bg-zinc-200"
                  >
                    {example}
                  </button>
                ),
              )}
            </div>
          </div>
        </section>

        {(loading || error || message || query.trim()) && (
          <section className="border-y border-zinc-200 bg-zinc-50">
            <div className="mx-auto max-w-7xl px-6 py-12">
              <div>
                <p className="text-sm font-medium text-zinc-500">
                  Search results
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">
                  {loading
                    ? "Searching parts..."
                    : found > 0
                      ? `${found} part${found === 1 ? "" : "s"} found`
                      : "No parts found"}
                </h2>
              </div>

              {error && (
                <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              {message && (
                <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                  {message}
                </div>
              )}

              {!loading && !error && results.length > 0 && (
                <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {results.map((hit, index) => {
                    const part = hit.document ?? {};
                    const listings = hit.listings ?? [];

                    return (
                      <article
                        key={part.id ?? index}
                        className="rounded-2xl border border-zinc-200 bg-white p-6"
                      >
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                          {part.brand || "SpareLink"}
                        </p>

                        <h3 className="mt-2 text-lg font-semibold">
                          {part.name || "Automotive Spare Part"}
                        </h3>

                        {part.part_number && (
                          <p className="mt-2 text-sm font-medium text-zinc-600">
                            Part No: {part.part_number}
                          </p>
                        )}

                        {part.description && (
                          <p className="mt-3 text-sm leading-6 text-zinc-500">
                            {part.description}
                          </p>
                        )}

                        {part.category && (
                          <span className="mt-4 inline-block rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600">
                            {part.category}
                          </span>
                        )}

                        {listings.length > 0 ? (
                          <div className="mt-6 space-y-3 border-t border-zinc-100 pt-5">
                            <p className="text-sm font-semibold">
                              Available from dealers
                            </p>

                            {listings.map((listing) => {
                              const stock = listing.stock ?? 0;
                              const available =
                                listing.status === "active" && stock > 0;

                              return (
                                <div
                                  key={listing.id}
                                  className="rounded-xl border border-zinc-200 p-4"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-medium">
                                        {listing.dealerName}
                                      </p>

                                      <p className="mt-1 text-xs text-zinc-500">
                                        {available
                                          ? `${stock} in stock`
                                          : "Out of stock"}
                                      </p>
                                    </div>

                                    <div className="text-right">
                                      <p className="font-bold">
                                        ?
                                        {(
                                          listing.pricePaise / 100
                                        ).toLocaleString("en-IN")}
                                      </p>

                                      {listing.mrpPaise &&
                                        listing.mrpPaise >
                                          listing.pricePaise && (
                                          <p className="text-xs text-zinc-400 line-through">
                                            ?
                                            {(
                                              listing.mrpPaise / 100
                                            ).toLocaleString("en-IN")}
                                          </p>
                                        )}
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    disabled={
                                      !available || addingId === listing.id
                                    }
                                    onClick={() => void addToCart(listing.id)}
                                    className="mt-4 w-full rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                                  >
                                    {addingId === listing.id
                                      ? "Adding..."
                                      : available
                                        ? "Add to Cart"
                                        : "Out of Stock"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="mt-5 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500">
                            No dealer listing available for this part.
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}

              {!loading && !error && query.trim() && results.length === 0 && (
                <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
                  <p className="font-medium">No matching parts found.</p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Try a different part name or part number.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        <section
          id="categories"
          className="border-y border-zinc-200 bg-zinc-50"
        >
          <div className="mx-auto max-w-7xl px-6 py-16">
            <div>
              <p className="text-sm font-medium text-zinc-500">Browse parts</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">
                Shop by category
              </h2>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {categories.map((category) => (
                <button
                  key={category.name}
                  type="button"
                  className="rounded-2xl border border-zinc-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-sm"
                >
                  <div className="text-2xl">{category.icon}</div>
                  <p className="mt-4 text-sm font-semibold">{category.name}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="bg-white">
          <div className="mx-auto max-w-7xl px-6 py-16">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-zinc-500">
                Simple buying experience
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">
                How SpareLink works
              </h2>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {[
                {
                  number: "01",
                  title: "Search",
                  text: "Find a part using its name, part number, or vehicle.",
                },
                {
                  number: "02",
                  title: "Compare",
                  text: "Compare available dealer listings, prices, and stock.",
                },
                {
                  number: "03",
                  title: "Buy",
                  text: "Add parts to your cart and continue to checkout.",
                },
              ].map((step) => (
                <div
                  key={step.number}
                  className="rounded-2xl border border-zinc-200 p-6"
                >
                  <p className="text-sm font-bold text-zinc-400">
                    {step.number}
                  </p>
                  <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {step.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 bg-zinc-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">SpareLink India</p>
          <p className="text-sm text-zinc-400">
            Automotive spare parts marketplace
          </p>
        </div>
      </footer>
    </div>
  );
}
