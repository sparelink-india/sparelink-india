import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { registrationAuth } from "@/lib/auth";
import {
  normalizeIndianMobile,
  PASSWORD_MIN_LENGTH,
  publicRegistrationResult,
  registrationRoleDecision,
  resolveRegistrationEmail,
} from "@/lib/auth-policy";
import { customerProfile, user } from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { validateGSTIN } from "@/lib/gst";
import { consumeRateLimit } from "@/lib/rate-limit";

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function forwardSetCookies(source: Headers, target: Headers) {
  const cookies =
    typeof source.getSetCookie === "function" ? source.getSetCookie() : [];
  if (cookies.length > 0) {
    for (const cookie of cookies) target.append("set-cookie", cookie);
    return;
  }
  const single = source.get("set-cookie");
  if (single) target.append("set-cookie", single);
}

export async function POST(request: Request) {
  const limit = consumeRateLimit(`buyer-register:${clientIp(request)}`, 10, 15 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid registration details." }, { status: 400 });
  }

  const roleDecision = registrationRoleDecision(
    "role" in body ? (body as { role?: unknown }).role : undefined,
  );
  if (!roleDecision.ok) {
    return NextResponse.json({ error: "Role cannot be selected." }, { status: 403 });
  }

  const name = readString((body as { name?: unknown }).name);
  const identifier = readString(
    (body as { identifier?: unknown }).identifier ??
      (body as { email?: unknown }).email ??
      (body as { username?: unknown }).username,
  );
  const password = typeof (body as { password?: unknown }).password === "string"
    ? (body as { password: string }).password
    : "";

  if (!name) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  }

  const emailResult = resolveRegistrationEmail(identifier);
  if (!emailResult.ok) {
    return NextResponse.json({ error: emailResult.error }, { status: 400 });
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const phoneRaw = readString((body as { phoneNumber?: unknown }).phoneNumber);
  const phoneNumber = phoneRaw ? normalizeIndianMobile(phoneRaw) : null;
  if (phoneRaw && !phoneNumber) {
    return NextResponse.json(
      { error: "Enter a valid Indian mobile number or leave it blank." },
      { status: 400 },
    );
  }

  const gstinRaw = readString((body as { gstin?: unknown }).gstin).toUpperCase();
  let gstin: string | null = null;
  let customerType: "b2b" | "b2c" = "b2c";
  if (gstinRaw) {
    const validation = validateGSTIN(gstinRaw);
    if (!validation.valid) {
      return NextResponse.json({ error: "Enter a valid GSTIN or leave it blank." }, { status: 400 });
    }
    gstin = gstinRaw;
    customerType = "b2b";
  }

  const shippingPreferenceRaw = readString(
    (body as { shippingPreference?: unknown }).shippingPreference,
  );
  const shippingPreference = ["courier", "self_pickup", "transport"].includes(shippingPreferenceRaw)
    ? shippingPreferenceRaw
    : "courier";
  const transportName = readString((body as { transportName?: unknown }).transportName);
  if (shippingPreference === "transport" && !transportName) {
    return NextResponse.json({ error: "Enter the transporter name." }, { status: 400 });
  }

  let signUpResponse: Response;
  try {
    signUpResponse = await registrationAuth.api.signUpEmail({
      body: {
        name,
        email: emailResult.email,
        password,
      },
      headers: request.headers,
      asResponse: true,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to create account. If you already have an account, sign in." },
      { status: 400 },
    );
  }

  if (!signUpResponse.ok) {
    return NextResponse.json(
      { error: "Unable to create account. If you already have an account, sign in." },
      { status: signUpResponse.status === 422 ? 409 : 400 },
    );
  }

  const created = (await signUpResponse.json().catch(() => null)) as {
    user?: { id?: string; role?: string };
  } | null;
  const userId = created?.user?.id;
  if (!userId || created?.user?.role !== "buyer") {
    return NextResponse.json({ error: "Unable to create account." }, { status: 403 });
  }

  const db = getDb();
  if (phoneNumber) {
    try {
      await db
        .update(user)
        .set({
          phoneNumber,
          phoneNumberVerified: false,
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId));
    } catch {
      // Duplicate or unavailable phone must not block the buyer account.
    }
  }

  try {
    await db.insert(customerProfile).values({
      id: randomUUID(),
      userId,
      contactName: name,
      businessName: readString((body as { businessName?: unknown }).businessName) || null,
      gstin,
      customerType,
      shippingAddressLine1:
        readString((body as { shippingAddressLine1?: unknown }).shippingAddressLine1) || null,
      shippingCity: readString((body as { shippingCity?: unknown }).shippingCity) || null,
      shippingState: readString((body as { shippingState?: unknown }).shippingState) || null,
      shippingPincode: readString((body as { shippingPincode?: unknown }).shippingPincode) || null,
      shippingPreference,
      transportName: shippingPreference === "transport" ? transportName : null,
      transportPhone:
        shippingPreference === "transport"
          ? readString((body as { transportPhone?: unknown }).transportPhone) || null
          : null,
      transportGstin:
        shippingPreference === "transport"
          ? readString((body as { transportGstin?: unknown }).transportGstin).toUpperCase() || null
          : null,
    });
  } catch {
    // Account and session already exist. Profile can be completed after login.
  }

  const headers = new Headers();
  headers.set("content-type", "application/json");
  forwardSetCookies(signUpResponse.headers, headers);
  return new NextResponse(JSON.stringify(publicRegistrationResult()), {
    status: 200,
    headers,
  });
}
