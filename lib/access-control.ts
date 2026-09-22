export type AppRole = "buyer" | "dealer" | "admin" | "suspended";

export type AuthSessionLike = {
  user?: {
    id?: string;
    role?: string | null;
    password?: string;
  } | null;
} | null;

export type AccessDecision =
  | { ok: true; status: 200 }
  | { ok: false; status: 401 | 403; error: string };

const AUTH_REQUIRED = "Authentication required.";
const FORBIDDEN = "Forbidden.";

export function gateAuthenticated(session: AuthSessionLike): AccessDecision {
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: AUTH_REQUIRED };
  }
  return { ok: true, status: 200 };
}

export function gateAdminApi(session: AuthSessionLike): AccessDecision {
  const authed = gateAuthenticated(session);
  if (!authed.ok) return authed;
  if (session?.user?.role !== "admin") {
    return { ok: false, status: 403, error: FORBIDDEN };
  }
  return { ok: true, status: 200 };
}

export function gateDealerApi(session: AuthSessionLike): AccessDecision {
  const authed = gateAuthenticated(session);
  if (!authed.ok) return authed;
  if (session?.user?.role !== "dealer") {
    return { ok: false, status: 403, error: FORBIDDEN };
  }
  return { ok: true, status: 200 };
}

export function gateBuyerApi(session: AuthSessionLike): AccessDecision {
  const authed = gateAuthenticated(session);
  if (!authed.ok) return authed;
  if (session?.user?.role !== "buyer") {
    return { ok: false, status: 403, error: FORBIDDEN };
  }
  return { ok: true, status: 200 };
}

export function gateOrderAccess(
  session: AuthSessionLike,
  orderBuyerId: string | null | undefined,
): AccessDecision {
  const authed = gateAuthenticated(session);
  if (!authed.ok) return authed;
  if (session?.user?.role === "admin") return { ok: true, status: 200 };
  if (session?.user?.role === "buyer" && session.user.id === orderBuyerId) {
    return { ok: true, status: 200 };
  }
  return { ok: false, status: 403, error: FORBIDDEN };
}

export function gateOwnedResource(
  session: AuthSessionLike,
  ownerUserId: string | null | undefined,
): AccessDecision {
  const authed = gateAuthenticated(session);
  if (!authed.ok) return authed;
  if (session?.user?.role === "admin") return { ok: true, status: 200 };
  if (session?.user?.id && session.user.id === ownerUserId) {
    return { ok: true, status: 200 };
  }
  return { ok: false, status: 403, error: FORBIDDEN };
}

export function gateCatalogueMutation(session: AuthSessionLike): AccessDecision {
  return gateAdminApi(session);
}

const BUYER_FORBIDDEN_ORDER_MUTATION_KEYS = [
  "totalPaise",
  "subtotalPaise",
  "gstPaise",
  "shippingPaise",
  "paymentStatus",
  "firmId",
  "quantity",
  "unitPricePaise",
  "status",
  "fulfillmentStatus",
] as const;

/**
 * Buyers may create and view their own orders. They cannot change totals,
 * payment status, firm, quantity, or fulfillment after placement.
 */
export function gateBuyerOrderMutation(
  session: AuthSessionLike,
  body: Record<string, unknown> | null | undefined,
): AccessDecision {
  const buyer = gateBuyerApi(session);
  if (!buyer.ok) return buyer;
  if (!body || typeof body !== "object") {
    return { ok: false, status: 403, error: FORBIDDEN };
  }
  const mutating = BUYER_FORBIDDEN_ORDER_MUTATION_KEYS.some((key) =>
    Object.prototype.hasOwnProperty.call(body, key),
  );
  if (mutating) {
    return { ok: false, status: 403, error: FORBIDDEN };
  }
  return { ok: false, status: 403, error: FORBIDDEN };
}

const PRIVILEGED_BODY_KEYS = [
  "role",
  "userId",
  "buyerId",
  "customerId",
  "id",
] as const;

export function clientCannotSetPrivilegedIdentity(
  body: Record<string, unknown> | null | undefined,
): boolean {
  if (!body || typeof body !== "object") return true;
  return !PRIVILEGED_BODY_KEYS.some((key) =>
    Object.prototype.hasOwnProperty.call(body, key),
  );
}

export function stripPrivilegedIdentityFields(
  body: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const next = { ...body };
  for (const key of PRIVILEGED_BODY_KEYS) {
    delete next[key];
  }
  return next;
}

export function publicUserView<T extends Record<string, unknown>>(user: T) {
  const next = { ...user };
  delete next.password;
  delete next.hash;
  delete next.passwordHash;
  return next;
}

export function loginFailureMessage() {
  return "Invalid username or password.";
}

export function sessionCookieAttributes(appUrl: string | undefined) {
  const secure = Boolean(appUrl?.startsWith("https://"));
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure,
  };
}
