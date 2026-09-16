import { NextResponse } from "next/server";

import { getCashfreeFirmConfigurationStatus } from "@/lib/cashfree";
import { SPARELINK_FIRMS } from "@/lib/firms";

/**
 * Public, non-secret map of which firms currently accept Cashfree.
 * Missing HIN/IND credentials are expected and must not appear as configured.
 */
export async function GET() {
  const status = getCashfreeFirmConfigurationStatus();
  const firms = SPARELINK_FIRMS.map((firm) => ({
    firmId: firm.id,
    firmCode: firm.code,
    firmName: firm.name,
    onlinePaymentConfigured: status[firm.code]?.configured === true,
    onlinePaymentLabel: status[firm.code]?.configured
      ? "Online Payment"
      : "Online Payment — Coming Soon",
  }));

  return NextResponse.json({
    firms,
    configuredFirmIds: firms
      .filter((firm) => firm.onlinePaymentConfigured)
      .map((firm) => firm.firmId),
  });
}
