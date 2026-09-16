import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Razorpay payments are disabled. Use UPI, bank transfer, or COD." },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "Razorpay payments are disabled. Use UPI, bank transfer, or COD." },
    { status: 410 }
  );
}
