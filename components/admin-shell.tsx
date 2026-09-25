"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { FeatureIcon } from "@/components/admin-feature-icon";
import {
  IconAlert,
  IconBell,
  IconCommand,
  IconMenu,
  IconPackage,
  IconSearch,
  IconX,
} from "@/components/admin-icons";
import {
  BRAND_BURGUNDY,
  BRAND_ORANGE,
  adminFeatures,
  featuresByCategory,
  type AdminFeature,
} from "@/lib/admin-dashboard";

/**
 * Admin application shell.
 *
 * A persistent desktop navigation rail plus a sticky command bar. This is the
 * structural difference from a scrolling card page: the console now has a
 * fixed frame with its own scroll region, which is what makes it read as an
 * application rather than a long dashboard.
 *
 * On small screens the rail becomes a slide-over drawer driven by the command
 * bar; it is not a shrunken desktop rail.
 */

type NavEntry = AdminFeature | { id: "dashboard"; label: string; href: string; description: string };

function NavRow({
  entry,
  active,
  onNavigate,
}: {
  entry: NavEntry;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <li>
      <Link
        href={entry.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
          active
            ? "bg-white/12 text-white shadow-[inset_2px_0_0_0_#7a1233]"
            : "text-white/60 hover:bg-white/[0.07] hover:text-white"
        }`}
      >
        <span
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors ${
            active ? "text-white" : "text-white/45 group-hover:text-white/80"
          }`}
        >
          {entry.id === "dashboard" ? (
            <IconCommand className="h-4 w-4" />
          ) : (
            <FeatureIcon id={entry.id} className="h-4 w-4" />
          )}
        </span>
        <span className="truncate">{entry.label}</span>
      </Link>
    </li>
  );
}

function RailContent({
  activeHref,
  alertCount,
  onNavigate,
}: {
  activeHref: string;
  alertCount: number;
  onNavigate?: () => void;
}) {
  const groups = featuresByCategory(adminFeatures());

  return (
    <div className="flex h-full flex-col bg-[#0f172a] text-white">
      {/* Brand + identity */}
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
        <span className="rounded-md bg-white/95 px-1 py-0.5">
          <BrandLogo compact />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
            SpareLink India
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="rounded px-1 py-px text-[9px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: BRAND_BURGUNDY }}
            >
              Admin
            </span>
            <span className="truncate text-[11px] font-bold text-white/85">
              Command Center
            </span>
          </span>
        </span>
      </div>

      {/* Navigation */}
      <nav aria-label="Admin modules" className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <NavRow
          entry={{
            id: "dashboard",
            label: "Dashboard",
            href: "/admin",
            description: "Command center overview",
          }}
          active={activeHref === "/admin"}
          onNavigate={onNavigate}
        />

        {groups.map((group) => (
          <div key={group.category} className="mt-4">
            <p className="px-2.5 pb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((entry) => (
                <NavRow
                  key={entry.id}
                  entry={entry}
                  active={activeHref === entry.href}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: status + sign out */}
      <div className="border-t border-white/10 px-3 py-3">
        <Link
          href="/admin/orders"
          className="mb-2 flex items-center gap-2 rounded-lg bg-white/[0.06] px-2.5 py-2 text-[11px] font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <IconPackage className="h-3.5 w-3.5" />
          {alertCount > 0 ? `${alertCount} items need attention` : "All clear"}
          <IconAlert className="ml-auto h-3.5 w-3.5" style={{ color: BRAND_ORANGE }} />
        </Link>
        <SignOutButton />
      </div>
    </div>
  );
}

export function AdminShell({
  children,
  alertCount = 0,
  title = "Dashboard",
  subtitle = "Business command center overview",
}: {
  children: React.ReactNode;
  alertCount?: number;
  title?: string;
  subtitle?: string;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the drawer on Escape.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      {/* Persistent desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] lg:block">
        <RailContent activeHref="/admin" alertCount={alertCount} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-[300px] shadow-2xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation"
              className="absolute right-2 top-3 z-10 rounded-lg p-1.5 text-white/60 hover:bg-white/10"
            >
              <IconX className="h-5 w-5" />
            </button>
            <RailContent
              activeHref="/admin"
              alertCount={alertCount}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="lg:pl-[248px]">
        {/* Command bar */}
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
              className="rounded-lg border border-zinc-200 p-2 text-zinc-700 transition-colors hover:bg-zinc-50 lg:hidden"
            >
              <IconMenu className="h-4 w-4" />
            </button>

            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-bold leading-tight tracking-tight text-zinc-900">
                {title}
              </h1>
              <p className="hidden truncate text-[11px] text-zinc-500 sm:block">{subtitle}</p>
            </div>

            <div className="relative ml-auto hidden max-w-sm flex-1 md:block">
              <label htmlFor="admin-global-search" className="sr-only">
                Search the admin console
              </label>
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                id="admin-global-search"
                type="search"
                placeholder="Search orders, buyers, parts…"
                className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[#7a1233] focus:bg-white"
              />
            </div>

            <Link
              href="/admin/orders"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white shadow-sm transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1233]/40 sm:inline-flex"
              style={{ backgroundColor: BRAND_BURGUNDY }}
            >
              <IconPackage className="h-3.5 w-3.5" />
              New Order
            </Link>

            <button
              type="button"
              aria-label={`Notifications${alertCount ? `, ${alertCount} need attention` : ""}`}
              className="relative rounded-lg border border-zinc-200 p-2 text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              <IconBell className="h-4 w-4" />
              {alertCount > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
              )}
            </button>
          </div>
        </header>

        <main className="px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
