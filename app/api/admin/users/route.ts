import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { user, order, customerProfile } from "@/drizzle/schema";
import { count, desc, eq } from "drizzle-orm";
import { applyInclusiveDiscount, parseDiscountPercentInput } from "@/lib/party-pricing";
import {
  getCommonCustomerDiscountPercent,
  getCustomerDiscountMap,
  setCustomerDiscountPercent,
} from "@/lib/customer-discount";
import {
  getCommonPensolConfig,
  getCustomerPensolConfigMap,
  setCustomerPensolConfig,
} from "@/lib/pensol-discount";
import { normalizePensolConfig } from "@/lib/pensol-pricing";
import { denyIfMustChangePassword } from "@/lib/require-role";

export async function GET() {
  const session = await getServerSession();

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await denyIfMustChangePassword(session.user.id);
  if (blocked) return blocked;

  const db = getDb();

  try {
    const users = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phoneNumber: user.phoneNumber,
        phoneNumberVerified: user.phoneNumberVerified,
        emailVerified: user.emailVerified,
        businessName: customerProfile.businessName,
        gstin: customerProfile.gstin,
        customerType: customerProfile.customerType,
        shippingAddressLine1: customerProfile.shippingAddressLine1,
        shippingCity: customerProfile.shippingCity,
        shippingState: customerProfile.shippingState,
        shippingPincode: customerProfile.shippingPincode,
        shippingPreference: customerProfile.shippingPreference,
        transportName: customerProfile.transportName,
        transportPhone: customerProfile.transportPhone,
        transportGstin: customerProfile.transportGstin,
        createdAt: user.createdAt,
      })
      .from(user)
      .leftJoin(customerProfile, eq(user.id, customerProfile.userId))
      .orderBy(desc(user.createdAt));

    const commonCustomerDiscountPercent = await getCommonCustomerDiscountPercent();
    const discountMap = await getCustomerDiscountMap(users.map((u) => u.id));

    const commonPensol = await getCommonPensolConfig();
    const pensolMap = await getCustomerPensolConfigMap(users.map((u) => u.id));

    // Get order count for each user
    const usersWithOrderCount = await Promise.all(
      users.map(async (u) => {
        const orderCountResult = await db
          .select({ count: count() })
          .from(order)
          .where(eq(order.buyerId, u.id));
        const customerDiscountPercent = discountMap.get(u.id) ?? null;
        const effectiveDiscountPercent =
          customerDiscountPercent !== null
            ? customerDiscountPercent
            : commonCustomerDiscountPercent;
        const preview = applyInclusiveDiscount(10000, effectiveDiscountPercent);
        return {
          ...u,
          orderCount: orderCountResult[0]?.count ?? 0,
          customerDiscountPercent,
          commonCustomerDiscountPercent,
          effectiveDiscountPercent,
          previewListPaise: 10000,
          previewNetInclusivePaise: preview.netInclusivePaise,
          pensol: pensolMap.get(u.id) ?? null,
          commonPensol,
        };
      }),
    );

    return NextResponse.json({
      users: usersWithOrderCount,
      commonCustomerDiscountPercent,
      commonPensol,
    });
  } catch (error) {
    console.error("Users fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load users" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession();

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await denyIfMustChangePassword(session.user.id);
  if (blocked) return blocked;

  const body = await request.json().catch(() => null);
  const userId = body?.userId;
  const action = body?.action; // "suspend" | "activate" | "set-discount"

  if (typeof userId !== "string" || !userId || !action) {
    return NextResponse.json(
      { error: "userId and valid action are required" },
      { status: 400 },
    );
  }

  const db = getDb();
  const targetUser = await db.query.user.findFirst({
    where: eq(user.id, userId),
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (action === "set-discount") {
    if (targetUser.role !== "buyer" && targetUser.role !== "suspended") {
      return NextResponse.json(
        { error: "Customer discounts can only be assigned to buyer accounts." },
        { status: 400 },
      );
    }
    const hasKey = body && Object.prototype.hasOwnProperty.call(body, "discountPercent");
    if (!hasKey) {
      return NextResponse.json(
        { error: "discountPercent is required (number or null to use common discount)." },
        { status: 400 },
      );
    }
    const parsed =
      body.discountPercent === null ? null : parseDiscountPercentInput(body.discountPercent);
    if (parsed === undefined) {
      return NextResponse.json(
        { error: "discountPercent must be an integer from 0 to 100, or null." },
        { status: 400 },
      );
    }
    const customerDiscountPercent = await setCustomerDiscountPercent(userId, parsed);
    const commonCustomerDiscountPercent = await getCommonCustomerDiscountPercent();
    const effectiveDiscountPercent =
      customerDiscountPercent !== null
        ? customerDiscountPercent
        : commonCustomerDiscountPercent;
    const preview = applyInclusiveDiscount(10000, effectiveDiscountPercent);
    return NextResponse.json({
      success: true,
      userId,
      customerDiscountPercent,
      commonCustomerDiscountPercent,
      effectiveDiscountPercent,
      previewNetInclusivePaise: preview.netInclusivePaise,
      message: customerDiscountPercent === null
        ? "Customer now uses the common customer discount."
        : `Customer discount set to ${customerDiscountPercent}% inclusive-tax.`,
    });
  }

  if (action === "set-pensol-discount") {
    if (targetUser.role !== "buyer" && targetUser.role !== "suspended") {
      return NextResponse.json(
        { error: "Pensol discounts can only be assigned to buyer accounts." },
        { status: 400 },
      );
    }
    const pensol = await setCustomerPensolConfig(
      userId,
      body?.pensol === null ? null : normalizePensolConfig(body?.pensol),
    );
    return NextResponse.json({
      success: true,
      userId,
      pensol,
      message: "Pensol cash/credit ₹/unit discounts updated.",
    });
  }

  if (action !== "suspend" && action !== "activate") {
    return NextResponse.json(
      { error: "userId and valid action ('suspend' | 'activate' | 'set-discount' | 'set-pensol-discount') are required" },
      { status: 400 },
    );
  }

  if (targetUser.role === "admin") {
    return NextResponse.json(
      { error: "Admin accounts cannot be suspended" },
      { status: 400 },
    );
  }

  const newRole = action === "suspend" ? "suspended" : "buyer";

  await db
    .update(user)
    .set({
      role: newRole,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));

  return NextResponse.json({
    success: true,
    userId,
    role: newRole,
    message:
      action === "suspend"
        ? `Customer ${targetUser.name || targetUser.email} has been suspended.`
        : `Customer ${targetUser.name || targetUser.email} has been reactivated.`,
  });
}
