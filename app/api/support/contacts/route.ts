import { NextResponse } from "next/server";
import { getSupportContacts } from "@/lib/support-contacts";

export async function GET() {
  return NextResponse.json(getSupportContacts());
}
