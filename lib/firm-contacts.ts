/**
 * Regional Fulfillment Firm WhatsApp Contact Configuration
 *
 * Configurable support / sales WhatsApp numbers for the 3 fulfillment firms.
 * Uses environment variables where available, falling back to clearly marked configuration placeholders.
 */

export type FirmContact = {
  firmCode: "AMB" | "HIN" | "IND";
  firmName: string;
  phone: string; // E.164 format without '+' e.g. "919000000000"
  isProductionReady: boolean;
};

export const FIRM_WHATSAPP_CONTACTS: Record<string, FirmContact> = {
  AMB: {
    firmCode: "AMB",
    firmName: "Ambaji Traders",
    phone: process.env.NEXT_PUBLIC_WHATSAPP_AMBAJI || "919000000001", // Placeholder
    isProductionReady: Boolean(process.env.NEXT_PUBLIC_WHATSAPP_AMBAJI),
  },
  HIN: {
    firmCode: "HIN",
    firmName: "Hind Motors",
    phone: process.env.NEXT_PUBLIC_WHATSAPP_HIND || "919000000002", // Placeholder
    isProductionReady: Boolean(process.env.NEXT_PUBLIC_WHATSAPP_HIND),
  },
  IND: {
    firmCode: "IND",
    firmName: "India Sales",
    phone: process.env.NEXT_PUBLIC_WHATSAPP_INDIA_SALES || "919000000003", // Placeholder
    isProductionReady: Boolean(process.env.NEXT_PUBLIC_WHATSAPP_INDIA_SALES),
  },
};

/**
 * Returns the primary firm WhatsApp contact number for a given firm code, or the default business number.
 */
export function getFirmWhatsAppNumber(firmCode?: string | null): string {
  if (firmCode && FIRM_WHATSAPP_CONTACTS[firmCode]) {
    return FIRM_WHATSAPP_CONTACTS[firmCode].phone;
  }
  return process.env.NEXT_PUBLIC_WHATSAPP_MAIN || "919000000001";
}

/**
 * Generates an honest WhatsApp share link with formatted order summary text.
 */
export function generateWhatsAppOrderUrl(params: {
  orderNumber: string;
  customerName: string;
  totalRupees: number;
  itemCount: number;
  status: string;
  firmName?: string | null;
  firmCode?: string | null;
}): string {
  const firmTargetPhone = getFirmWhatsAppNumber(params.firmCode);
  const text = `Hello ${params.firmName || "SpareLink India"},\n\nI have placed Order *#${params.orderNumber}* on SpareLink.\n\n*Order Summary:*\n- Customer: ${params.customerName}\n- Items: ${params.itemCount} part(s)\n- Total Amount: ₹${params.totalRupees.toLocaleString("en-IN")}\n- Status: ${params.status}\n\nPlease proceed with order dispatch / fulfillment.`;

  return `https://api.whatsapp.com/send?phone=${firmTargetPhone}&text=${encodeURIComponent(text)}`;
}
