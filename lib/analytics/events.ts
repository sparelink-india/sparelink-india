/**
 * The analytics event taxonomy.
 *
 * This file is the single, closed vocabulary the whole module speaks. Nothing
 * outside this list can be recorded: `validation.ts` rejects an unknown event
 * type outright, so a typo or an injected payload cannot invent a new kind of
 * row, and every dashboard query can rely on the union below being exhaustive.
 *
 * Pure module: no database, no React, no browser globals. It is imported by the
 * browser client, the ingestion layer and the admin read models alike, which is
 * exactly why it must not depend on any of them.
 */

/* ------------------------------------------------------------------ funnel */

/**
 * The commercial journey, in order. The order of this object is the funnel
 * order, and `FUNNEL_STAGES` is derived from it, so a new stage cannot be added
 * to the middle of a journey without the funnel report noticing.
 */
export const FUNNEL = {
  /** Anonymous visitor arrived. */
  VISITOR: "visitor",
  /** A product was opened, in any surface. */
  PRODUCT_VIEW: "product_view",
  /** A meaningful search was submitted. */
  SEARCH: "search",
  /** Added to wishlist. */
  WISHLIST: "wishlist",
  /** Item added to cart. */
  CART: "cart",
  /** Checkout opened. */
  CHECKOUT: "checkout",
  /** A payment attempt was initiated. Never carries payment credentials. */
  PAYMENT: "payment",
  /** An order was created. */
  ORDER: "order",
  /** Post-purchase activity: return or support request. */
  SUPPORT: "support",
} as const;

export type FunnelStage = (typeof FUNNEL)[keyof typeof FUNNEL];

/**
 * Canonical funnel order for the conversion report. `search` sits after
 * `product_view` here because a search is the entry point to a product view, and
 * a customer can reach a product without searching at all (direct category
 * browsing), which is why the funnel report counts distinct visitors per stage
 * rather than requiring a strict sequence.
 */
export const FUNNEL_STAGES: readonly FunnelStage[] = [
  FUNNEL.VISITOR,
  FUNNEL.SEARCH,
  FUNNEL.PRODUCT_VIEW,
  FUNNEL.WISHLIST,
  FUNNEL.CART,
  FUNNEL.CHECKOUT,
  FUNNEL.PAYMENT,
  FUNNEL.ORDER,
];

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  visitor: "Visitors",
  search: "Searches",
  product_view: "Product views",
  wishlist: "Wishlist",
  cart: "Cart",
  checkout: "Checkout",
  payment: "Payment",
  order: "Orders",
  support: "Support requests",
};

/* ------------------------------------------------------- behaviour events */

/**
 * Event type -> which table it lands in.
 *
 * `event`   -> analytics_event            (the general behaviour stream)
 * `search`  -> analytics_search
 * `product` -> analytics_product_event
 * `page`    -> analytics_page_view
 * `error`   -> analytics_error
 * `friction`-> analytics_friction
 *
 * Adding a type here without a table is not possible: `EVENT_KINDS` is the
 * exhaustive map and validation iterates it.
 */
export type EventKind = "event" | "search" | "product" | "page" | "error" | "friction";

export const EVENT_KINDS = {
  /* ----------------------------------------------------------- page views */
  page_view: "page",

  /* -------------------------------------------------------------- searches */
  search_performed: "search",
  /** A search result was clicked. Updates the originating search row. */
  search_result_selected: "search",

  /* --------------------------------------------------------------- product */
  product_impression: "product",
  product_view: "product",
  product_modal_open: "product",
  product_detail_view: "product",
  product_gallery_interaction: "product",
  product_specifications_opened: "product",
  product_compatibility_opened: "product",
  product_wishlist_added: "product",
  product_wishlist_removed: "product",
  product_cart_added: "product",
  product_cart_removed: "product",
  product_buy_now: "product",
  product_whatsapp_enquiry: "product",
  product_enquiry_form: "product",

  /* ------------------------------------------------------------------ cart */
  cart_created: "event",
  cart_viewed: "event",
  cart_item_added: "event",
  cart_item_removed: "event",
  cart_quantity_changed: "event",
  cart_abandoned: "event",

  /* -------------------------------------------------------------- checkout */
  checkout_started: "event",
  checkout_address_started: "event",
  checkout_address_completed: "event",
  checkout_serviceability_checked: "event",
  checkout_payment_selected: "event",
  checkout_payment_initiated: "event",
  checkout_payment_succeeded: "event",
  checkout_payment_failed: "event",
  checkout_abandoned: "event",
  order_created: "event",

  /* ------------------------------------------------------------- enquiries */
  enquiry_submitted: "event",
  enquiry_offer_sent: "event",

  /* --------------------------------------------------------------- support */
  support_request_submitted: "event",
  return_requested: "event",
  warranty_claimed: "event",

  /* ------------------------------------------------------------- outcomes */
  wishlist_added: "event",
  login_succeeded: "event",
  registration_completed: "event",
  report_problem_submitted: "event",
  helpful_vote: "event",

  /* ---------------------------------------------------------- diagnostics */
  error_occurred: "error",
  api_error: "error",
  image_load_failed: "error",
  search_error: "error",
  cart_error: "event",
  checkout_error: "event",
  payment_integration_error: "error",
  slow_page_load: "friction",
  slow_api_response: "friction",
  api_timeout: "friction",

  /* ---------------------------------------------------------------- friction */
  repeated_click: "friction",
  dead_click: "friction",
  repeated_search: "friction",
  validation_loop: "friction",
  navigation_loop: "friction",
  repeated_product_open: "friction",
  checkout_retry: "friction",
  payment_retry: "friction",
  failed_interaction: "friction",
} as const;

export type AnalyticsEventType = keyof typeof EVENT_KINDS;

export const ANALYTICS_EVENT_TYPES = Object.keys(EVENT_KINDS) as AnalyticsEventType[];

const EVENT_TYPE_SET: ReadonlySet<string> = new Set(ANALYTICS_EVENT_TYPES);

export function isAnalyticsEventType(value: unknown): value is AnalyticsEventType {
  return typeof value === "string" && EVENT_TYPE_SET.has(value);
}

export function eventKindFor(type: AnalyticsEventType): EventKind {
  return EVENT_KINDS[type];
}

/**
 * Event types that represent a money movement. They are grouped because the
 * checkout-abandonment report and the payment-failure report both need the
 * same set, and the set must never be inferred by string matching in two places.
 */
export const PAYMENT_OUTCOME_EVENT_TYPES: readonly AnalyticsEventType[] = [
  "checkout_payment_initiated",
  "checkout_payment_succeeded",
  "checkout_payment_failed",
  "payment_integration_error",
  "payment_retry",
];

export const CHECKOUT_MILESTONE_EVENT_TYPES: readonly AnalyticsEventType[] = [
  "checkout_started",
  "checkout_address_started",
  "checkout_address_completed",
  "checkout_serviceability_checked",
  "checkout_payment_selected",
  "checkout_payment_initiated",
  "checkout_payment_succeeded",
  "checkout_payment_failed",
  "order_created",
];

/* -------------------------------------------------------------- page types */

/**
 * Page classification. This is derived from the path, never supplied by the
 * client, because a client that could label its own page views could report a
 * cart page as a homepage and poison every funnel number.
 */
export const PAGE_TYPES = [
  "homepage",
  "catalogue",
  "category",
  "brand",
  "search",
  "product",
  "vehicle_fitment",
  "cart",
  "wishlist",
  "checkout",
  "order",
  "order_confirmation",
  "account",
  "enquiry",
  "support",
  "content",
  "auth",
  "admin",
  "other",
] as const;

export type PageType = (typeof PAGE_TYPES)[number];

/**
 * Path -> page type.
 *
 * Order matters: the first match wins, so more specific prefixes are listed
 * before the general ones. `/checkout` must be matched before a generic catch
 * all, and `/order-confirmation` before `/orders`.
 *
 * Dynamic segments are collapsed with `:segment` so a product detail page does
 * not create one pageType per product. The full path is still stored on the row,
 * so nothing is lost.
 */
export function pageTypeForPath(pathname: string): PageType {
  const path = normalisePathname(pathname);

  if (path === "/" || path === "") return "homepage";
  if (path.startsWith("/admin")) return "admin";

  if (
    path === "/checkout" ||
    path.startsWith("/checkout/") ||
    path === "/place-order" ||
    path.startsWith("/place-order")
  ) {
    return "checkout";
  }
  if (path === "/cart" || path.startsWith("/cart/")) return "cart";
  if (path === "/wishlist" || path.startsWith("/wishlist/")) return "wishlist";
  if (path.startsWith("/order-confirmation/")) return "order_confirmation";
  if (path.startsWith("/orders/")) return "order";
  if (path === "/orders" || path === "/track-order") return "order";

  if (path === "/search" || path.startsWith("/search?")) return "search";
  if (path.startsWith("/search/")) return "search";

  if (path.startsWith("/product/") || path.startsWith("/products/")) return "product";
  if (path === "/product" || path === "/products") return "catalogue";

  if (path.startsWith("/vehicle-fitment")) return "vehicle_fitment";
  if (path === "/brands" || path.startsWith("/brand/")) return "brand";
  if (path.startsWith("/category/") || path.startsWith("/categories")) {
    return "category";
  }
  if (path === "/catalogue" || path === "/catalog") return "catalogue";

  if (path === "/login" || path.startsWith("/login/")) return "auth";
  if (path === "/register" || path.startsWith("/register/")) return "auth";
  if (path === "/dealer" || path.startsWith("/dealer/")) return "auth";
  if (path.startsWith("/logout")) return "auth";

  if (path.startsWith("/profile") || path.startsWith("/account")) return "account";
  if (path === "/delete-account" || path.startsWith("/delete-account")) {
    return "account";
  }

  if (path.startsWith("/returns") || path.startsWith("/warranty")) return "support";
  if (path.startsWith("/help-support")) return "support";
  if (path.startsWith("/support")) return "support";

  if (
    path.startsWith("/about-us") ||
    path.startsWith("/contact-us") ||
    path.startsWith("/privacy-policy") ||
    path.startsWith("/terms-and-conditions") ||
    path.startsWith("/shipping-policy") ||
    path.startsWith("/returns-refunds")
  ) {
    return "content";
  }

  if (
    path.startsWith("/offer") ||
    path.startsWith("/offers") ||
    path.startsWith("/enquir")
  ) {
    return "enquiry";
  }

  return "other";
}

/**
 * Collapse a pathname to its shape, replacing dynamic segments with `:segment`.
 *
 * `/category/brake-pads/123` -> `/category/:segment/:segment`
 *
 * Used for the low-cardinality "pages" report only. Individual page views keep
 * the full path, so a deep link is never lost.
 *
 * A segment is treated as dynamic when it looks like an opaque identifier: a
 * UUID, a long hex/base36 token, a digit-only id, or a slug with a separator or
 * trailing digits. Known static words are preserved. The list is deliberately
 * small and explicit rather than a clever heuristic, because a heuristic that
 * collapses a real catalogue category would silently merge two different pages
 * in the report.
 */
const STATIC_PATH_SEGMENTS: ReadonlySet<string> = new Set([
  "about-us",
  "account",
  "admin",
  "auth",
  "brands",
  "cart",
  "catalogue",
  "catalog",
  "category",
  "categories",
  "checkout",
  "contact-us",
  "delete-account",
  "help-support",
  "login",
  "offers",
  "order-confirmation",
  "orders",
  "parts",
  "privacy-policy",
  "product",
  "products",
  "profile",
  "register",
  "returns",
  "returns-refunds",
  "search",
  "shipping-policy",
  "support",
  "terms-and-conditions",
  "track-order",
  "vehicle-fitment",
  "warranty",
  "wishlist",
]);

const OPAQUE_SEGMENT = /^[a-f0-9]{8,}$|^[0-9]+$|^[a-z0-9]{16,}$/i;
const SLUG_WITH_DIGITS = /\d/;

export function normalisePathname(pathname: string): string {
  const withoutQuery = pathname.split("?")[0].split("#")[0] ?? "";
  if (!withoutQuery.startsWith("/")) return "/";
  const collapsed = withoutQuery.replace(/\/{2,}/g, "/");
  return collapsed.length > 1 ? collapsed.replace(/\/+$/, "") || "/" : collapsed;
}

export function pathShape(pathname: string): string {
  const path = normalisePathname(pathname);
  if (path === "/") return "/";
  const segments = path.split("/").filter(Boolean);
  const shaped = segments.map((segment) => {
    const lower = segment.toLowerCase();
    if (STATIC_PATH_SEGMENTS.has(lower)) return lower;
    if (OPAQUE_SEGMENT.test(lower) || SLUG_WITH_DIGITS.test(lower)) return ":segment";
    return lower;
  });
  return `/${shaped.join("/")}`;
}

/* ---------------------------------------------------------------- traffic */

/** Where a visit came from. Computed server-side from the referrer. */
export const TRAFFIC_SOURCES = [
  "direct",
  "search",
  "social",
  "referral",
  "campaign",
  "email",
  "whatsapp",
  "unknown",
] as const;

export type TrafficSource = (typeof TRAFFIC_SOURCES)[number];

const SEARCH_HOST_PATTERNS: readonly string[] = [
  "google.",
  "bing.com",
  "duckduckgo.com",
  "yahoo.",
  "yandex.",
  "ecosia.org",
  "brave.com",
  "startpage.com",
  "baidu.com",
  "ask.com",
  "aol.",
];

const SOCIAL_HOST_PATTERNS: readonly string[] = [
  "facebook.",
  "fb.com",
  "instagram.",
  "whatsapp.",
  "wa.me",
  "linkedin.",
  "twitter.",
  "t.co",
  "x.com",
  "youtube.",
  "youtu.be",
  "telegram.",
  "t.me",
  "reddit.",
  "pinterest.",
  "threads.net",
  "snapchat.",
  "quora.",
];

const EMAIL_HOST_PATTERNS: readonly string[] = ["mail.google.", "outlook.", "mail.yahoo."];

function hostMatches(host: string, patterns: readonly string[]): boolean {
  const lower = host.toLowerCase();
  return patterns.some((pattern) => lower.includes(pattern));
}

/**
 * Classify a referrer.
 *
 * A campaign (an explicit utm_medium/utm_source) always wins over the referrer
 * host, because a tracked link to a Facebook post is a campaign, not "social".
 */
export function classifyTrafficSource(input: {
  referrerHost: string | null | undefined;
  hasCampaignParams: boolean;
}): TrafficSource {
  if (input.hasCampaignParams) return "campaign";
  const host = (input.referrerHost ?? "").trim().toLowerCase();
  if (!host) return "direct";
  if (hostMatches(host, SOCIAL_HOST_PATTERNS)) return "social";
  if (hostMatches(host, SEARCH_HOST_PATTERNS)) return "search";
  if (hostMatches(host, EMAIL_HOST_PATTERNS)) return "email";
  return "referral";
}

/* ------------------------------------------------------------ device types */

export const DEVICE_CATEGORIES = ["desktop", "mobile", "tablet", "bot", "unknown"] as const;
export type DeviceCategory = (typeof DEVICE_CATEGORIES)[number];

/**
 * Classify a device from a user agent string.
 *
 * This is a coarse commercial classification (desktop / mobile / tablet), used
 * to find device-specific conversion problems. It is not fingerprinting: only
 * the resulting category is stored, never the raw user agent string.
 */
export function deviceCategoryFromUserAgent(userAgent: string | null | undefined): DeviceCategory {
  const ua = (userAgent ?? "").toLowerCase();
  if (!ua) return "unknown";

  // Obvious automation, so crawler traffic cannot inflate visitor counts.
  if (
    ua.includes("bot") ||
    ua.includes("crawler") ||
    ua.includes("spider") ||
    ua.includes("curl/") ||
    ua.includes("wget/") ||
    ua.includes("headlesschrome") ||
    ua.includes("python-requests") ||
    ua.includes("httpclient")
  ) {
    return "bot";
  }

  const isTablet =
    ua.includes("ipad") ||
    // iPadOS 13+ reports a desktop Safari UA, distinguished only by touch support.
    (ua.includes("macintosh") && ua.includes("mobile")) ||
    ua.includes("tablet") ||
    ua.includes("kindle") ||
    ua.includes("playbook") ||
    ua.includes("silk/") ||
    // Android without "mobile" in the UA is conventionally a tablet.
    (ua.includes("android") && !ua.includes("mobile"));

  if (isTablet) return "tablet";

  if (
    ua.includes("mobi") ||
    ua.includes("iphone") ||
    ua.includes("ipod") ||
    ua.includes("android") ||
    ua.includes("windows phone") ||
    ua.includes("blackberry") ||
    ua.includes("opera mini") ||
    ua.includes("opera mobi")
  ) {
    return "mobile";
  }

  if (
    ua.includes("windows") ||
    ua.includes("macintosh") ||
    ua.includes("mac os") ||
    ua.includes("x11") ||
    ua.includes("linux") ||
    ua.includes("cros")
  ) {
    return "desktop";
  }

  return "unknown";
}

/* ------------------------------------------------------- location labels */

export const LOCATION_TYPES = ["PRECISE", "APPROXIMATE", "USER_ENTERED"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const LOCATION_SOURCES = [
  "GPS",
  "IP",
  "USER_ADDRESS",
  "APP_PERMISSION",
] as const;
export type LocationSource = (typeof LOCATION_SOURCES)[number];

/* ------------------------------------------------------------- enquiries */

export const ENQUIRY_TYPES = [
  "price_quote",
  "availability",
  "bulk",
  "warranty",
  "general",
] as const;
export type EnquiryType = (typeof ENQUIRY_TYPES)[number];

export const ENQUIRY_CHANNELS = ["whatsapp", "form", "call", "email"] as const;
export type EnquiryChannel = (typeof ENQUIRY_CHANNELS)[number];

/* ---------------------------------------------------------- search types */

export const SEARCH_TYPES = [
  "part_number",
  "part_name",
  "brand",
  "vehicle",
  "category",
  "generic",
] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

/**
 * Guess the search intent from the query shape.
 *
 * A part number in this catalogue is an alphanumeric token that contains a digit
 * and has no spaces (e.g. `bosch-0986ab1234`). A word-only query is a name or
 * brand search. This is a hint used for grouping, never a filter.
 */
export function inferSearchType(query: string): SearchType {
  const trimmed = query.trim();
  if (!trimmed) return "generic";
  const compact = trimmed.replace(/[\s-]/g, "");
  if (/^[a-z0-9]{5,}$/i.test(compact) && /\d/.test(compact) && /\d{3,}/.test(compact)) {
    return "part_number";
  }
  if (/^\d{6,}$/.test(compact)) return "part_number";
  return "generic";
}