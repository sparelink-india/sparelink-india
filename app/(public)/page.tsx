"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Listing = {
  id: string;
  dealerId: string;
  dealerName: string;
  firmId?: string | null;
  firmName?: string | null;
  firmCode?: string | null;
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
  compatibleVehicles?: {
    vehicleId: string;
    make: string;
    model: string;
    variant: string | null;
  }[];
};

type Vehicle = {
  id: string;
  make: string;
  model: string;
  variant: string | null;
};

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [found, setFound] = useState(0);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState("");
  const [addedId, setAddedId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedMake, setSelectedMake] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [cartCount, setCartCount] = useState<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{
    src: string;
    alt: string;
    name: string;
    partNumber?: string;
    brand?: string;
    category?: string;
  } | null>(null);

  // Prevent background scroll when lightbox is open & listen for ESC key
  useEffect(() => {
    if (lightboxImage) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setLightboxImage(null);
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [lightboxImage]);

  // Load vehicles
  useEffect(() => {
    void fetch("/api/vehicles")
      .then((response) => response.json())
      .then((data) => setVehicles(data.vehicles ?? []))
      .catch(() => setVehicles([]));
  }, []);

  // Fetch initial cart count
  useEffect(() => {
    void fetch("/api/cart")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.itemCount === "number") {
          setCartCount(data.itemCount);
        } else if (data && Array.isArray(data.items)) {
          const count = data.items.reduce(
            (acc: number, item: { quantity: number }) => acc + item.quantity,
            0,
          );
          setCartCount(count);
        }
      })
      .catch(() => setCartCount(0));
  }, []);

  const makes = useMemo(
    () => [...new Set(vehicles.map((vehicle) => vehicle.make))],
    [vehicles],
  );

  const vehiclesForMake = useMemo(
    () => vehicles.filter((vehicle) => vehicle.make === selectedMake),
    [vehicles, selectedMake],
  );

  const categoryCards = [
    {
      name: "Body & Hardware",
      query: "Door Handle",
      desc: "Door outer handles, panels & trim",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M14 12h3m-3 3h3m-3-6h3" />
        </svg>
      ),
    },
    {
      name: "Filters",
      query: "Filter",
      desc: "Oil, air, fuel & cabin filters",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
      ),
    },
    {
      name: "Brakes & Friction",
      query: "Brake",
      desc: "Brake pads, discs & shoes",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="12" cy="12" r="9" strokeWidth="1.75" />
          <circle cx="12" cy="12" r="3" strokeWidth="1.75" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M12 3v3m0 12v3M3 12h3m12 0h3" />
        </svg>
      ),
    },
    {
      name: "Engine & Internal",
      query: "Engine",
      desc: "Spark plugs, gaskets & mounts",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      name: "Cooling Systems",
      query: "Radiator",
      desc: "Radiators, water pumps & fans",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      ),
    },
    {
      name: "Transmission & Clutch",
      query: "Clutch",
      desc: "Clutch kits, flywheels & bearings",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <circle cx="12" cy="12" r="3" strokeWidth="1.75" />
        </svg>
      ),
    },
  ];

  async function searchParts(searchQuery: string, customVehicleId?: string) {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      setResults([]);
      setFound(0);
      setError("Please enter a part name, number, or category.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const vId = customVehicleId !== undefined ? customVehicleId : selectedVehicleId;
      const params = new URLSearchParams({ q: trimmedQuery });
      if (vId) params.set("vehicleId", vId);

      const response = await fetch(`/api/search/parts?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Search failed");
      }

      setResults(data.results ?? []);
      setFound(data.found ?? 0);

      // Smooth scroll to search results section
      const resultsElem = document.getElementById("search-results");
      if (resultsElem) {
        resultsElem.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (searchError) {
      console.error(searchError);
      setResults([]);
      setFound(0);
      setError("Unable to search parts right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function addToCart(listingId: string, partName: string) {
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

      setAddedId(listingId);
      setTimeout(() => setAddedId(""), 2500);

      // Increment cart badge
      setCartCount((prev) => prev + 1);
      setMessage(`Added "${partName}" to your cart.`);
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

  function handleCategoryClick(catQuery: string) {
    setQuery(catQuery);
    void searchParts(catQuery);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-emerald-500 selection:text-white">
      {/* Top Banner */}
      <div className="bg-slate-950 px-4 py-2 text-center text-xs font-medium text-slate-300 sm:px-6">
        <span className="inline-flex items-center gap-1.5">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>SpareLink India — Private Automotive Business Ordering</span>
          <span className="hidden sm:inline text-slate-500">|</span>
          <span className="hidden sm:inline text-slate-400">
            Fulfillment Network: Ambaji Traders • Hind Motors • India Sales
          </span>
        </span>
      </div>

      {/* Main Header / Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
            aria-label="SpareLink India"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm ring-1 ring-slate-800">
              <svg
                className="h-5 w-5 text-emerald-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black tracking-tight text-slate-950">
                  SpareLink
                </span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  India
                </span>
              </div>
              <p className="text-[10px] font-semibold text-slate-400">
                Automotive Parts Catalog
              </p>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex">
            <a
              href="#categories"
              className="transition-colors hover:text-slate-950"
            >
              Categories
            </a>
            <a
              href="#search"
              className="transition-colors hover:text-slate-950"
            >
              Search Parts
            </a>
            <a
              href="#how-it-works"
              className="transition-colors hover:text-slate-950"
            >
              Fulfillment
            </a>
            <Link
              href="/orders"
              className="transition-colors hover:text-slate-950"
            >
              My Orders
            </Link>
            <Link
              href="/profile"
              className="transition-colors hover:text-slate-950"
            >
              Profile
            </Link>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Cart Button */}
            <Link
              href="/cart"
              aria-label={`Shopping Cart with ${cartCount} items`}
              className="relative flex h-10 items-center gap-2 rounded-xl border border-slate-300/80 bg-white px-3.5 text-slate-800 shadow-xs transition-all hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
            >
              <svg
                className="h-4 w-4 text-slate-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              <span className="text-xs font-bold">Cart</span>
              {cartCount > 0 && (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-extrabold text-white">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Profile / Login Link */}
            <Link
              href="/profile"
              className="hidden sm:inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
            >
              Account
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 md:hidden"
            >
              {mobileMenuOpen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Nav Dropdown */}
        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
            <div className="flex flex-col space-y-3 text-sm font-semibold text-slate-700">
              <a
                href="#categories"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-slate-950"
              >
                Categories
              </a>
              <a
                href="#search"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-slate-950"
              >
                Search Parts
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-slate-950"
              >
                Fulfillment Network
              </a>
              <Link
                href="/orders"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-slate-950"
              >
                My Orders
              </Link>
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-slate-950"
              >
                Customer Profile
              </Link>
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 inline-flex items-center justify-center rounded-xl bg-slate-950 py-2.5 text-center text-xs font-bold text-white"
              >
                Sign In with OTP
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero & Search Section */}
        <section
          id="search"
          className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-white via-slate-50 to-slate-100/80 py-16 sm:py-20 lg:py-24"
        >
          {/* Subtle Grid Ambient */}
          <div className="bg-grid-pattern absolute inset-0 opacity-40 pointer-events-none" />

          <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
            {/* Pill Tag */}
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Direct Regional Logistics with Ambaji Traders & Partners
            </div>

            <h1 className="mx-auto mt-6 max-w-3xl text-3xl font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Precision Automotive Spare Parts.{" "}
              <span className="text-slate-700">Delivered Across India.</span>
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
              Search genuine and verified aftermarket components by part number,
              description, or vehicle compatibility with live distributor inventory.
            </p>

            {/* Smart Search Box */}
            <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-slate-300/80 bg-white p-3 shadow-lg shadow-slate-200/50 sm:p-4">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  {/* Query Input */}
                  <div className="relative flex-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Enter part name or part number (e.g. 113, Oil Filter)..."
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
                    />
                  </div>

                  {/* Search CTA */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-press flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-7 text-sm font-bold text-white shadow-sm transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {loading ? (
                      <>
                        <svg
                          className="h-4 w-4 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        <span>Searching...</span>
                      </>
                    ) : (
                      <span>Search Parts</span>
                    )}
                  </button>
                </div>

                {/* Vehicle Filters Row */}
                <div className="flex flex-col gap-2.5 pt-1 sm:flex-row">
                  <div className="flex-1">
                    <select
                      value={selectedMake}
                      onChange={(event) => {
                        setSelectedMake(event.target.value);
                        setSelectedVehicleId("");
                      }}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-semibold text-slate-700 outline-none transition-colors hover:bg-slate-100 focus:border-slate-950 focus:bg-white"
                    >
                      <option value="">Vehicle Make (Optional)</option>
                      {makes.map((make) => (
                        <option key={make} value={make}>
                          {make}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1">
                    <select
                      value={selectedVehicleId}
                      disabled={!selectedMake}
                      onChange={(event) => setSelectedVehicleId(event.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-semibold text-slate-700 outline-none transition-colors hover:bg-slate-100 focus:border-slate-950 focus:bg-white disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">All {selectedMake || "Models"}</option>
                      {vehiclesForMake.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.model}
                          {vehicle.variant ? ` — ${vehicle.variant}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </form>
            </div>

            {/* Quick Keyword Pills */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-600">Quick searches:</span>
              {[
                { label: "Water Pump Bolero (M663)", q: "M663" },
                { label: "Door Handle (113)", q: "113" },
                { label: "Engine Oil Filter", q: "Engine Oil Filter" },
                { label: "Brake Pads", q: "Brake Pad" },
                { label: "Clutch Kit", q: "Clutch Kit" },
                { label: "12V Battery", q: "Battery" },
              ].map((item) => (
                <button
                  key={item.q}
                  type="button"
                  onClick={() => {
                    setQuery(item.q);
                    void searchParts(item.q);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 shadow-2xs transition-all hover:border-slate-300 hover:bg-slate-100"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Key Value Props Strip */}
            <div className="mt-12 grid grid-cols-2 gap-4 border-t border-slate-200/80 pt-8 sm:grid-cols-4">
              <div className="text-left">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Inventory</p>
                <p className="mt-1 text-sm font-bold text-slate-900">100% Real-time Stock</p>
              </div>
              <div className="text-left">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Fulfillment</p>
                <p className="mt-1 text-sm font-bold text-slate-900">Regional Partners</p>
              </div>
              <div className="text-left">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Invoicing</p>
                <p className="mt-1 text-sm font-bold text-slate-900">GST-Compliant B2B</p>
              </div>
              <div className="text-left">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Verification</p>
                <p className="mt-1 text-sm font-bold text-slate-900">Fitment Guaranteed</p>
              </div>
            </div>
          </div>
        </section>

        {/* Categories Section */}
        <section id="categories" className="py-14 sm:py-18 bg-white border-b border-slate-200/80">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                  Product Categories
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  Browse by Vehicle System
                </h2>
              </div>
              <p className="text-xs text-slate-500 max-w-md">
                Select a category to instantly browse verified catalog parts and regional dealer listings.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categoryCards.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => handleCategoryClick(cat.query)}
                  className="card-hover group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-xs transition-all hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-colors group-hover:bg-slate-950 group-hover:text-emerald-400">
                    {cat.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 group-hover:text-slate-950">
                      {cat.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      {cat.desc}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 group-hover:underline">
                      <span>Explore parts</span>
                      <span>→</span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Search Results Section */}
        {(loading || error || message || results.length > 0 || query.trim()) && (
          <section id="search-results" className="py-14 sm:py-18 bg-slate-50/80">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    Catalog Query
                  </p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                    {loading
                      ? "Searching catalog..."
                      : found > 0
                        ? `${found} part${found === 1 ? "" : "s"} found for "${query}"`
                        : `No parts found for "${query}"`}
                  </h2>
                </div>

                {results.length > 0 && (
                  <span className="rounded-full bg-white px-3.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200 shadow-2xs">
                    Showing top {results.length} results
                  </span>
                )}
              </div>

              {/* Feedback messages */}
              {error && (
                <div
                  role="alert"
                  className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800"
                >
                  {error}
                </div>
              )}

              {message && (
                <div
                  role="status"
                  className="mt-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"
                >
                  <span>{message}</span>
                  <Link
                    href="/cart"
                    className="ml-4 rounded-lg bg-emerald-700 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-800"
                  >
                    View Cart →
                  </Link>
                </div>
              )}

              {/* Loading Skeletons */}
              {loading && (
                <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6"
                    >
                      <div className="aspect-[16/9] w-full rounded-xl bg-slate-200" />
                      <div className="mt-4 h-5 w-2/3 rounded bg-slate-200" />
                      <div className="mt-2 h-4 w-1/3 rounded bg-slate-200" />
                      <div className="mt-6 h-10 w-full rounded-xl bg-slate-200" />
                    </div>
                  ))}
                </div>
              )}

              {/* Empty Search Results */}
              {!loading && !error && results.length === 0 && (
                <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <svg
                      className="h-8 w-8"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">
                    No matching parts found
                  </h3>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                    Try searching by a broader term like &quot;Filter&quot;, &quot;Handle&quot;, or the exact Part Number &quot;113&quot;.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("113");
                      void searchParts("113");
                    }}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    Search Part #113 (Door Handle)
                  </button>
                </div>
              )}

              {/* Product Cards Grid */}
              {!loading && !error && results.length > 0 && (
                <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {results.map((hit, index) => {
                    const partData = hit.document ?? {};
                    const listings = hit.listings ?? [];
                    const partNo = partData.part_number;
                    const imageSrc = partNo
                      ? `/images/products/${partNo}.svg`
                      : "/images/products/placeholder.svg";

                    return (
                      <article
                        key={partData.id ?? index}
                        className="card-hover group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
                      >
                        {/* Product Image Area with Lightbox Trigger */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            setLightboxImage({
                              src: imageSrc,
                              alt: partData.name || "Automotive part",
                              name: partData.name || "Automotive Spare Part",
                              partNumber: partNo,
                              brand: partData.brand,
                              category: partData.category,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setLightboxImage({
                                src: imageSrc,
                                alt: partData.name || "Automotive part",
                                name: partData.name || "Automotive Spare Part",
                                partNumber: partNo,
                                brand: partData.brand,
                                category: partData.category,
                              });
                            }
                          }}
                          aria-label={`Enlarge image for ${partData.name || "part"}`}
                          className="relative aspect-[16/10] w-full cursor-zoom-in overflow-hidden border-b border-slate-100 bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imageSrc}
                            alt={partData.name || "Automotive part"}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                "/images/products/placeholder.svg";
                            }}
                          />

                          {/* Hover Zoom Overlay Hint */}
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 opacity-0 transition-opacity group-hover:opacity-100">
                            <span className="flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white shadow-md backdrop-blur-xs">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                              </svg>
                              Click to view large
                            </span>
                          </div>

                          {/* Top Badges */}
                          <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                            {partNo && (
                              <span className="rounded-md bg-slate-900/90 px-2 py-0.5 font-mono text-[11px] font-bold text-white shadow-xs backdrop-blur-xs">
                                #{partNo}
                              </span>
                            )}
                            {partData.category && (
                              <span className="rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-xs backdrop-blur-xs">
                                {partData.category}
                              </span>
                            )}
                          </div>

                          <span className="absolute bottom-2.5 right-2.5 rounded bg-slate-900/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-xs">
                            {partData.brand || "SpareLink"}
                          </span>
                        </div>

                        {/* Card Content */}
                        <div className="flex flex-1 flex-col p-5 sm:p-6">
                          <div>
                            <h3 className="text-base font-bold text-slate-950 sm:text-lg">
                              {partData.name || "Automotive Spare Part"}
                            </h3>

                            {partData.description && (
                              <p className="mt-2 text-xs leading-relaxed text-slate-600 line-clamp-2">
                                {partData.description}
                              </p>
                            )}
                          </div>

                          {/* Compatible Vehicles */}
                          {hit.compatibleVehicles && hit.compatibleVehicles.length > 0 && (
                            <div className="mt-3 rounded-lg bg-slate-50 p-2.5 border border-slate-100 text-xs">
                              <span className="font-semibold text-slate-700">
                                Verified Fits:{" "}
                              </span>
                              <span className="text-slate-600">
                                {hit.compatibleVehicles
                                  .slice(0, 3)
                                  .map((v) => `${v.make} ${v.model}`)
                                  .join(", ")}
                                {hit.compatibleVehicles.length > 3
                                  ? ` +${hit.compatibleVehicles.length - 3} more`
                                  : ""}
                              </span>
                            </div>
                          )}

                          {/* Dealer Listings & Pricing */}
                          <div className="mt-auto pt-5">
                            {listings.length > 0 ? (
                              <div className="space-y-3 border-t border-slate-100 pt-4">
                                {listings.map((listing) => {
                                  const stock = listing.stock ?? 0;
                                  const isAvailable =
                                    listing.status === "active" && stock > 0;
                                  const isAdding = addingId === listing.id;
                                  const isJustAdded = addedId === listing.id;

                                  return (
                                    <div
                                      key={listing.id}
                                      className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3.5"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <p className="text-xs font-bold text-slate-900">
                                            {listing.dealerName}
                                          </p>

                                          {listing.firmName && (
                                            <p className="mt-0.5 text-[11px] font-semibold text-emerald-700">
                                              Fulfilled by {listing.firmName}
                                            </p>
                                          )}

                                          <div className="mt-1 flex items-center gap-1.5">
                                            <span
                                              className={`h-1.5 w-1.5 rounded-full ${
                                                isAvailable
                                                  ? "bg-emerald-500"
                                                  : "bg-rose-500"
                                              }`}
                                            />
                                            <span className="text-[11px] text-slate-500">
                                              {isAvailable
                                                ? `${stock} in stock`
                                                : "Out of stock"}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="text-right">
                                          <p className="text-base font-extrabold text-slate-950">
                                            ₹
                                            {(
                                              listing.pricePaise / 100
                                            ).toLocaleString("en-IN")}
                                          </p>

                                          {listing.mrpPaise &&
                                            listing.mrpPaise >
                                              listing.pricePaise && (
                                              <p className="text-[11px] text-slate-400 line-through">
                                                ₹
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
                                          !isAvailable || isAdding || isJustAdded
                                        }
                                        onClick={() =>
                                          void addToCart(
                                            listing.id,
                                            partData.name || "part",
                                          )
                                        }
                                        aria-label={`Add ${partData.name || "part"} to cart`}
                                        className={`btn-press mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all ${
                                          isJustAdded
                                            ? "bg-emerald-600 text-white"
                                            : isAvailable
                                              ? "bg-slate-950 text-white shadow-xs hover:bg-slate-800"
                                              : "cursor-not-allowed bg-slate-200 text-slate-400"
                                        }`}
                                      >
                                        {isAdding ? (
                                          <span>Adding...</span>
                                        ) : isJustAdded ? (
                                          <>
                                            <svg
                                              className="h-4 w-4"
                                              viewBox="0 0 20 20"
                                              fill="currentColor"
                                            >
                                              <path
                                                fillRule="evenodd"
                                                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                                clipRule="evenodd"
                                              />
                                            </svg>
                                            <span>Added to Cart!</span>
                                          </>
                                        ) : isAvailable ? (
                                          <>
                                            <svg
                                              className="h-3.5 w-3.5"
                                              fill="none"
                                              viewBox="0 0 24 24"
                                              stroke="currentColor"
                                              strokeWidth="2"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M12 4v16m8-8H4"
                                              />
                                            </svg>
                                            <span>Add to Cart</span>
                                          </>
                                        ) : (
                                          <span>Out of Stock</span>
                                        )}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="rounded-xl bg-slate-50 p-3 text-center text-xs font-medium text-slate-500">
                                No active dealer listings for this part.
                              </p>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* How It Works / Logistics Section */}
        <section id="how-it-works" className="py-16 sm:py-20 bg-white border-t border-slate-200/80">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                Fulfillment & Logistics
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                How SpareLink Delivers Direct
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600">
                A streamlined multi-firm distribution engine connecting verified regional suppliers to garages and buyers.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className="relative rounded-2xl border border-slate-200 bg-slate-50/50 p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950 text-white font-mono font-bold text-lg">
                  1
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-950">
                  Search & Verified Fitment
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Lookup by OEM part number or vehicle compatibility. Real-time catalog index confirms exact technical specs.
                </p>
              </div>

              <div className="relative rounded-2xl border border-slate-200 bg-slate-50/50 p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950 text-white font-mono font-bold text-lg">
                  2
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-950">
                  Regional Multi-Firm Allocation
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Orders are partitioned directly to fulfillment partners (Ambaji Traders, Hind Motors, India Sales) for rapid dispatch.
                </p>
              </div>

              <div className="relative rounded-2xl border border-slate-200 bg-slate-50/50 p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-950 text-white font-mono font-bold text-lg">
                  3
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-950">
                  GST Invoicing & Delivery
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Receive fully compliant GST invoices and tracking details directly to your workshop or doorstep.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-950 text-slate-400 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white">SpareLink</span>
                <span className="rounded bg-emerald-950 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-400 border border-emerald-800">
                  India
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Automotive spare parts distribution and regional fulfillment network.
              </p>
            </div>

            <div className="flex flex-wrap gap-6 text-xs font-semibold text-slate-300">
              <a href="#search" className="hover:text-white">Find Parts</a>
              <a href="#categories" className="hover:text-white">Categories</a>
              <Link href="/cart" className="hover:text-white">Cart</Link>
              <Link href="/orders" className="hover:text-white">My Orders</Link>
              <Link href="/profile" className="hover:text-white">Customer Profile</Link>
              <Link href="/admin" className="hover:text-white">Admin Management</Link>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-800 pt-8 text-center text-xs text-slate-500">
            &copy; {new Date().getFullYear()} SpareLink India. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Product Image Lightbox Modal */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Enlarged product image of ${lightboxImage.name}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setLightboxImage(null);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 sm:p-6 backdrop-blur-sm animate-in fade-in"
        >
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50/50">
              <div className="flex items-center gap-2">
                {lightboxImage.partNumber && (
                  <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                    #{lightboxImage.partNumber}
                  </span>
                )}
                <h2 className="text-sm font-bold text-slate-900 truncate">
                  {lightboxImage.name}
                </h2>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                aria-label="Close image preview"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body / Image View */}
            <div className="flex flex-1 items-center justify-center overflow-hidden bg-slate-100 p-4 sm:p-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxImage.src}
                alt={lightboxImage.alt}
                className="max-h-[60vh] w-full object-contain rounded-lg transition-transform"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "/images/products/placeholder.svg";
                }}
              />
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500 bg-white">
              <span>
                {lightboxImage.brand || "SpareLink"}
                {lightboxImage.category ? ` • ${lightboxImage.category}` : ""}
              </span>
              <span className="hidden sm:inline">
                Click outside or press <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd> to close
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
