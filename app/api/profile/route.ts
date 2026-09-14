import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { customerProfile, user } from "@/drizzle/schema";
import { validateGSTIN } from "@/lib/gst";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const userData = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
  });

  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const profile = await db.query.customerProfile.findFirst({
    where: eq(customerProfile.userId, session.user.id),
  });

  return NextResponse.json({
    id: userData.id,
    contactName: profile?.contactName || userData.name,
    businessName: profile?.businessName || "",
    phoneNumber: userData.phoneNumber,
    phoneNumberVerified: userData.phoneNumberVerified,
    email: userData.email,
    gstin: profile?.gstin || "",
    customerType: profile?.customerType || (profile?.gstin ? "b2b" : "b2c"),
    billingAddressLine1: profile?.billingAddressLine1 || "",
    billingAddressLine2: profile?.billingAddressLine2 || "",
    billingCity: profile?.billingCity || "",
    billingState: profile?.billingState || "",
    billingPincode: profile?.billingPincode || "",
    shippingAddressLine1: profile?.shippingAddressLine1 || "",
    shippingAddressLine2: profile?.shippingAddressLine2 || "",
    shippingCity: profile?.shippingCity || "",
    shippingState: profile?.shippingState || "",
    shippingPincode: profile?.shippingPincode || "",
    shippingPreference: profile?.shippingPreference || "courier",
    transportName: profile?.transportName || "",
    transportPhone: profile?.transportPhone || "",
    transportGstin: profile?.transportGstin || "",
    createdAt: userData.createdAt,
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const db = getDb();

  const contactName = typeof body.contactName === "string" ? body.contactName.trim() : undefined;
  const businessName = typeof body.businessName === "string" ? body.businessName.trim() : undefined;
  const rawGstin = typeof body.gstin === "string" ? body.gstin.trim().toUpperCase() : undefined;
  const billingAddressLine1 = typeof body.billingAddressLine1 === "string" ? body.billingAddressLine1.trim() : undefined;
  const billingAddressLine2 = typeof body.billingAddressLine2 === "string" ? body.billingAddressLine2.trim() : undefined;
  const billingCity = typeof body.billingCity === "string" ? body.billingCity.trim() : undefined;
  const billingState = typeof body.billingState === "string" ? body.billingState.trim() : undefined;
  const billingPincode = typeof body.billingPincode === "string" ? body.billingPincode.trim() : undefined;
  const shippingAddressLine1 = typeof body.shippingAddressLine1 === "string" ? body.shippingAddressLine1.trim() : undefined;
  const shippingAddressLine2 = typeof body.shippingAddressLine2 === "string" ? body.shippingAddressLine2.trim() : undefined;
  const shippingCity = typeof body.shippingCity === "string" ? body.shippingCity.trim() : undefined;
  const shippingState = typeof body.shippingState === "string" ? body.shippingState.trim() : undefined;
  const shippingPincode = typeof body.shippingPincode === "string" ? body.shippingPincode.trim() : undefined;
  const shippingPreference = ["self_pickup", "transport", "courier"].includes(body.shippingPreference)
    ? body.shippingPreference
    : undefined;
  const transportName = typeof body.transportName === "string" ? body.transportName.trim() : undefined;
  const transportPhone = typeof body.transportPhone === "string" ? body.transportPhone.trim() : undefined;
  const transportGstin = typeof body.transportGstin === "string" ? body.transportGstin.trim().toUpperCase() : undefined;

  // Validate GSTIN if supplied
  let customerType: "b2b" | "b2c" = "b2c";
  let gstin: string | null = null;
  if (rawGstin) {
    const validation = validateGSTIN(rawGstin);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Invalid GSTIN format: ${validation.message}` },
        { status: 400 },
      );
    }
    gstin = rawGstin;
    customerType = "b2b";
  }

  // Update user name in user table if contactName changed
  if (contactName) {
    await db
      .update(user)
      .set({
        name: contactName,
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.user.id));
  }

  // Check if profile exists
  const existingProfile = await db.query.customerProfile.findFirst({
    where: eq(customerProfile.userId, session.user.id),
  });

  if (existingProfile) {
    await db
      .update(customerProfile)
      .set({
        contactName: contactName ?? existingProfile.contactName,
        businessName: businessName !== undefined ? businessName : existingProfile.businessName,
        gstin: rawGstin !== undefined ? gstin : existingProfile.gstin,
        customerType: rawGstin !== undefined ? customerType : existingProfile.customerType,
        billingAddressLine1: billingAddressLine1 !== undefined ? billingAddressLine1 : existingProfile.billingAddressLine1,
        billingAddressLine2: billingAddressLine2 !== undefined ? billingAddressLine2 : existingProfile.billingAddressLine2,
        billingCity: billingCity !== undefined ? billingCity : existingProfile.billingCity,
        billingState: billingState !== undefined ? billingState : existingProfile.billingState,
        billingPincode: billingPincode !== undefined ? billingPincode : existingProfile.billingPincode,
        shippingAddressLine1: shippingAddressLine1 !== undefined ? shippingAddressLine1 : existingProfile.shippingAddressLine1,
        shippingAddressLine2: shippingAddressLine2 !== undefined ? shippingAddressLine2 : existingProfile.shippingAddressLine2,
        shippingCity: shippingCity !== undefined ? shippingCity : existingProfile.shippingCity,
        shippingState: shippingState !== undefined ? shippingState : existingProfile.shippingState,
        shippingPincode: shippingPincode !== undefined ? shippingPincode : existingProfile.shippingPincode,
        shippingPreference: shippingPreference !== undefined ? shippingPreference : existingProfile.shippingPreference,
        transportName: transportName !== undefined ? transportName : existingProfile.transportName,
        transportPhone: transportPhone !== undefined ? transportPhone : existingProfile.transportPhone,
        transportGstin: transportGstin !== undefined ? transportGstin : existingProfile.transportGstin,
        updatedAt: new Date(),
      })
      .where(eq(customerProfile.id, existingProfile.id));
  } else {
    await db.insert(customerProfile).values({
      id: randomUUID(),
      userId: session.user.id,
      contactName: contactName || session.user.name,
      businessName: businessName || null,
      gstin,
      customerType,
      billingAddressLine1: billingAddressLine1 || null,
      billingAddressLine2: billingAddressLine2 || null,
      billingCity: billingCity || null,
      billingState: billingState || null,
      billingPincode: billingPincode || null,
      shippingAddressLine1: shippingAddressLine1 || null,
      shippingAddressLine2: shippingAddressLine2 || null,
      shippingCity: shippingCity || null,
      shippingState: shippingState || null,
      shippingPincode: shippingPincode || null,
      shippingPreference: shippingPreference || "courier",
      transportName: transportName || null,
      transportPhone: transportPhone || null,
      transportGstin: transportGstin || null,
    });
  }

  return NextResponse.json({
    success: true,
    message: "Profile updated successfully",
  });
}
