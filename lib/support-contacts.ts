/**
 * Support contact configuration.
 * Phone/WhatsApp numbers come from environment — never invent production numbers.
 */

export type SupportContacts = {
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  isConfigured: boolean;
};

export function getSupportContacts(): SupportContacts {
  const phone =
    process.env.NEXT_PUBLIC_SUPPORT_PHONE ||
    process.env.SUPPORT_PHONE ||
    null;
  const whatsapp =
    process.env.NEXT_PUBLIC_WHATSAPP_MAIN ||
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ||
    null;
  const email =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
    process.env.SUPPORT_EMAIL ||
    null;

  return {
    phone,
    whatsapp,
    email,
    isConfigured: Boolean(phone || whatsapp || email),
  };
}

export function getTelHref(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

export function getWhatsAppSupportUrl(message?: string): string | null {
  const contacts = getSupportContacts();
  if (!contacts.whatsapp) return null;
  const phone = contacts.whatsapp.replace(/\D/g, "");
  const text = message || "Hello SpareLink India, I need help with my order.";
  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
}
