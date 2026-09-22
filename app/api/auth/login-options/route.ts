import { NextResponse } from "next/server";

import { isGoogleOAuthConfigured, isOtpRequired } from "@/lib/auth-flags";

export async function GET() {
  return NextResponse.json({
    otpRequired: isOtpRequired(),
    googleConfigured: isGoogleOAuthConfigured(),
  });
}
