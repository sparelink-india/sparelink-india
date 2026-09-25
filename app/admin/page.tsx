"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { FeatureIcon } from "@/components/admin-feature-icon";
import {
  IconAlert,
  IconArrow,
  IconChart,
  IconClock,
  IconCommand,
  IconLowStock,
  IconPackage,
  IconTrend,
} from "@/components/admin-icons";
import {
  BRAND_BURGUNDY,
  BRAND_NAVY,
  BRAND_ORANGE,
  DASHBOARD_RANGES,
  FEATURE_CATEGORY_LABELS,
  LOW_STOCK_THRESHOLD,
  RANGE_LABELS,
  adminDisplayName,
  adminFeatures,
  buildAlerts,
  buildKpis,
  buildSeries,
  emptyMessage,
  featuresByCategory,
  formatActivityAction,
  formatCount,
  formatInr,
  formatInrCompact,
  formatPaymentMethod,
  formatRelativeTime,
  greetingFor,
  hasChartableData,
  quickActionsForRole,
  sectionState,
  summariseFirms,
  titleCase,
  type AdminFeature,
  type DashboardPayload,
  type DashboardRange,
  type FeatureCategory,
  type Kpi,
} from "@/lib/admin-dashboard";

type AdminStatsResponse = {
  totalFirms: number;
  totalDealers: number;
  totalParts: number;
  totalOrders: number;
  totalRevenue: number;
  activeListings: number;
  adminDisplayName: string | null;
  dashboard: DashboardPayload;
};

const CATEGORY_ACCENT: Record<FeatureCategory, string> = {
  core: BRAND_BURGUNDY,
  finance: BRAND_NAVY,
  business: BRAND_ORANGE,
  logistics: "#0e7490",
  catalogue: "#4d7c0f",
  service: BRAND_BURGUNDY,
};

const FIRM_ACCENTS = [BRAND_BURGUNDY, BRAND_NAVY, BRAND_ORANGE];

const ALERT_ICONS: Record<string, string> = {
  "low-stock": "low-stock",
  "pending-orders": "pending-orders",
  "pending-payments": "payments",
  returns: "returns",
  "dealer-approval": "dealers",
  "failed-payments": "low-stock",
};

const ALERT_ACTION: Record<string, string> = {
  "low-stock": "Review Inventory",
  "pending-orders": "Review Orders",
  "pending-payments": "Review Payments",
  returns: "Review Returns",
  "dealer-approval": "Review Dealers",
  "failed-payments": "Review Payments",
};

const ALERT_RING: Record<string, string> = {
  critical: "border-rose-300 bg-rose-50 text-rose-700",
  action: "border-amber-300 bg-amber-50 text-amber-800",
  pending: "border-sky-300 bg-sky-50 text-sky-800",
  info: "border-zinc-300 bg-zinc-50 text-zinc-700",
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Critical",
  action: "Action required",
  pending: "Pending",
  info: "Information",
};

const ORDER_STATUS_TONE: Record<string, string> = {
  placed: "bg-sky-50 text-sky-700 ring-sky-600/20",
  pending: "bg-sky-50 text-sky-700 ring-sky-600/20",
  confirmed: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  packed: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  processing: "bg-amber-50 text-amber-800 ring-amber-600/20",
  shipped: "bg-violet-50 text-violet-700 ring-violet-600/20",
  delivered: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-600/20",
  returned: "bg-zinc-100 text-zinc-700 ring-zinc-500/20",
};

const ACTIVITY_ICON: Record<string, string> = {
  "order.status_update": "orders",
  "allocation.status_update": "allocations",
  "inventory.quantity_update": "stock-adjustments",
  "return.create": "returns",
  "return.status_update": "returns",
  "dealer.approve": "dealers",
  "dealer.reject": "dealers",
  "supplier.create": "suppliers",
  "purchase_order.create": "purchase-orders",
  "goods_receipt.confirm": "goods-receipts",
  "sales_order.create": "sales-orders",
  "quotation.create": "quotations",
  "pricing_category.create": "pricing-rules",
  "admin.role_change": "warranty",
  "retailer.register": "dealers",
  "party_ledger.post": "payments",
};

const KPI_ICON: Record<string, string> = {
  orders: "orders",
  sales: "sales",
  "pending-orders": "pending-orders",
  "low-stock": "low-stock",
  returns: "returns",
  customers: "customers",
  payments: "payments",
  dealers: "dealers",
};

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`motion-safe:animate-pulse rounded-xl bg-zinc-200/70 ${className}`}
    />
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-xs leading-relaxed text-zinc-500">
      {message}
    </p>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">{eyebrow}</p>
        <h2 className="text-base font-bold uppercase tracking-wide text-zinc-900">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function FeatureBlock({ feature }: { feature: AdminFeature }) {
  const accent = CATEGORY_ACCENT[feature.category];
  return (
    <Link
      href={feature.href}
      className="group relative flex items-start gap-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 transition-all duration-200 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_14px_34px_-14px_rgba(15,23,42,0.4)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1233]/50"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 origin-top scale-y-0 transition-transform duration-200 group-hover:scale-y-100"
        style={{ backgroundColor: accent }}
      />
      <span
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
        style={{ backgroundColor: `${accent}12`, color: accent }}
      >
        <FeatureIcon id={feature.id} className="h-[22px] w-[22px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold leading-tight text-zinc-900">
          {feature.label}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-zinc-500">
          {feature.description}
        </span>
      </span>
      <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-300 transition-all duration-200 group-hover:gap-1 group-hover:bg-zinc-100 group-hover:text-[#7a1233]">
        <IconArrow className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function BarChart({
  data,
  valueOf,
  label,
  colour,
  heightClass = "h-56",
}: {
  data: Array<{ key: string; orders: number; salesPaise: number }>;
  valueOf: (bucket: { orders: number; salesPaise: number }) => number;
  label: (bucket: { key: string; orders: number; salesPaise: number }) => string;
  colour: string;
  heightClass?: string;
}) {
  const max = Math.max(1, ...data.map(valueOf));
  return (
    <div className={`flex items-end gap-1 overflow-x-auto pb-1 ${heightClass}`}>
      {data.map((bucket) => {
        const value = valueOf(bucket);
        const pct = Math.round((value / max) * 100);
        return (
          <div
            key={bucket.key}
            className="group/bar flex min-w-[8px] flex-1 flex-col justify-end"
            title={`${bucket.key}: ${label(bucket)}`}
          >
            <div
              className="w-full rounded-t transition-opacity group-hover/bar:opacity-70"
              style={{
                height: `${Math.max(pct, value > 0 ? 8 : 2)}%`,
                backgroundColor: value > 0 ? colour : "var(--tw-zinc-200)",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function AdminCommandCenter() {
  const [data, setData] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState<DashboardRange>("30d");
  const [role] = useState("admin");
  const [showAllFeatures, setShowAllFeatures] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/admin/stats", { cache: "no-store" });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error);
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load the dashboard.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const dashboard = data?.dashboard ?? null;
  const series = useMemo(
    () => (dashboard ? buildSeries(dashboard, range) : []),
    [dashboard, range],
  );
  const windowTotals = useMemo(
    () =>
      series.reduce(
        (acc, b) => ({ orders: acc.orders + b.orders, salesPaise: acc.salesPaise + b.salesPaise }),
        { orders: 0, salesPaise: 0 },
      ),
    [series],
  );
  const kpis = useMemo(() => {
    if (!dashboard) return [];
    return buildKpis({
      range,
      current: windowTotals,
      previous: null,
      totals: dashboard.totals,
      payments: dashboard.payments,
    });
  }, [dashboard, windowTotals, range]);

  const kpiById = useMemo(
    () => Object.fromEntries(kpis.map((kpi) => [kpi.id, kpi])) as Record<string, Kpi>,
    [kpis],
  );
  // Executive split: two lead figures, the rest as a supporting band.
  const leadKpis = [kpiById.sales, kpiById.orders].filter(Boolean) as Kpi[];
  const supportKpis = kpis.filter((kpi) => kpi.id !== "sales" && kpi.id !== "orders");

  const alerts = useMemo(
    () => (dashboard ? buildAlerts(dashboard.totals, dashboard.payments) : []),
    [dashboard],
  );
  const quickActions = useMemo(() => quickActionsForRole(role), [role]);
  const allFeatures = useMemo(() => adminFeatures(), []);
  const grouped = useMemo(
    () => featuresByCategory(showAllFeatures ? allFeatures : quickActions),
    [showAllFeatures, allFeatures, quickActions],
  );
  const firms = useMemo(
    () =>
      dashboard
        ? summariseFirms(dashboard.firms, {
            orders: dashboard.allocationTotals.orders,
            salesPaise: dashboard.allocationTotals.salesPaise,
          })
        : [],
    [dashboard],
  );

  const now = new Date();
  const displayName = adminDisplayName(data?.adminDisplayName);
  const chartable = !loading && hasChartableData(series);

  return (
    <AdminShell alertCount={alerts.length}>
      {/* ------------------------------------------------------------- hero */}
      <section
        className="relative overflow-hidden rounded-2xl"
        style={{
          backgroundImage:
            "linear-gradient(105deg, #0f172a 0%, #1b2333 45%, #451a2b 80%, #5a1f33 100%)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(194,65,12,0.32), transparent 68%)" }}
        />
        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.35fr_1fr]">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
              SpareLink India · Admin
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {greetingFor(now)}, {displayName}
            </h2>
            <p className="mt-1.5 max-w-lg text-sm text-white/70">
              Your business command center — orders, inventory, payments and firm
              performance, live.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                href="/admin/orders"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold text-white shadow-lg transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                style={{ backgroundColor: BRAND_BURGUNDY }}
              >
                <IconPackage className="h-4 w-4" />
                Manage Orders
              </Link>
              <Link
                href="/admin/inventory"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <IconLowStock className="h-4 w-4" />
                Check Stock
              </Link>
              <Link
                href="/admin/reports"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <IconChart className="h-4 w-4" />
                Reports
              </Link>
            </div>
          </div>

          {/* Hero readouts — real figures, no invented trends. */}
          <div className="grid grid-cols-2 gap-3 self-center">
            <div className="rounded-xl border border-white/12 bg-white/10 p-4 backdrop-blur-md">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
                Sales · {RANGE_LABELS[range].toLowerCase()}
              </p>
              <p className="mt-1.5 text-2xl font-bold leading-none text-white">
                {formatInrCompact(windowTotals.salesPaise)}
              </p>
            </div>
            <div className="rounded-xl border border-white/12 bg-white/10 p-4 backdrop-blur-md">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
                Orders · {RANGE_LABELS[range].toLowerCase()}
              </p>
              <p className="mt-1.5 text-2xl font-bold leading-none text-white">
                {formatCount(windowTotals.orders)}
              </p>
            </div>
            <div className="col-span-2 flex items-center gap-2 rounded-xl border border-white/12 bg-white/10 px-4 py-3 backdrop-blur-md">
              <IconClock className="h-4 w-4 shrink-0" style={{ color: "#f6c9a8" }} />
              <p className="text-[11px] font-semibold text-white/75">
                {now.toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          <span className="inline-flex rounded-lg bg-rose-100 p-1.5" aria-hidden="true">
            <IconAlert className="h-4 w-4" />
          </span>
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
          >
            Retry
          </button>
        </div>
      )}

      {/* ---------------------------------------------------------- features */}
      <section aria-label="Admin features" className="mt-6">
        <SectionLabel
          eyebrow="Navigation hub"
          title="Features"
          action={
            <button
              type="button"
              onClick={() => setShowAllFeatures((open) => !open)}
              aria-expanded={showAllFeatures}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1233]/40"
            >
              {showAllFeatures ? "Show core" : `View All Features (${allFeatures.length})`}
              <IconArrow className="h-3.5 w-3.5" />
            </button>
          }
        />

        {loading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : quickActions.length === 0 ? (
          <EmptyBlock message="No admin features are available for this role." />
        ) : (
          <div className="space-y-5">
            {grouped.map((group) => (
              <div key={group.category}>
                <div className="mb-2 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-[3px] rounded-full"
                    style={{ backgroundColor: CATEGORY_ACCENT[group.category] }}
                  />
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    {FEATURE_CATEGORY_LABELS[group.category]}
                  </h3>
                </div>
                <div
                  className={`grid gap-3 ${
                    showAllFeatures
                      ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
                      : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
                  }`}
                >
                  {group.items.map((feature) => (
                    <FeatureBlock key={feature.id} feature={feature} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --------------------------------------------------------------- kpi */}
      <section aria-label="Key performance indicators" className="mt-6">
        <SectionLabel eyebrow="Live position" title="Today at a glance" />

        {loading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Two lead figures, deliberately unlike the supporting band. */}
            <div className="grid gap-3 sm:grid-cols-2">
              {leadKpis.map((kpi) => (
                <Link
                  key={kpi.id}
                  href={kpi.href ?? "/admin"}
                  className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1233]/40"
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-1.5"
                    style={{ backgroundColor: kpi.id === "sales" ? BRAND_BURGUNDY : BRAND_ORANGE }}
                  />
                  <div className="flex items-start justify-between gap-3 pl-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                        {kpi.label}
                      </p>
                      <p className="mt-1.5 text-4xl font-bold leading-none tracking-tight tabular-nums text-zinc-950">
                        {kpi.value}
                      </p>
                      <p className="mt-2 text-xs text-zinc-500">{kpi.context}</p>
                    </div>
                    <span
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: `${
                          kpi.id === "sales" ? BRAND_BURGUNDY : BRAND_ORANGE
                        }12`,
                        color: kpi.id === "sales" ? BRAND_BURGUNDY : BRAND_ORANGE,
                      }}
                    >
                      <FeatureIcon id={KPI_ICON[kpi.id]} className="h-6 w-6" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Supporting band: one panel, six inline stats. */}
            <Panel className="grid grid-cols-2 divide-zinc-200 sm:grid-cols-3 sm:divide-x lg:grid-cols-6 lg:divide-y-0">
              {supportKpis.map((kpi, index) => (
                <div
                  key={kpi.id}
                  className={`flex items-center gap-2.5 p-3.5 ${
                    index % 2 === 1 ? "border-l border-zinc-200" : ""
                  } ${index >= 2 ? "border-t border-zinc-200 sm:border-t-0" : ""} ${
                    index >= 2 ? "lg:border-t-0" : ""
                  }`}
                >
                  <span
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      kpi.tone === "critical"
                        ? "bg-rose-50 text-rose-700"
                        : kpi.tone === "warn"
                          ? "bg-amber-50 text-amber-700"
                          : kpi.tone === "good"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    <FeatureIcon id={KPI_ICON[kpi.id]} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                      {kpi.label}
                    </span>
                    <span className="block text-lg font-bold leading-tight tabular-nums text-zinc-900">
                      {kpi.value}
                    </span>
                  </span>
                </div>
              ))}
            </Panel>
          </div>
        )}
      </section>

      {/* --------------------------------------------------------- analytics */}
      <section aria-label="Sales and order analytics" className="mt-6">
        <SectionLabel
          eyebrow="Performance"
          title="Analytics"
          action={
            <div role="group" aria-label="Analytics period" className="flex flex-wrap gap-1">
              {DASHBOARD_RANGES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRange(option)}
                  aria-pressed={range === option}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    range === option
                      ? "bg-[#0f172a] text-white"
                      : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  {RANGE_LABELS[option]}
                </button>
              ))}
            </div>
          }
        />

        <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
          <Panel className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-flex rounded-lg p-2"
                  style={{ backgroundColor: `${BRAND_BURGUNDY}12`, color: BRAND_BURGUNDY }}
                >
                  <IconTrend className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                    Sales overview
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Excludes cancelled and returned orders
                  </p>
                </div>
              </div>
              <p className="text-2xl font-bold leading-none tracking-tight tabular-nums">
                {formatInrCompact(windowTotals.salesPaise)}
              </p>
            </div>
            {loading ? (
              <Skeleton className="mt-4 h-56" />
            ) : chartable ? (
              <div className="mt-4">
                <BarChart
                  data={series}
                  valueOf={(b) => b.salesPaise}
                  label={(b) => formatInr(b.salesPaise)}
                  colour={BRAND_BURGUNDY}
                  heightClass="h-56"
                />
              </div>
            ) : (
              <div className="mt-4">
                <EmptyBlock message={emptyMessage("chart")} />
              </div>
            )}
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-flex rounded-lg p-2"
                  style={{ backgroundColor: `${BRAND_ORANGE}12`, color: BRAND_ORANGE }}
                >
                  <IconPackage className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                    Order activity
                  </h3>
                  <p className="text-xs text-zinc-400">{RANGE_LABELS[range]}</p>
                </div>
              </div>
              <p className="text-2xl font-bold leading-none tracking-tight tabular-nums">
                {formatCount(windowTotals.orders)}
              </p>
            </div>
            {loading ? (
              <Skeleton className="mt-4 h-56" />
            ) : chartable ? (
              <div className="mt-4">
                <BarChart
                  data={series}
                  valueOf={(b) => b.orders}
                  label={(b) => `${b.orders} orders`}
                  colour={BRAND_ORANGE}
                  heightClass="h-56"
                />
              </div>
            ) : (
              <div className="mt-4">
                <EmptyBlock message={emptyMessage("chart")} />
              </div>
            )}
          </Panel>
        </div>
        {chartable && (
          <p className="mt-2 text-[11px] text-zinc-500">
            No prior window is stored, so no trend percentage is shown.
          </p>
        )}
      </section>

      {/* ------------------------------------------------------------ firms */}
      <section aria-label="Attention required" className="mt-6">
        <SectionLabel eyebrow="Act now" title="Attention Required" />
        <Panel className="p-4 sm:p-5">
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : sectionState({ loading, error, hasData: alerts.length > 0 }) === "empty" ? (
            <EmptyBlock message={emptyMessage("alerts")} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {alerts.map((alert) => {
                const inner = (
                  <div className="flex items-start gap-3">
                    <span
                      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${ALERT_RING[alert.severity]}`}
                    >
                      <FeatureIcon id={ALERT_ICONS[alert.id]} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                        {SEVERITY_LABEL[alert.severity]}
                      </p>
                      <p className="mt-0.5 text-2xl font-bold leading-none tabular-nums text-zinc-950">
                        {alert.count}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold leading-snug text-zinc-700">
                        {alert.label}
                      </p>
                    </div>
                  </div>
                );
                const cls = `rounded-xl border border-zinc-200 bg-white p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                  alert.href
                    ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7a1233]/40"
                    : "cursor-default"
                }`;
                return (
                  <li key={alert.id}>
                    {alert.href ? (
                      <Link href={alert.href} className="block">
                        {inner}
                        <span className="mt-3 inline-flex items-center gap-1 border-t border-zinc-100 pt-2.5 text-[11px] font-bold text-zinc-600">
                          {ALERT_ACTION[alert.id] ?? "Open"}
                          <IconArrow className="h-3 w-3" />
                        </span>
                      </Link>
                    ) : (
                      <div className={cls} title="No admin screen for this yet">
                        {inner}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </section>

      {/* ------------------------------------------------------------ firms */}
      <section aria-label="Firm performance" className="mt-6">
        <SectionLabel eyebrow="Fulfilment network" title="Firm-wise Business" />
        {loading ? (
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : firms.length === 0 ? (
          <EmptyBlock message={emptyMessage("firms")} />
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {firms.map((firm, index) => {
              const accent = FIRM_ACCENTS[index % FIRM_ACCENTS.length];
              return (
                <Panel key={firm.firmId} className="relative overflow-hidden">
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ backgroundColor: accent }}
                  />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                          style={{ backgroundColor: `${accent}12`, color: accent }}
                        >
                          <IconCommand className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold uppercase tracking-wide text-zinc-900">
                            {firm.firmName}
                          </p>
                          <p className="text-[11px] text-zinc-500">{firm.firmCode ?? "—"}</p>
                        </div>
                      </div>
                      <span
                        className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold text-white"
                        style={{ backgroundColor: accent }}
                      >
                        {firm.shareOfSales === null ? "—" : `${firm.shareOfSales}%`}
                      </span>
                    </div>
                    <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-zinc-50 p-3 text-center">
                      <div>
                        <dt className="text-[10px] uppercase text-zinc-500">Orders</dt>
                        <dd className="text-base font-bold tabular-nums">
                          {formatCount(firm.orders)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase text-zinc-500">Sales</dt>
                        <dd className="text-base font-bold tabular-nums">
                          {formatInrCompact(firm.salesPaise)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase text-zinc-500">Pending</dt>
                        <dd className="text-base font-bold tabular-nums">
                          {formatCount(firm.pending)}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(firm.shareOfSales ?? 0, firm.salesPaise > 0 ? 3 : 0)}%`,
                          backgroundColor: accent,
                        }}
                      />
                    </div>
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </section>

      {/* ------------------------------------------ recent orders + activity */}
      <div className="mt-6 grid gap-4 xl:grid-cols-[1.9fr_1fr]">
        <section aria-label="Recent orders">
          <SectionLabel
            eyebrow="Latest"
            title="Recent Orders"
            action={
              <Link
                href="/admin/orders"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#7a1233] underline-offset-2 hover:underline"
              >
                View All
                <IconArrow className="h-3 w-3" />
              </Link>
            }
          />
          <Panel className="overflow-hidden">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : !dashboard || dashboard.recentOrders.length === 0 ? (
              <div className="p-4">
                <EmptyBlock message={emptyMessage("orders")} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      {["Order", "Customer", "Firm", "Amount", "Payment", "Status", "Time", ""].map(
                        (label) => (
                          <th
                            key={label || "action"}
                            className={`whitespace-nowrap px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500 ${
                              label === "Amount" || label === "Time" || !label ? "text-right" : ""
                            }`}
                          >
                            {label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {dashboard.recentOrders.map((row) => {
                      const status = (row.status ?? "").toLowerCase();
                      const payment = (row.paymentStatus ?? "").toLowerCase();
                      return (
                        <tr key={row.id} className="transition-colors hover:bg-zinc-50/70">
                          <td className="whitespace-nowrap px-3 py-2.5">
                            <span className="flex items-center gap-2">
                              <span
                                className="inline-flex rounded-md p-1.5"
                                style={{ backgroundColor: `${BRAND_BURGUNDY}12`, color: BRAND_BURGUNDY }}
                              >
                                <IconPackage className="h-3.5 w-3.5" />
                              </span>
                              <span className="font-mono text-xs font-semibold">{row.orderNumber}</span>
                            </span>
                          </td>
                          <td className="max-w-[12rem] truncate px-3 py-2.5 text-xs text-zinc-700">
                            {row.buyerEmail}
                          </td>
                          <td className="max-w-[9rem] truncate px-3 py-2.5 text-[11px] text-zinc-600">
                            {row.firmNames.length > 0 ? row.firmNames.join(", ") : "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold tabular-nums">
                            {formatInr(row.totalPaise)}
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-zinc-600">
                            {titleCase(payment)}
                            <span className="block text-[10px] text-zinc-400">
                              {formatPaymentMethod(row.paymentMethod)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
                                ORDER_STATUS_TONE[status] ??
                                "bg-zinc-100 text-zinc-700 ring-zinc-500/20"
                              }`}
                            >
                              {titleCase(status)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] text-zinc-500">
                            {formatRelativeTime(row.createdAt, now)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right">
                            <Link
                              href="/admin/orders"
                              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-100"
                            >
                              View
                              <IconArrow className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </section>

        <section aria-label="Recent activity">
          <SectionLabel eyebrow="Audit trail" title="Activity" />
          <Panel className="h-full p-4">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-7" />
                ))}
              </div>
            ) : !dashboard || dashboard.activity.length === 0 ? (
              <EmptyBlock message={emptyMessage("activity")} />
            ) : (
              <ol>
                {dashboard.activity.map((entry, index) => {
                  const last = index === dashboard.activity.length - 1;
                  return (
                    <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
                      <span className="relative flex flex-col items-center">
                        <span
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white shadow-sm"
                          style={{ color: BRAND_BURGUNDY }}
                        >
                          <FeatureIcon
                            id={ACTIVITY_ICON[entry.action] ?? "ci-sync"}
                            className="h-4 w-4"
                          />
                        </span>
                        {!last && (
                          <span aria-hidden="true" className="mt-1 w-px flex-1 bg-zinc-200" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 pt-1">
                        <span className="block text-xs font-semibold text-zinc-900">
                          {formatActivityAction(entry.action)}
                        </span>
                        <span className="block text-[11px] text-zinc-500">
                          {titleCase(entry.entityType)}
                        </span>
                      </span>
                      <span className="shrink-0 pt-1.5 text-[10px] text-zinc-400">
                        {formatRelativeTime(entry.createdAt, now)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        </section>
      </div>

      <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 pt-4 text-[11px] text-zinc-500">
        <span>
          SpareLink India · Admin Command Center · low stock threshold {LOW_STOCK_THRESHOLD} units
        </span>
        <span>
          {formatCount(data?.totalFirms)} firms · {formatCount(data?.totalParts)} parts
          {dashboard ? ` · updated ${formatRelativeTime(dashboard.generatedAt, now)}` : ""}
        </span>
      </footer>
    </AdminShell>
  );
}
