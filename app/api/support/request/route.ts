import { NextRequest, NextResponse } from "next/server";

import { getSupportMailConfig, sendSupportRequestEmail } from "@/lib/mail";
import { consumeRateLimit } from "@/lib/rate-limit";

const UNAVAILABLE_MESSAGE =
  "Support requests are temporarily unavailable. Please contact us directly at +91-7566666536 or SPARELINK.IND@GMAIL.COM.";

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, max);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 120;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limit = consumeRateLimit(`support-request:${ip}`, 5, 10 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many support requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const name = clean(body?.name, 120);
  const mobile = clean(body?.mobile, 30);
  const email = clean(body?.email, 120);
  const orderId = clean(body?.orderId, 80);
  const subject = clean(body?.subject, 180);
  const message = clean(body?.message, 4000);

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (!mobile) {
    return NextResponse.json({ error: "Mobile is required." }, { status: 400 });
  }
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!subject) {
    return NextResponse.json({ error: "Subject is required." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const mailConfig = getSupportMailConfig();
  if (!mailConfig.configured) {
    return NextResponse.json({ error: UNAVAILABLE_MESSAGE }, { status: 503 });
  }

  try {
    await sendSupportRequestEmail({
      name,
      mobile,
      email,
      orderId,
      subject,
      message,
      submittedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: UNAVAILABLE_MESSAGE }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
