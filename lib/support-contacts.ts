import {
  PUBLIC_DISPLAY_EMAIL,
  PUBLIC_SUPPORT_PHONE,
  PUBLIC_WHATSAPP_DIGITS,
} from "@/lib/business-contacts";
import { getWhatsAppChatUrl } from "@/lib/whatsapp";

export type SupportContacts = {
  phone: string;
  whatsapp: string;
  email: string;
  isConfigured: true;
};

export function getSupportContacts(): SupportContacts {
  const phone =
    process.env.NEXT_PUBLIC_SUPPORT_PHONE ||
    process.env.SUPPORT_PHONE ||
    PUBLIC_SUPPORT_PHONE;
  const whatsapp =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ||
    process.env.NEXT_PUBLIC_WHATSAPP_MAIN ||
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ||
    PUBLIC_WHATSAPP_DIGITS;
  const email =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
    process.env.SUPPORT_EMAIL ||
    PUBLIC_DISPLAY_EMAIL;

  return {
    phone,
    whatsapp,
    email,
    isConfigured: true,
  };
}

export function getTelHref(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

export function getWhatsAppSupportUrl(message?: string): string | null {
  return getWhatsAppChatUrl(message);
}
