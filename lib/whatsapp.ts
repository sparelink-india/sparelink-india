import {
  PUBLIC_WHATSAPP_DIGITS,
  WHATSAPP_ENQUIRY_MESSAGE,
} from "@/lib/business-contacts";

export { WHATSAPP_ENQUIRY_MESSAGE };

export function getConfiguredWhatsAppNumber(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ||
    process.env.NEXT_PUBLIC_WHATSAPP_MAIN ||
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ||
    PUBLIC_WHATSAPP_DIGITS;
  const digits = raw.replace(/\D/g, "");
  return digits || null;
}

export function getWhatsAppChatUrl(message = WHATSAPP_ENQUIRY_MESSAGE): string | null {
  const phone = getConfiguredWhatsAppNumber();
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
