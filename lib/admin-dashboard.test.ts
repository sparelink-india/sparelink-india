import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ADMIN_DISPLAY_NAME_MAX_LENGTH,
  BRAND_BURGUNDY,
  BRAND_NAVY,
  BRAND_ORANGE,
  DEFAULT_ADMIN_DISPLAY_NAME,
  DASHBOARD_RANGES,
  FEATURE_CATEGORY_LABELS,
  FEATURE_CATEGORY_ORDER,
  adminDisplayName,
  adminFeatures,
  buildAlerts,
  buildKpis,
  buildSeries,
  featuresByCategory,
  primaryFeatures,
  secondaryFeatures,
  emptyMessage,
  formatActivityAction,
  formatCount,
  formatInr,
  formatInrCompact,
  formatPaymentMethod,
  formatRelativeTime,
  greetingFor,
  hasChartableData,
  LOW_STOCK_THRESHOLD,
  percentageChange,
  quickActionsForRole,
  RANGE_LABELS,
  sectionState,
  summariseFirms,
  sumSeries,
  titleCase,
  type DashboardPayload,
} from "./admin-dashboard";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const bucket = (key: string, orders: number, salesPaise = 0) => ({
  key,
  orders,
  salesPaise,
});

const payload = {
  hourly: [bucket("a", 1, 100), bucket("b", 2, 200)],
  daily: [bucket("d1", 1, 10), bucket("d2", 2, 20), bucket("d3", 3, 30)],
  monthly: [bucket("2026-01", 5, 500)],
} satisfies Pick<DashboardPayload, "hourly" | "daily" | "monthly">;

const totals: DashboardPayload["totals"] = {
  orders: 40,
  salesPaise: 400_000,
  pendingOrders: 4,
  customers: 12,
  dealers: 5,
  dealersPendingApproval: 0,
  parts: 300,
  activeListings: 250,
  lowStockListings: 0,
  openReturns: 0,
};

const payments: DashboardPayload["payments"] = {
  paid: 20,
  pending: 4,
  unpaid: 2,
  failed: 0,
  paidPaise: 200_000,
};

describe("series and analytics windows", () => {
  it("exposes the four documented ranges", () => {
    assert.deepEqual([...DASHBOARD_RANGES], ["today", "7d", "30d", "12m"]);
    for (const range of DASHBOARD_RANGES) {
      assert.equal(typeof RANGE_LABELS[range], "string", range);
    }
  });

  it("selects the right buckets per range", () => {
    assert.deepEqual(buildSeries(payload, "today"), payload.hourly);
    assert.deepEqual(buildSeries(payload, "7d"), payload.daily);
    assert.deepEqual(buildSeries(payload, "30d"), payload.daily);
    assert.deepEqual(buildSeries(payload, "12m"), payload.monthly);
  });

  it("caps long ranges to the available window", () => {
    const long = { ...payload, monthly: Array.from({ length: 20 }, (_, i) => bucket(`m${i}`, 1)) };
    assert.equal(buildSeries(long, "12m").length, 12);
  });

  it("sums a series without inventing data", () => {
    assert.deepEqual(sumSeries(payload.daily), { orders: 6, salesPaise: 60 });
    assert.deepEqual(sumSeries([]), { orders: 0, salesPaise: 0 });
  });

  it("detects whether a chart is worth drawing", () => {
    assert.equal(hasChartableData(payload.daily), true);
    assert.equal(hasChartableData([bucket("x", 0, 0)]), false);
    assert.equal(hasChartableData([]), false);
  });
});

describe("trend honesty", () => {
  it("computes a real percentage change", () => {
    assert.equal(percentageChange(110, 100)?.toFixed(1), "10.0");
    assert.equal(percentageChange(90, 100)?.toFixed(1), "-10.0");
  });

  it("returns null rather than a fabricated percentage", () => {
    assert.equal(percentageChange(50, 0), null, "zero base cannot yield a percentage");
    assert.equal(percentageChange(Number.NaN, 10), null);
    assert.equal(percentageChange(10, Number.NaN), null);
  });

  it("omits the trend when no prior window is available", () => {
    const kpis = buildKpis({
      range: "30d",
      current: { orders: 10, salesPaise: 1000 },
      previous: null,
      totals,
      payments,
    });
    for (const kpi of kpis) assert.equal(kpi.trend, null, kpi.id);
  });

  it("shows a trend only when a prior window is supplied", () => {
    const kpis = buildKpis({
      range: "30d",
      current: { orders: 110, salesPaise: 1100 },
      previous: { orders: 100, salesPaise: 1000 },
      totals,
      payments,
    });
    const orders = kpis.find((k) => k.id === "orders");
    assert.match(orders?.trend ?? "", /vs previous period/);
  });
});

describe("KPI command cards", () => {
  const kpis = buildKpis({
    range: "30d",
    current: { orders: 7, salesPaise: 70_000 },
    previous: null,
    totals,
    payments,
  });

  it("builds the eight cards", () => {
    assert.equal(kpis.length, 8);
    assert.deepEqual(
      kpis.map((kpi) => kpi.id),
      [
        "orders",
        "sales",
        "pending-orders",
        "low-stock",
        "returns",
        "customers",
        "payments",
        "dealers",
      ],
    );
  });

  it("takes every value from the supplied aggregates", () => {
    const byId = Object.fromEntries(kpis.map((kpi) => [kpi.id, kpi]));
    assert.equal(byId.orders.value, "7");
    assert.equal(byId.sales.value, "₹700");
    assert.equal(byId["pending-orders"].value, "4");
    assert.equal(byId.customers.value, "12");
    assert.equal(byId.dealers.value, "5");
    assert.equal(byId.payments.value, "20");
  });

  it("derives the payment share from real counts", () => {
    const byId = Object.fromEntries(kpis.map((kpi) => [kpi.id, kpi]));
    // 20 paid of 26 total -> 77%
    assert.match(byId.payments.context, /77% settled/);
  });

  it("says so when there are no payment records", () => {
    const empty = buildKpis({
      range: "today",
      current: { orders: 0, salesPaise: 0 },
      previous: null,
      totals,
      payments: { paid: 0, pending: 0, unpaid: 0, failed: 0, paidPaise: 0 },
    });
    const paymentsKpi = empty.find((kpi) => kpi.id === "payments");
    assert.equal(paymentsKpi?.context, "No payment records yet");
  });

  it("marks low stock critical only above the threshold band", () => {
    const build = (lowStockListings: number) =>
      buildKpis({
        range: "7d",
        current: { orders: 0, salesPaise: 0 },
        previous: null,
        totals: { ...totals, lowStockListings },
        payments,
      }).find((kpi) => kpi.id === "low-stock");

    assert.equal(build(0)?.tone, "good");
    assert.equal(build(3)?.tone, "warn");
    assert.equal(build(30)?.tone, "critical");
  });

  it("links each card only to a route that actually exists", () => {
    for (const kpi of kpis) {
      if (kpi.href === null) continue;
      assert.match(kpi.href, /^\/admin\//, kpi.id);
      assert.ok(adminRouteExists(kpi.href), `${kpi.id} links to a missing route: ${kpi.href}`);
    }
  });

  it("leaves Returns unlinked because no admin returns screen exists", () => {
    const returnsKpi = kpis.find((kpi) => kpi.id === "returns");
    assert.equal(returnsKpi?.href, null, "must not link to a 404");
  });

  it("mentions the low stock rule rather than a magic number", () => {
    const lowStock = kpis.find((kpi) => kpi.id === "low-stock");
    assert.match(lowStock?.context ?? "", new RegExp(String(LOW_STOCK_THRESHOLD)));
  });
});

describe("feature categories and iconography", () => {
  it("groups every feature into a category with a label", () => {
    for (const feature of adminFeatures()) {
      assert.ok(
        FEATURE_CATEGORY_LABELS[feature.category],
        `${feature.id} has an unknown category`,
      );
    }
  });

  it("uses the categories the owner specified", () => {
    assert.deepEqual([...FEATURE_CATEGORY_ORDER], [
      "core",
      "finance",
      "business",
      "logistics",
      "catalogue",
      "service",
    ]);
  });

  it("drops empty groups and keeps the requested order", () => {
    const groups = featuresByCategory(primaryFeatures());
    assert.ok(groups.length > 0);
    // Categories with no primary feature are absent entirely, not -1 entries.
    const order = FEATURE_CATEGORY_ORDER.map((c) =>
      groups.findIndex((g) => g.category === c),
    ).filter((index) => index > -1);
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
    const total = groups.reduce((acc, g) => acc + g.items.length, 0);
    assert.equal(total, primaryFeatures().length, "no feature may be dropped");
  });

  it("places each feature in exactly one group", () => {
    const groups = featuresByCategory(adminFeatures());
    const ids = groups.flatMap((g) => g.items.map((i) => i.id));
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.length, adminFeatures().length);
  });

  it("maps every feature to a distinct semantic icon", () => {
    const map = source("components/admin-feature-icon.tsx");
    const block = map.slice(
      map.indexOf("const FEATURE_ICONS"),
      map.indexOf("export function featureIcon"),
    );
    const entries = [...block.matchAll(/^[ \t]*"?([a-z-]+)"?:[ \t]*(Icon\w+),/gm)].map((m) => ({
      id: m[1],
      icon: m[2],
    }));
    assert.equal(entries.length, adminFeatures().length, "every feature needs an icon");
    const icons = entries.map((e) => e.icon);
    assert.equal(
      new Set(icons).size,
      icons.length,
      "icons must be unique per feature — no generic reuse",
    );
    assert.deepEqual(
      [...entries.map((e) => e.id)].sort(),
      adminFeatures().map((f) => f.id).sort(),
    );
  });

  it("uses no emoji anywhere in the admin surface", () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
    for (const file of [
      "app/admin/page.tsx",
      "components/admin-shell.tsx",
      "components/admin-feature-icon.tsx",
      "components/admin-icons.tsx",
    ]) {
      const offenders = source(file).split("\n").filter((line) => emoji.test(line));
      assert.deepEqual(offenders, [], `${file}: ${offenders.join(" | ")}`);
    }
  });

  it("draws icons as inline SVG with one consistent stroke", () => {
    const icons = source("components/admin-icons.tsx");
    assert.match(icons, /viewBox="0 0 24 24"/);
    assert.match(icons, /strokeWidth=\{1\.75\}/);
    assert.match(icons, /aria-hidden="true"/);
    assert.ok((icons.match(/export const Icon\w+/g) ?? []).length >= 30);
  });

  it("adds hero depth with CSS only, never an image dependency", () => {
    const page = source("app/admin/page.tsx");
    assert.match(page, /radial-gradient/);
    assert.match(page, /linear-gradient/);
    assert.equal(
      /<img|url\(|next\/image/i.test(page),
      false,
      "no external or downloaded images allowed",
    );
  });

  it("gives the hero a two-column desktop composition", () => {
    const page = source("app/admin/page.tsx");
    assert.match(page, /lg:grid-cols-\[/);
    assert.match(page, /business command center/i);
  });

  it("uses accessible transition language and honours reduced motion", () => {
    const page = source("app/admin/page.tsx");
    const shell = source("components/admin-shell.tsx");
    assert.match(page, /motion-safe:animate-pulse/);
    assert.match(page, /hover:-translate-y/);
    assert.match(page, /focus-visible:ring-2/);
    assert.match(shell, /focus-visible:ring-2/);
  });
});

describe("admin features hub", () => {
  it("offers the ten primary features the owner asked for", () => {
    const primaries = primaryFeatures();
    assert.equal(primaries.length, 10);
    const hrefs = primaries.map((f) => f.href);
    for (const expected of [
      "/admin/orders",
      "/admin/products",
      "/admin/inventory",
      "/admin/users",
      "/admin/payments",
      "/admin/dealers",
      "/admin/credit",
      "/admin/reports",
      "/admin/firms",
      "/admin/allocations",
    ]) {
      assert.ok(hrefs.includes(expected), `missing feature ${expected}`);
    }
  });

  it("covers the rest of the console behind View All", () => {
    const extra = secondaryFeatures();
    assert.ok(extra.length > 0);
    assert.equal(
      primaryFeatures().length + extra.length,
      adminFeatures().length,
      "primary + secondary must equal the full list",
    );
  });

  it("links only to routes that actually exist", () => {
    for (const feature of adminFeatures()) {
      assert.match(feature.href, /^\/admin\//, feature.id);
      assert.ok(adminRouteExists(feature.href), `${feature.id} -> missing ${feature.href}`);
    }
  });

  it("does not invent a Settings feature", () => {
    assert.equal(
      adminFeatures().some((f) => /setting/i.test(f.label) || /setting/i.test(f.href)),
      false,
      "the project has no admin settings page; none may be invented",
    );
  });

  it("gives every feature a one-line description", () => {
    for (const feature of adminFeatures()) {
      assert.ok(feature.description.length > 8, feature.id);
      assert.ok(feature.label.length > 0, feature.id);
    }
  });

  it("has no duplicate feature ids or routes", () => {
    const ids = adminFeatures().map((f) => f.id);
    const hrefs = adminFeatures().map((f) => f.href);
    assert.equal(new Set(ids).size, ids.length, "duplicate feature id");
    assert.equal(new Set(hrefs).size, hrefs.length, "duplicate feature href");
  });

  it("gates the hub by role like the rest of the console", () => {
    assert.equal(quickActionsForRole("admin").length, primaryFeatures().length);
    for (const role of ["buyer", "dealer", "suspended", null, undefined, ""]) {
      assert.deepEqual(quickActionsForRole(role), [], String(role));
    }
  });
});

describe("quick actions are role gated", () => {
  it("gives admin the full primary feature set", () => {
    const actions = quickActionsForRole("admin");
    assert.equal(actions.length, primaryFeatures().length);
    for (const action of actions) assert.match(action.href, /^\/admin\//);
  });

  it("returns nothing for any other role or no role", () => {
    for (const role of ["buyer", "dealer", "suspended", null, undefined, ""]) {
      assert.deepEqual(quickActionsForRole(role), [], String(role));
    }
  });

  it("points at routes that already exist", () => {
    for (const action of quickActionsForRole("admin")) {
      assert.ok(adminRouteExists(action.href), `${action.href} has no page or route`);
    }
  });
});

/** True when `app/<href>/page.tsx` exists. Guards against linking to a 404. */
function adminRouteExists(href: string): boolean {
  try {
    const file = join(root, "app", href.replace(/^\//, ""), "page.tsx");
    return readFileSync(file).length >= 0;
  } catch {
    return false;
  }
}

describe("attention alerts", () => {
  const healthyTotals: DashboardPayload["totals"] = {
    ...totals,
    pendingOrders: 0,
    lowStockListings: 0,
    openReturns: 0,
    dealersPendingApproval: 0,
  };

  const healthyPayments: DashboardPayload["payments"] = {
    paid: 26,
    pending: 0,
    unpaid: 0,
    failed: 0,
    paidPaise: 200_000,
  };

  it("returns nothing when everything is healthy", () => {
    assert.deepEqual(buildAlerts(healthyTotals, healthyPayments), []);
  });

  it("raises an alert for each real operational signal", () => {
    const alerts = buildAlerts(
      { ...totals, lowStockListings: 30, pendingOrders: 4, openReturns: 2, dealersPendingApproval: 1 },
      { ...payments, failed: 3, pending: 4, unpaid: 2 },
    );
    const ids = alerts.map((a) => a.id).sort();
    assert.deepEqual(ids, [
      "dealer-approval",
      "failed-payments",
      "low-stock",
      "pending-orders",
      "pending-payments",
      "returns",
    ]);
  });

  it("sorts by severity then volume", () => {
    const alerts = buildAlerts(
      { ...healthyTotals, lowStockListings: 2, openReturns: 1, pendingOrders: 1 },
      healthyPayments,
    );
    const severities = alerts.map((a) => a.severity);
    assert.equal(severities[0], "action", "action outranks pending");
  });

  it("escalates low stock to critical when severe", () => {
    const [alert] = buildAlerts({ ...healthyTotals, lowStockListings: 30 }, healthyPayments);
    assert.equal(alert?.severity, "critical");
  });

  it("never invents an alert for a zero count", () => {
    const alerts = buildAlerts(healthyTotals, healthyPayments);
    assert.equal(
      alerts.some((a) => a.id === "pending-orders"),
      false,
    );
  });

  it("links every alert only to a route that actually exists", () => {
    const alerts = buildAlerts(
      { ...healthyTotals, lowStockListings: 1, openReturns: 1, pendingOrders: 1 },
      { ...healthyPayments, pending: 2 },
    );
    for (const alert of alerts) {
      if (alert.href === null) continue;
      assert.match(alert.href, /^\/admin\//, alert.id);
      assert.ok(adminRouteExists(alert.href), `${alert.id} -> missing ${alert.href}`);
    }
  });

  it("keeps the returns signal visible but unlinked", () => {
    const alerts = buildAlerts({ ...healthyTotals, openReturns: 2 }, healthyPayments);
    const returnsAlert = alerts.find((alert) => alert.id === "returns");
    assert.ok(returnsAlert, "returns alert must still be shown");
    assert.equal(returnsAlert?.href, null);
  });
});

describe("firm summaries", () => {
  it("adds share of sales and orders from real totals", () => {
    const firms = summariseFirms(
      [
        { firmId: "a", firmName: "A", firmCode: "A", orders: 3, salesPaise: 750, pending: 1 },
        { firmId: "b", firmName: "B", firmCode: "B", orders: 1, salesPaise: 250, pending: 0 },
      ],
      { orders: 4, salesPaise: 1000 },
    );
    assert.equal(firms[0].shareOfSales, 75);
    assert.equal(firms[1].shareOfSales, 25);
    assert.equal(firms[0].shareOfOrders, 75);
  });

  it("returns null share when the total is zero", () => {
    const [firm] = summariseFirms(
      [{ firmId: "a", firmName: "A", firmCode: null, orders: 0, salesPaise: 0, pending: 0 }],
      { orders: 0, salesPaise: 0 },
    );
    assert.equal(firm?.shareOfSales, null);
    assert.equal(firm?.shareOfOrders, null);
  });

  it("handles an empty firm list", () => {
    assert.deepEqual(summariseFirms([], { orders: 0, salesPaise: 0 }), []);
  });
});

describe("activity mapping", () => {
  it("maps known actions to readable labels", () => {
    assert.equal(formatActivityAction("order.status_update"), "Order status updated");
    assert.equal(formatActivityAction("inventory.quantity_update"), "Stock adjusted");
    assert.equal(formatActivityAction("admin.role_change"), "Admin role changed");
  });

  it("never drops an unknown action", () => {
    assert.equal(formatActivityAction("some.unknown_action"), "Some unknown action");
    assert.equal(formatActivityAction(""), "Activity");
    assert.equal(formatActivityAction(null), "Activity");
  });
});

describe("formatting", () => {
  it("formats compact Indian currency", () => {
    assert.equal(formatInrCompact(482_00_000), "₹4.82L");
    assert.equal(formatInrCompact(12_34_000), "₹12.3K");
    assert.equal(formatInrCompact(0), "₹0");
    assert.equal(formatInrCompact(null), "₹0");
  });

  it("formats precise currency and counts", () => {
    assert.equal(formatInr(2500), "₹25.00");
    assert.equal(formatCount(1234), "1,234");
    assert.equal(formatCount(null), "—");
  });

  it("formats payment methods", () => {
    assert.equal(formatPaymentMethod("cash_on_delivery"), "COD");
    assert.equal(formatPaymentMethod("bank_transfer"), "Bank Transfer");
    assert.equal(formatPaymentMethod("online_payment"), "Online");
    assert.equal(formatPaymentMethod(null), "—");
  });

  it("title cases safely", () => {
    assert.equal(titleCase("placed"), "Placed");
    assert.equal(titleCase(""), "Unknown");
  });

  it("formats relative time and greeting", () => {
    const now = new Date("2026-09-26T12:00:00Z");
    assert.equal(formatRelativeTime("2026-09-26T11:59:30Z", now), "just now");
    assert.equal(formatRelativeTime("2026-09-26T11:30:00Z", now), "30m ago");
    assert.equal(formatRelativeTime("2026-09-26T09:00:00Z", now), "3h ago");
    assert.equal(formatRelativeTime("2026-09-24T12:00:00Z", now), "2d ago");
    assert.equal(formatRelativeTime(null, now), "");
    assert.equal(greetingFor(new Date("2026-09-26T08:00:00")), "Good morning");
    assert.equal(greetingFor(new Date("2026-09-26T14:00:00")), "Good afternoon");
    assert.equal(greetingFor(new Date("2026-09-26T20:00:00")), "Good evening");
  });
});

describe("admin greeting display name", () => {
  it("uses the authenticated admin's name when available", () => {
    assert.equal(adminDisplayName("Ansh Anand"), "Ansh Anand");
    assert.equal(adminDisplayName("SPARELINK INDIA"), "SPARELINK INDIA");
  });

  it("trims surrounding whitespace", () => {
    assert.equal(adminDisplayName("  Ansh Anand  "), "Ansh Anand");
  });

  it("falls back to the business name when unavailable or empty", () => {
    for (const value of [null, undefined, "", "   "]) {
      assert.equal(adminDisplayName(value), DEFAULT_ADMIN_DISPLAY_NAME, String(value));
    }
    assert.equal(DEFAULT_ADMIN_DISPLAY_NAME, "SPARELINK INDIA");
  });

  it("caps an overlong name so the greeting cannot break the layout", () => {
    const long = "a".repeat(200);
    const result = adminDisplayName(long);
    assert.equal(result.length, ADMIN_DISPLAY_NAME_MAX_LENGTH);
    assert.ok(result.endsWith("…"));
  });

  it("does not shorten a name at the limit", () => {
    const exact = "b".repeat(ADMIN_DISPLAY_NAME_MAX_LENGTH);
    assert.equal(adminDisplayName(exact), exact);
  });

  it("is derived from the existing stats response, with no extra request", () => {
    const page = source("app/admin/page.tsx");
    const stats = source("app/api/admin/stats/route.ts");
    assert.match(page, /adminDisplayName\(data\?\.adminDisplayName\)/);
    assert.match(stats, /adminDisplayName: session\.user\.name\?\.trim\(\) \|\| null/);
    // Still exactly one fetch in the dashboard.
    assert.equal((page.match(/fetch\(/g) ?? []).length, 1);
  });

  it("never exposes the admin email address in the greeting", () => {
    const page = source("app/admin/page.tsx");
    const stats = source("app/api/admin/stats/route.ts");
    // buyerEmail is legitimate for order rows; the greeting must not use it.
    const greeting = page.slice(page.indexOf("const displayName"), page.indexOf("return ("));
    assert.equal(/email/i.test(greeting), false);
    // The stats response must not put the viewer's own email in the payload.
    assert.equal(/session\.user\.email/.test(stats), false);
  });
});

describe("section states", () => {
  it("prefers loading, then error, then empty, then ready", () => {
    assert.equal(sectionState({ loading: true, error: "x", hasData: true }), "loading");
    assert.equal(sectionState({ loading: false, error: "x", hasData: true }), "error");
    assert.equal(sectionState({ loading: false, error: "", hasData: false }), "empty");
    assert.equal(sectionState({ loading: false, error: "", hasData: true }), "ready");
  });

  it("has a distinct empty message per section", () => {
    const messages = (["alerts", "activity", "orders", "firms", "chart"] as const).map(
      emptyMessage,
    );
    assert.equal(new Set(messages).size, 5, "empty states must not be identical");
    for (const message of messages) assert.ok(message.length > 20, message);
  });
});

describe("no fabricated data in the page", () => {
  const page = source("app/admin/page.tsx");

  it("has no hard-coded counts in rendered values", () => {
    assert.equal(/value=\{?\d{2,}\}?/.test(page), false);
  });

  it("renders a prominent Features section from the shared hub", () => {
    assert.match(page, /aria-label="Admin features"/);
    assert.match(page, /title="Features"/);
    assert.match(page, /View All Features/);
    assert.match(page, /primaryFeatures|adminFeatures|visibleFeatures/);
    assert.match(page, /FeatureBlock/);
    assert.match(page, /featuresByCategory/);
  });

  it("lays sections out in the requested order", () => {
    const order = [
      'aria-label="Admin features"',
      'aria-label="Key performance indicators"',
      'aria-label="Sales and order analytics"',
      'aria-label="Attention required"',
      'aria-label="Firm performance"',
      'aria-label="Recent orders"',
    ].map((needle) => page.indexOf(needle));
    for (const index of order) assert.ok(index > -1, "missing section");
    assert.deepEqual(order, [...order].sort((a, b) => a - b), "section order");
  });

  it("renders a hero with greeting, subtitle, date and actions", () => {
    assert.match(page, /business command center/i);
    assert.match(page, /greetingFor\(now\)/);
    assert.match(page, /displayName/);
    assert.match(page, /toLocaleDateString\("en-IN"/);
    assert.match(page, /Manage Orders/);
  });

  it("gives analytics a dominant split layout", () => {
    assert.match(page, /Sales overview/);
    assert.match(page, /Order activity/);
    assert.match(page, /lg:grid-cols-\[1\.6fr_1fr\]/);
    assert.match(page, /h-56/);
  });

  it("links View All Orders to the orders dashboard", () => {
    assert.match(page, />\s*View All\s*</);
    assert.match(page, /href="\/admin\/orders"/);
  });

  it("draws charts without a chart library", () => {
    assert.match(page, /function BarChart/);
    assert.equal(/recharts|chart\.js|from "d3"/i.test(page), false, "no chart library");
  });

  it("reads every figure from the stats payload", () => {
    assert.match(page, /fetch\("\/api\/admin\/stats", \{ cache: "no-store" \}\)/);
    assert.match(page, /buildKpis\(/);
    assert.match(page, /buildAlerts\(/);
    assert.match(page, /summariseFirms\(/);
  });

  it("makes exactly one dashboard request", () => {
    const calls = page.match(/fetch\(/g) ?? [];
    assert.equal(calls.length, 1, "the dashboard must not fan out into many requests");
    assert.equal((source("components/admin-shell.tsx").match(/fetch\(/g) ?? []).length, 0);
  });

  it("renders skeletons for every loading section", () => {
    assert.ok((page.match(/<Skeleton/g) ?? []).length >= 4);
  });

  it("respects reduced motion and keeps accessibility affordances", () => {
    assert.match(page, /motion-safe:animate-pulse/);
    assert.equal(
      /animate-pulse(?![\w-])/.test(page.replace(/motion-safe:animate-pulse/g, "")),
      false,
      "no animation may run without a motion-safe guard",
    );
    assert.match(page, /aria-label=/);
    assert.match(page, /role="alert"/);
    assert.match(page, /aria-pressed=/);
    assert.match(page, /<h2/);
    // The screen-reader label for the command-bar search now lives in the shell.
    assert.match(`${page}${source("components/admin-shell.tsx")}`, /sr-only/);
  });

  it("is responsive and prevents horizontal page overflow", () => {
    assert.match(page, /overflow-x-auto/);
    assert.match(page, /min-w-\[46rem\]/);
    assert.match(page, /grid-cols-1 sm:grid-cols-2/);
  });
});

describe("admin application shell", () => {
  const shell = () => source("components/admin-shell.tsx");

  it("renders a persistent desktop navigation rail", () => {
    const s = shell();
    assert.match(s, /<aside className="fixed inset-y-0 left-0 z-40 hidden w-\[248px\] lg:block">/);
    assert.match(s, /<nav aria-label="Admin modules"/);
  });

  it("carries brand and admin command-center identity", () => {
    const s = shell();
    assert.match(s, /BrandLogo/);
    assert.match(s, /SpareLink India/);
    assert.match(s, /Command Center/);
  });

  it("marks the dashboard as the active nav item", () => {
    const s = shell();
    assert.match(s, /aria-current=\{active \? "page" : undefined\}/);
    assert.match(s, /label: "Dashboard"/);
    assert.match(s, /activeHref="\/admin"/);
  });

  it("groups navigation by the same feature categories", () => {
    const s = shell();
    assert.match(s, /featuresByCategory\(adminFeatures\(\)\)/);
  });

  it("renders a sticky command bar with search, action, alerts and sign out", () => {
    const s = shell();
    assert.match(s, /sticky top-0 z-30/);
    assert.match(s, /admin-global-search/);
    assert.match(s, /New Order/);
    assert.match(s, /SignOutButton/);
    assert.match(s, /IconBell/);
  });

  it("turns the rail into a mobile drawer rather than a shrunken sidebar", () => {
    const s = shell();
    assert.match(s, /drawerOpen/);
    assert.match(s, /Open navigation/);
    assert.match(s, /lg:hidden/);
    assert.match(s, /max-w-\[300px\]/);
    assert.match(s, /event\.key === "Escape"/);
  });

  it("the page is content inside the shell, not its own page frame", () => {
    assert.match(source("app/admin/page.tsx"), /<AdminShell alertCount=\{alerts\.length\}>/);
  });

  it("the shell makes no request of its own", () => {
    const s = shell();
    assert.equal((s.match(/fetch\(/g) ?? []).length, 0, "the shell must not fetch");
    // The only effect in the shell is the Escape-to-close drawer handler.
    const effects = [...s.matchAll(/useEffect\(/g)];
    assert.equal(effects.length, 1, "the shell should run exactly one effect");
  });
});

describe("brand identity", () => {
  it("uses the SpareLink identity colours, via the shared constants", () => {
    const page = source("app/admin/page.tsx");
    const shell = source("components/admin-shell.tsx");
    assert.match(page, /BRAND_BURGUNDY/);
    assert.match(page, /BRAND_NAVY/);
    assert.match(page, /BRAND_ORANGE/);
    assert.match(shell, /BRAND_BURGUNDY/);
    assert.match(shell, /BRAND_ORANGE/);
    // The constants hold the brand values, defined once.
    assert.equal(BRAND_BURGUNDY, "#7a1233");
    assert.equal(BRAND_NAVY, "#0f172a");
    assert.equal(BRAND_ORANGE, "#c2410c");
  });
});
