import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { denyIfMustChangePassword } from "@/lib/require-role";
import {
  firm,
  dealer,
  part,
  dealerListing,
  order,
  firmOrder,
  inventory,
  user,
  auditLog,
  returnRequest,
} from "@/drizzle/schema";
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  notInArray,
  sql,
  sum,
} from "drizzle-orm";
import { LOW_STOCK_THRESHOLD, type Bucket } from "@/lib/admin-dashboard";

/**
 * Admin dashboard aggregate.
 *
 * The six original summary fields are preserved exactly as before. The
 * `dashboard` object is additive and powers the Admin Command Center.
 *
 * Every figure is a database aggregate: no order rows are loaded into
 * application memory in order to be counted, and the entire dashboard is
 * served by this single request.
 */

const RECENT_ORDER_LIMIT = 8;
const ACTIVITY_LIMIT = 12;

/** Statuses excluded from sales and revenue: the goods/claim are void. */
const VOID_ORDER_STATUSES = ["cancelled", "returned"] as const;

/** Statuses that still need operational work. */
const PENDING_ORDER_STATUSES = [
  "placed",
  "pending",
  "confirmed",
  "processing",
  "packed",
] as const;

const OPEN_RETURN_STATUSES = ["submitted", "under_review", "approved"] as const;

const MONTH_MS = 1000 * 60 * 60 * 24 * 30.44;

type PaymentRow = { status: string; value: number; paidPaise: string | number | null };
type AllocRow = { firmId: string; status: string | null; value: number; amount: string | number | null };

export async function GET() {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const blocked = await denyIfMustChangePassword(session.user.id);
  if (blocked) return blocked;

  const db = getDb();
  const now = new Date();

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startHourly = new Date(startOfToday.getTime() - 23 * 60 * 60 * 1000);
  const startDaily = new Date(startOfToday.getTime() - 29 * 24 * 60 * 60 * 1000);
  const startMonthly = new Date(now.getTime() - 11 * MONTH_MS);

  const hourExpr = sql<string>`to_char(date_trunc('hour', ${order.createdAt} AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24')`;
  const dayExpr = sql<string>`to_char(${order.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;
  const monthExpr = sql<string>`to_char(${order.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM')`;

  try {
    const recentOrders = await db
      .select({
        id: order.id,
        orderNumber: order.orderNumber,
        buyerEmail: user.email,
        totalPaise: order.totalPaise,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        status: order.status,
        createdAt: order.createdAt,
      })
      .from(order)
      .innerJoin(user, eq(user.id, order.buyerId))
      .orderBy(desc(order.createdAt))
      .limit(RECENT_ORDER_LIMIT);

    const recentOrderIds = recentOrders.map((row) => row.id);

    const [
      firmStats,
      dealerStats,
      partStats,
      listingStats,
      orderStats,
      pendingOrders,
      lowStockRows,
      customerStats,
      pendingDealers,
      openReturns,
      paymentRows,
      hourlyRows,
      dailyRows,
      monthlyRows,
      firmList,
      allocationRows,
      recentFirmRows,
      activityRows,
      salesRows,
    ] = await Promise.all([
      db.select({ value: count() }).from(firm),
      db.select({ value: count() }).from(dealer),
      db.select({ value: count() }).from(part),
      db
        .select({ value: count() })
        .from(dealerListing)
        .where(eq(dealerListing.status, "active")),
      db.select({ value: count() }).from(order),
      db
        .select({ value: count() })
        .from(order)
        .where(inArray(order.status, PENDING_ORDER_STATUSES)),
      db
        .select({ value: count() })
        .from(inventory)
        .innerJoin(dealerListing, eq(dealerListing.id, inventory.dealerListingId))
        .where(
          and(
            eq(dealerListing.status, "active"),
            lte(inventory.quantity, LOW_STOCK_THRESHOLD),
          ),
        ),
      db.select({ value: count() }).from(user).where(eq(user.role, "buyer")),
      db
        .select({ value: count() })
        .from(dealer)
        .where(eq(dealer.approvalStatus, "pending")),
      db
        .select({ value: count() })
        .from(returnRequest)
        .where(inArray(returnRequest.status, OPEN_RETURN_STATUSES)),
      db
        .select({
          status: order.paymentStatus,
          value: count(),
          paidPaise: sum(order.totalPaise),
        })
        .from(order)
        .groupBy(order.paymentStatus),
      db
        .select({ key: hourExpr, value: count(), salesPaise: sum(order.totalPaise) })
        .from(order)
        .where(gte(order.createdAt, startHourly))
        .groupBy(hourExpr),
      db
        .select({ key: dayExpr, value: count(), salesPaise: sum(order.totalPaise) })
        .from(order)
        .where(gte(order.createdAt, startDaily))
        .groupBy(dayExpr),
      db
        .select({ key: monthExpr, value: count(), salesPaise: sum(order.totalPaise) })
        .from(order)
        .where(gte(order.createdAt, startMonthly))
        .groupBy(monthExpr),
      db.select({ id: firm.id, name: firm.name, code: firm.code }).from(firm),
      db
        .select({
          firmId: firmOrder.firmId,
          status: firmOrder.fulfillmentStatus,
          value: count(),
          amount: sum(firmOrder.amountPaise),
        })
        .from(firmOrder)
        .groupBy(firmOrder.firmId, firmOrder.fulfillmentStatus),
      recentOrderIds.length
        ? db
            .select({ orderId: firmOrder.orderId, firmName: firm.name })
            .from(firmOrder)
            .innerJoin(firm, eq(firm.id, firmOrder.firmId))
            .where(inArray(firmOrder.orderId, recentOrderIds))
        : Promise.resolve([] as Array<{ orderId: string; firmName: string }>),
      db
        .select({
          id: auditLog.id,
          action: auditLog.action,
          entityType: auditLog.entityType,
          entityId: auditLog.entityId,
          createdAt: auditLog.createdAt,
        })
        .from(auditLog)
        .orderBy(desc(auditLog.createdAt))
        .limit(ACTIVITY_LIMIT),
      db
        .select({ totalPaise: order.totalPaise })
        .from(order)
        .where(notInArray(order.status, [...VOID_ORDER_STATUSES])),
    ]);

    const toBuckets = (
      rows: Array<{ key: string; value: number; salesPaise: string | number | null }>,
    ): Bucket[] =>
      rows
        .map((row) => ({
          key: row.key,
          orders: Number(row.value ?? 0),
          salesPaise: Number(row.salesPaise ?? 0),
        }))
        .sort((a, b) => a.key.localeCompare(b.key));

    const paymentByStatus = (status: string) =>
      (paymentRows as PaymentRow[]).find(
        (row) => (row.status ?? "").toLowerCase() === status,
      );

    // Aggregate the small (firm x status) matrix in JS rather than with raw SQL.
    const allocationsByFirm = new Map<string, AllocRow[]>();
    for (const row of allocationRows as AllocRow[]) {
      const list = allocationsByFirm.get(row.firmId) ?? [];
      list.push(row);
      allocationsByFirm.set(row.firmId, list);
    }

    const firms = firmList.map((row) => {
      const rows = allocationsByFirm.get(row.id) ?? [];
      const orders = rows.reduce((acc, r) => acc + Number(r.value ?? 0), 0);
      const salesPaise = rows.reduce((acc, r) => acc + Number(r.amount ?? 0), 0);
      const pending = rows.reduce(
        (acc, r) =>
          PENDING_ORDER_STATUSES.includes((r.status ?? "") as never)
            ? acc + Number(r.value ?? 0)
            : acc,
        0,
      );
      return {
        firmId: row.id,
        firmName: row.name,
        firmCode: row.code ?? null,
        orders,
        salesPaise,
        pending,
      };
    });

    const firmNamesByOrder = new Map<string, string[]>();
    for (const row of recentFirmRows) {
      const list = firmNamesByOrder.get(row.orderId) ?? [];
      if (!list.includes(row.firmName)) list.push(row.firmName);
      firmNamesByOrder.set(row.orderId, list);
    }

    const totalRevenue = salesRows.reduce((acc, row) => acc + row.totalPaise, 0);

    return NextResponse.json({
      // Preserved original fields.
      totalFirms: firmStats[0]?.value ?? 0,
      totalDealers: dealerStats[0]?.value ?? 0,
      totalParts: partStats[0]?.value ?? 0,
      activeListings: listingStats[0]?.value ?? 0,
      totalOrders: orderStats[0]?.value ?? 0,
      totalRevenue,

      // Greeting display name for the already-authenticated admin only.
      // This is the session user's own name; the email address is never sent.
      adminDisplayName: session.user.name?.trim() || null,

      dashboard: {
        generatedAt: now.toISOString(),
        totals: {
          orders: orderStats[0]?.value ?? 0,
          salesPaise: totalRevenue,
          pendingOrders: pendingOrders[0]?.value ?? 0,
          customers: customerStats[0]?.value ?? 0,
          dealers: dealerStats[0]?.value ?? 0,
          dealersPendingApproval: pendingDealers[0]?.value ?? 0,
          parts: partStats[0]?.value ?? 0,
          activeListings: listingStats[0]?.value ?? 0,
          lowStockListings: lowStockRows[0]?.value ?? 0,
          openReturns: openReturns[0]?.value ?? 0,
        },
        payments: {
          paid: paymentByStatus("paid")?.value ?? 0,
          pending: paymentByStatus("pending")?.value ?? 0,
          unpaid: paymentByStatus("unpaid")?.value ?? 0,
          failed: paymentByStatus("failed")?.value ?? 0,
          paidPaise: Number(paymentByStatus("paid")?.paidPaise ?? 0),
        },
        hourly: toBuckets(hourlyRows),
        daily: toBuckets(dailyRows),
        monthly: toBuckets(monthlyRows),
        firms,
        recentOrders: recentOrders.map((row) => ({
          id: row.id,
          orderNumber: row.orderNumber,
          buyerEmail: row.buyerEmail,
          totalPaise: row.totalPaise,
          paymentStatus: row.paymentStatus,
          paymentMethod: row.paymentMethod,
          status: row.status,
          createdAt: row.createdAt,
          firmNames: firmNamesByOrder.get(row.id) ?? [],
        })),
        activity: activityRows.map((row) => ({
          id: row.id,
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          createdAt: row.createdAt,
        })),
        allocationTotals: {
          orders: firms.reduce((acc, f) => acc + f.orders, 0),
          salesPaise: firms.reduce((acc, f) => acc + f.salesPaise, 0),
        },
      },
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "Failed to load statistics" },
      { status: 500 },
    );
  }
}
