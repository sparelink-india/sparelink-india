/**
 * Lightweight i18n architecture for Hindi/English.
 * Does not duplicate pages — components call t(key).
 * Expand messages as UI strings are migrated.
 */

export type Locale = "en" | "hi";

const messages: Record<Locale, Record<string, string>> = {
  en: {
    "brand.name": "SpareLink",
    "brand.india": "India",
    "nav.search": "Search parts",
    "nav.cart": "Cart",
    "nav.orders": "Orders",
    "nav.login": "Login",
    "nav.support": "Support",
    "nav.returns": "Returns",
    "nav.warranty": "Warranty",
    "nav.retailer": "Retailer register",
    "search.placeholder": "Part number, name, brand…",
    "search.vehicle": "Filter by vehicle",
    "search.meriGaadi": "Meri Gaadi Ke Liye Parts",
    "cart.title": "Your Cart",
    "checkout.title": "Secure Checkout",
    "payment.bankTransfer": "Bank transfer / UPI",
    "payment.cod": "Cash on delivery",
    "payment.firmWise": "Pay using the firm details shown for your order",
    "support.whatsapp": "WhatsApp support",
    "support.phone": "Call support",
    "support.ticket": "Raise a support ticket",
    "returns.title": "Returns & replacements",
    "warranty.title": "Warranty claims",
    "legal.terms": "Terms & Conditions",
    "legal.privacy": "Privacy Policy",
    "legal.shipping": "Shipping Policy",
    "legal.returns": "Return & Refund Policy",
    "legal.warranty": "Warranty Policy",
    "legal.contact": "Contact Us",
  },
  hi: {
    "brand.name": "स्पेयरलिंक",
    "brand.india": "इंडिया",
    "nav.search": "पार्ट्स खोजें",
    "nav.cart": "कार्ट",
    "nav.orders": "ऑर्डर",
    "nav.login": "लॉगिन",
    "nav.support": "सहायता",
    "nav.returns": "रिटर्न",
    "nav.warranty": "वारंटी",
    "nav.retailer": "रिटेलर पंजीकरण",
    "search.placeholder": "पार्ट नंबर, नाम, ब्रांड…",
    "search.vehicle": "वाहन से फ़िल्टर करें",
    "search.meriGaadi": "मेरी गाड़ी के लिए पार्ट्स",
    "cart.title": "आपका कार्ट",
    "checkout.title": "सुरक्षित चेकआउट",
    "payment.bankTransfer": "बैंक ट्रांसफर / UPI",
    "payment.cod": "कैश ऑन डिलीवरी",
    "payment.firmWise": "अपने ऑर्डर की फर्म के भुगतान विवरण से भुगतान करें",
    "support.whatsapp": "व्हाट्सऐप सहायता",
    "support.phone": "फ़ोन सहायता",
    "support.ticket": "सहायता टिकट बनाएं",
    "returns.title": "रिटर्न और रिप्लेसमेंट",
    "warranty.title": "वारंटी दावे",
    "legal.terms": "नियम और शर्तें",
    "legal.privacy": "गोपनीयता नीति",
    "legal.shipping": "शिपिंग नीति",
    "legal.returns": "रिटर्न और रिफंड नीति",
    "legal.warranty": "वारंटी नीति",
    "legal.contact": "संपर्क करें",
  },
};

let currentLocale: Locale = "en";

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string, locale?: Locale): string {
  const lang = locale ?? currentLocale;
  return messages[lang][key] ?? messages.en[key] ?? key;
}

export function getMessages(locale: Locale = "en") {
  return messages[locale];
}
