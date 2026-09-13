import { NextResponse } from "next/server";

import { isRazorpayConfigured } from "@/lib/razorpay";

export async function GET() {
  return NextResponse.json({ enabled: isRazorpayConfigured() });
}
