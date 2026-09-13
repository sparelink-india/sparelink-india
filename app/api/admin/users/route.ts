import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { user, order, customerProfile } from "@/drizzle/schema";
import { count, desc, eq } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession();

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    // Get order count for each user
    const usersWithOrderCount = await Promise.all(
      users.map(async (u) => {
        const orderCountResult = await db
          .select({ count: count() })
          .from(order)
          .where(eq(order.buyerId, u.id));
        return {
          ...u,
          orderCount: orderCountResult[0]?.count ?? 0,
        };
      }),
    );

    return NextResponse.json({ users: usersWithOrderCount });
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

  const body = await request.json().catch(() => null);
  const userId = body?.userId;
  const action = body?.action; // "suspend" | "activate"

  if (typeof userId !== "string" || !userId || !action) {
    return NextResponse.json(
      { error: "userId and valid action ('suspend' | 'activate') are required" },
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
