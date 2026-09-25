/**
 * Pure view model for the Admin Command Center.
 *
 * Every value rendered by the dashboard is derived here from the aggregate
 * payload returned by `GET /api/admin/stats`. Nothing is hard-coded: if the
 * payload does not contain a figure, the UI renders an explicit unavailable
 * state rather than a fabricated number or a trend percentage.
 *
 * This module has no server-only imports so it is safe in a client component.
 */

export const BRAND_BURGUNDY = "#7a1233";
export const BRAND_NAVY = "#0f172a";
export const BRAND_ORANGE = "#c2410c";

/** Business rule, not data. Below this a listing counts as low stock. */
export const LOW_STOCK_THRESHOLD = 5;

export type DashboardRange = "today" | "7d" | "30d" | "12m";

export const DASHBOARD_RANGES: readonly DashboardRange[] = ["today", "7d", "30d", "12m"];

export const RANGE_LABELS: Record<DashboardRange, string> = {
  today: "Today",
  "7d": "7 Days",
  "30d": "30 Days",
  "12m": "12 Months",
};

export type Bucket = { key: string; orders: number; salesPaise: number };

export type DashboardPayload = {
  generatedAt: string;
  totals: {
    orders: number;
    salesPaise: number;
    /** Orders not yet cancelled, returned or completed. */
    pendingOrders: number;
    customers: number;
    dealers: number;
    dealersPendingApproval: number;
    parts: number;
    activeListings: number;
    lowStockListings: number;
    openReturns: number;
  };
  payments: {
    paid: number;
    pending: number;
    unpaid: number;
    failed: number;
    paidPaise: number;
  };
  hourly: Bucket[];
  daily: Bucket[];
  monthly: Bucket[];
  firms: Array<{
    firmId: string;
    firmName: string;
    firmCode: string | null;
    orders: number;
    salesPaise: number;
    pending: number;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    buyerEmail: string;
    totalPaise: number;
    paymentStatus: string;
    paymentMethod: string | null;
    status: string;
    createdAt: string;
    firmNames: string[];
  }>;
  activity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    createdAt: string;
  }>;
  /** Sum of the per-firm allocation matrix, used as the share denominator. */
  allocationTotals: { orders: number; salesPaise: number };
};

// ------------------------------------------------------------------ identity

/** Shown when the authenticated admin has no usable display name. */
export const DEFAULT_ADMIN_DISPLAY_NAME = "SPARELINK INDIA";

/** Keeps an unusually long account name from breaking the greeting layout. */
export const ADMIN_DISPLAY_NAME_MAX_LENGTH = 60;

/**
 * Display name for the command-center greeting.
 *
 * Uses the authenticated admin's own name when one is safely available and
 * falls back to the business name otherwise. The email address is never used
 * or returned, and the value is only ever read from an already
 * admin-authorised response.
 */
export function adminDisplayName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return DEFAULT_ADMIN_DISPLAY_NAME;
  if (trimmed.length <= ADMIN_DISPLAY_NAME_MAX_LENGTH) return trimmed;
  return `${trimmed.slice(0, ADMIN_DISPLAY_NAME_MAX_LENGTH - 1).trimEnd()}…`;
}

// ---------------------------------------------------------------- formatting

/** Compact Indian currency: 4.82L, 12.3K, 1,20,000. */
export function formatInrCompact(paise: number | null | undefined): string {
  const value = typeof paise === "number" && Number.isFinite(paise) ? paise / 100 : 0;
  const abs = Math.abs(value);
  if (abs >= 1e7) return `₹${(value / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(value / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `₹${(value / 1e3).toFixed(1)}K`;
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function formatInr(paise: number | null | undefined): string {
  const value = typeof paise === "number" && Number.isFinite(paise) ? paise / 100 : 0;
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCount(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-IN")
    : "—";
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash_on_delivery: "COD",
  bank_transfer: "Bank Transfer",
  online_payment: "Online",
};

export function formatPaymentMethod(method: string | null | undefined): string {
  const value = (method ?? "").trim().toLowerCase();
  if (!value) return "—";
  return PAYMENT_METHOD_LABELS[value] ?? value.replace(/_/g, " ");
}

export function titleCase(value: string | null | undefined): string {
  const text = (value ?? "").trim().toLowerCase();
  if (!text) return "Unknown";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const ACTIVITY_LABELS: Record<string, string> = {
  "order.status_update": "Order status updated",
  "allocation.status_update": "Allocation status updated",
  "inventory.quantity_update": "Stock adjusted",
  "return.create": "Return requested",
  "return.status_update": "Return status updated",
  "dealer.approve": "Dealer approved",
  "dealer.reject": "Dealer rejected",
  "supplier.create": "Supplier added",
  "purchase_order.create": "Purchase order created",
  "sales_order.create": "Sales order created",
  "quotation.create": "Quotation created",
  "admin.role_change": "Admin role changed",
  "retailer.register": "Retailer registered",
  "party_ledger.post": "Ledger entry posted",
  "goods_receipt.confirm": "Goods receipt confirmed",
  "pricing_category.create": "Pricing category created",
};

/** Activity action -> human label. Unknown actions are title-cased, never dropped. */
export function formatActivityAction(action: string | null | undefined): string {
  const value = (action ?? "").trim();
  if (!value) return "Activity";
  return ACTIVITY_LABELS[value] ?? titleCase(value.replace(/[._]/g, " "));
}

export function formatRelativeTime(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString("en-IN");
}

export function greetingFor(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// ------------------------------------------------------------------- series

export function buildSeries(
  payload: Pick<DashboardPayload, "hourly" | "daily" | "monthly">,
  range: DashboardRange,
): Bucket[] {
  if (range === "today") return payload.hourly.slice(-24);
  if (range === "7d") return payload.daily.slice(-7);
  if (range === "30d") return payload.daily.slice(-30);
  return payload.monthly.slice(-12);
}

export function sumSeries(buckets: readonly Bucket[]): {
  orders: number;
  salesPaise: number;
} {
  return buckets.reduce(
    (acc, bucket) => ({
      orders: acc.orders + (bucket.orders || 0),
      salesPaise: acc.salesPaise + (bucket.salesPaise || 0),
    }),
    { orders: 0, salesPaise: 0 },
  );
}

/** True when the series has at least one non-zero point worth charting. */
export function hasChartableData(buckets: readonly Bucket[]): boolean {
  return buckets.some((bucket) => bucket.orders > 0 || bucket.salesPaise > 0);
}

/**
 * Percentage change between two comparable windows.
 * Returns null when it cannot be computed honestly (no prior period, or a zero
 * base), so the UI can show "no comparison available" instead of inventing one.
 */
export function percentageChange(
  current: number,
  previous: number,
): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return null;
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return Number.isFinite(change) ? change : null;
}

export function formatTrend(change: number | null): string | null {
  if (change === null) return null;
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}% vs previous period`;
}

// --------------------------------------------------------------------- KPIs

export type KpiTone = "neutral" | "good" | "warn" | "critical";

export type Kpi = {
  id: string;
  label: string;
  value: string;
  context: string;
  tone: KpiTone;
  trend: string | null;
  href: string | null;
};

export type KpiInput = {
  range: DashboardRange;
  current: { orders: number; salesPaise: number };
  previous: { orders: number; salesPaise: number } | null;
  totals: DashboardPayload["totals"];
  payments: DashboardPayload["payments"];
};

/**
 * The eight command cards. Values come from aggregates; context sentences are
 * derived, never invented.
 */
export function buildKpis(input: KpiInput): Kpi[] {
  const { totals, payments, current, previous } = input;
  const orderTrend =
    previous === null
      ? null
      : formatTrend(percentageChange(current.orders, previous.orders));
  const salesTrend =
    previous === null
      ? null
      : formatTrend(percentageChange(current.salesPaise, previous.salesPaise));

  const paymentTotal = payments.paid + payments.pending + payments.unpaid + payments.failed;
  const paidShare = paymentTotal > 0 ? Math.round((payments.paid / paymentTotal) * 100) : null;

  return [
    {
      id: "orders",
      label: "Orders",
      value: formatCount(current.orders),
      context: `${RANGE_LABELS[input.range].toLowerCase()} · ${formatCount(totals.orders)} all time`,
      tone: "neutral",
      trend: orderTrend,
      href: "/admin/orders",
    },
    {
      id: "sales",
      label: "Sales",
      value: formatInrCompact(current.salesPaise),
      context: `${RANGE_LABELS[input.range].toLowerCase()} · ${formatInrCompact(totals.salesPaise)} all time`,
      tone: "neutral",
      trend: salesTrend,
      href: "/admin/reports",
    },
    {
      id: "pending-orders",
      label: "Pending Orders",
      value: formatCount(totals.pendingOrders),
      context: "Awaiting fulfilment",
      tone: totals.pendingOrders > 0 ? "warn" : "good",
      trend: null,
      href: "/admin/orders",
    },
    {
      id: "low-stock",
      label: "Low Stock",
      value: formatCount(totals.lowStockListings),
      context: `Listings at or below ${LOW_STOCK_THRESHOLD} units`,
      tone:
        totals.lowStockListings > 20
          ? "critical"
          : totals.lowStockListings > 0
            ? "warn"
            : "good",
      trend: null,
      href: "/admin/inventory",
    },
    {
      id: "returns",
      label: "Returns",
      value: formatCount(totals.openReturns),
      // No admin returns screen exists yet. The card is intentionally
      // non-navigable rather than linking to a page that would 404.
      context:
        totals.openReturns > 0
          ? "Open return / RMA requests · no admin screen yet"
          : "Open return / RMA requests",
      tone: totals.openReturns > 0 ? "warn" : "good",
      trend: null,
      href: null,
    },
    {
      id: "customers",
      label: "Customers",
      value: formatCount(totals.customers),
      context: "Registered buyer accounts",
      tone: "neutral",
      trend: null,
      href: "/admin/users",
    },
    {
      id: "payments",
      label: "Payments",
      value: formatCount(payments.paid),
      context:
        paidShare === null
          ? "No payment records yet"
          : `${paidShare}% settled · ${formatCount(payments.pending)} pending`,
      tone:
        payments.failed > 0
          ? "critical"
          : payments.pending > 0
            ? "warn"
            : "good",
      trend: null,
      href: "/admin/payments",
    },
    {
      id: "dealers",
      label: "Dealers",
      value: formatCount(totals.dealers),
      context:
        totals.dealersPendingApproval > 0
          ? `${formatCount(totals.dealersPendingApproval)} awaiting approval`
          : "All approved",
      tone: totals.dealersPendingApproval > 0 ? "warn" : "good",
      trend: null,
      href: "/admin/dealers",
    },
  ];
}

// ------------------------------------------------------------ quick actions

export type FeatureCategory =
  | "core"
  | "finance"
  | "business"
  | "logistics"
  | "catalogue"
  | "service";

export const FEATURE_CATEGORY_LABELS: Record<FeatureCategory, string> = {
  core: "Core Operations",
  finance: "Finance",
  business: "Business",
  logistics: "Logistics",
  catalogue: "Catalogue",
  service: "Service",
};

export const FEATURE_CATEGORY_ORDER: readonly FeatureCategory[] = [
  "core",
  "finance",
  "business",
  "logistics",
  "catalogue",
  "service",
];

export type AdminFeature = {
  id: string;
  label: string;
  href: string;
  description: string;
  category: FeatureCategory;
  /** Primary features fill the first row; the rest sit behind "View all". */
  primary: boolean;
};

/**
 * Single source of truth for the admin navigation hub.
 *
 * Every entry points at a real page in the admin route group. There is
 * deliberately no "Settings" entry: the project has no admin settings page, so
 * one is not invented. A test asserts every href resolves to a real route.
 */
export const ADMIN_FEATURES: readonly AdminFeature[] = [
  { id: "orders", label: "Orders", href: "/admin/orders", description: "Manage customer orders", category: "core", primary: true },
  { id: "inventory", label: "Inventory", href: "/admin/inventory", description: "Stock across warehouses", category: "core", primary: true },
  { id: "catalogue", label: "Products", href: "/admin/products", description: "Parts, listings and pricing", category: "core", primary: true },
  { id: "customers", label: "Customers", href: "/admin/users", description: "Buyers, dealers and accounts", category: "core", primary: true },

  { id: "payments", label: "Payments", href: "/admin/payments", description: "Collections and reconciliation", category: "finance", primary: true },
  { id: "reports", label: "Reports & Excel", href: "/admin/reports", description: "GST and sales summaries", category: "finance", primary: true },
  { id: "pricing-rules", label: "Pricing Rules", href: "/admin/pricing-rules", description: "Pricing logic by customer", category: "finance", primary: false },

  { id: "dealers", label: "Dealers & B2B", href: "/admin/dealers", description: "Onboarding, approval and credit", category: "business", primary: true },
  { id: "firms", label: "Firms", href: "/admin/firms", description: "Firm configuration and accounts", category: "business", primary: true },
  { id: "suppliers", label: "Suppliers", href: "/admin/suppliers", description: "Supplier master data", category: "business", primary: false },

  { id: "allocations", label: "Allocations", href: "/admin/allocations", description: "Firm order allocations", category: "logistics", primary: true },
  { id: "warehouses", label: "Warehouses", href: "/admin/warehouses", description: "Storage locations", category: "logistics", primary: false },
  { id: "purchase-orders", label: "Purchase Orders", href: "/admin/purchase-orders", description: "Raise and receive POs", category: "logistics", primary: false },
  { id: "goods-receipts", label: "Goods Receipts", href: "/admin/goods-receipts", description: "Receive supplier deliveries", category: "logistics", primary: false },

  { id: "listings", label: "Listings", href: "/admin/listings", description: "Dealer listing management", category: "catalogue", primary: false },
  { id: "import", label: "Import", href: "/admin/import", description: "Bulk catalogue import", category: "catalogue", primary: false },
  { id: "source-catalogue", label: "Source Catalogue", href: "/admin/source-catalogue", description: "Manufacturer catalogue sync", category: "catalogue", primary: false },
  { id: "ci-sync", label: "CI Sync", href: "/admin/ci-sync", description: "Catalogue integration approvals", category: "catalogue", primary: false },

  { id: "warranty", label: "Warranty & Claims", href: "/admin/credit", description: "Claims and dealer credit", category: "service", primary: true },

  { id: "stock-adjustments", label: "Stock Adjustments", href: "/admin/stock-adjustments", description: "Correct inventory levels", category: "core", primary: false },
  { id: "sales-orders", label: "Sales Orders", href: "/admin/sales-orders", description: "Firm-side sales documents", category: "business", primary: false },
  { id: "quotations", label: "Quotations", href: "/admin/quotations", description: "Customer quotations", category: "business", primary: false },
  { id: "bulk-orders", label: "Bulk Orders", href: "/admin/bulk-orders", description: "Multi-order processing", category: "core", primary: false },
];

export function adminFeatures(): AdminFeature[] {
  return [...ADMIN_FEATURES];
}

export function primaryFeatures(): AdminFeature[] {
  return ADMIN_FEATURES.filter((feature) => feature.primary);
}

export function secondaryFeatures(): AdminFeature[] {
  return ADMIN_FEATURES.filter((feature) => !feature.primary);
}

export function featuresByCategory(
  features: readonly AdminFeature[],
): Array<{ category: FeatureCategory; label: string; items: AdminFeature[] }> {
  return FEATURE_CATEGORY_ORDER.map((category) => ({
    category,
    label: FEATURE_CATEGORY_LABELS[category],
    items: features.filter((feature) => feature.category === category),
  })).filter((group) => group.items.length > 0);
}

export function quickActionsForRole(role: string | null | undefined): AdminFeature[] {
  if (role !== "admin") return [];
  return primaryFeatures();
}

// --------------------------------------------------------- attention alerts

export type AlertSeverity = "critical" | "action" | "pending" | "info";

export type DashboardAlert = {
  id: string;
  severity: AlertSeverity;
  label: string;
  count: number;
  /** null when no admin screen exists for this signal yet. */
  href: string | null;
};

export const SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 0,
  action: 1,
  pending: 2,
  info: 3,
};

/**
 * Operational alerts, all derived from counts. Zero-count alerts are dropped
 * so the panel never shows noise.
 */
export function buildAlerts(
  totals: DashboardPayload["totals"],
  payments: DashboardPayload["payments"],
): DashboardAlert[] {
  const candidates: DashboardAlert[] = [];

  if (totals.lowStockListings > 0) {
    candidates.push({
      id: "low-stock",
      severity: totals.lowStockListings > 20 ? "critical" : "action",
      label: `Low stock across ${totals.lowStockListings} listing${totals.lowStockListings === 1 ? "" : "s"}`,
      count: totals.lowStockListings,
      href: "/admin/inventory",
    });
  }

  if (totals.pendingOrders > 0) {
    candidates.push({
      id: "pending-orders",
      severity: "pending",
      label: `${totals.pendingOrders} order${totals.pendingOrders === 1 ? "" : "s"} awaiting fulfilment`,
      count: totals.pendingOrders,
      href: "/admin/orders",
    });
  }

  if (payments.pending > 0 || payments.unpaid > 0) {
    const count = payments.pending + payments.unpaid;
    candidates.push({
      id: "pending-payments",
      severity: "pending",
      label: `${count} payment${count === 1 ? "" : "s"} not yet settled`,
      count,
      href: "/admin/payments",
    });
  }

  if (totals.openReturns > 0) {
    candidates.push({
      id: "returns",
      severity: "action",
      label: `${totals.openReturns} open return request${totals.openReturns === 1 ? "" : "s"}`,
      count: totals.openReturns,
      // No admin returns screen exists; the signal is still shown but is
      // deliberately not linked to a page that would 404.
      href: null,
    });
  }

  if (totals.dealersPendingApproval > 0) {
    candidates.push({
      id: "dealer-approval",
      severity: "action",
      label: `${totals.dealersPendingApproval} dealer${totals.dealersPendingApproval === 1 ? "" : "s"} awaiting approval`,
      count: totals.dealersPendingApproval,
      href: "/admin/dealers",
    });
  }

  if (payments.failed > 0) {
    candidates.push({
      id: "failed-payments",
      severity: "critical",
      label: `${payments.failed} failed payment${payments.failed === 1 ? "" : "s"}`,
      count: payments.failed,
      href: "/admin/payments",
    });
  }

  return candidates.sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.count - a.count,
  );
}

// -------------------------------------------------------------- firm panels

export type FirmSummary = DashboardPayload["firms"][number] & {
  shareOfSales: number | null;
  shareOfOrders: number | null;
};

export function summariseFirms(
  firms: DashboardPayload["firms"],
  totals: { orders: number; salesPaise: number },
): FirmSummary[] {
  return firms.map((firm) => ({
    ...firm,
    shareOfSales:
      totals.salesPaise > 0
        ? Math.round((firm.salesPaise / totals.salesPaise) * 100)
        : null,
    shareOfOrders:
      totals.orders > 0 ? Math.round((firm.orders / totals.orders) * 100) : null,
  }));
}

// ------------------------------------------------------------ empty states

export type SectionState = "loading" | "error" | "empty" | "ready";

export function sectionState(input: {
  loading: boolean;
  error: string;
  hasData: boolean;
}): SectionState {
  if (input.loading) return "loading";
  if (input.error) return "error";
  if (!input.hasData) return "empty";
  return "ready";
}

export function emptyMessage(kind: "alerts" | "activity" | "orders" | "firms" | "chart"): string {
  switch (kind) {
    case "alerts":
      return "Nothing needs attention. Low stock, pending payments and open returns will appear here.";
    case "activity":
      return "No recorded admin activity yet. Actions such as stock adjustments and status changes will be listed here.";
    case "orders":
      return "No orders yet. Customer checkouts will appear here as soon as the first order is placed.";
    case "firms":
      return "No firm allocations yet. Firm performance appears once orders are allocated.";
    case "chart":
      return "No sales or order activity in this period yet. Try a longer range.";
  }
}
