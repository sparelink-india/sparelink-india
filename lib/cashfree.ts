import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  isAllowedFirmId,
  SPARELINK_FIRMS,
  type SpareLinkFirmCode,
} from "@/lib/firms";
import { getPublicAppUrl } from "@/lib/env";

/**
 * Server-side Cashfree configuration and PG API helpers for SpareLink India's
 * three independent merchant accounts. Do not import this module from client
 * components. Secrets must never be sent to the browser.
 */

export type CashfreeEnvironment = "sandbox" | "production";

export type CashfreeConfig = {
  environment: CashfreeEnvironment;
  apiVersion: string;
  apiBaseUrl: string;
};

export type CashfreeFirmCredentials = {
  firmId: string;
  firmCode: SpareLinkFirmCode;
  firmName: string;
  clientId: string;
  clientSecret: string;
};

export type CashfreeCustomerDetails = {
  customer_id: string;
  customer_phone: string;
  customer_name?: string;
  customer_email?: string;
};

export type CashfreeCreateOrderInput = {
  orderId: string;
  amountPaise: number;
  customer: CashfreeCustomerDetails;
  returnUrl: string;
  orderNote?: string;
};

export type CashfreeOrderEntity = {
  orderId: string;
  paymentSessionId: string | null;
  orderStatus: string;
  orderAmountPaise: number | null;
  orderCurrency: string | null;
  cfOrderId: string | null;
};

export type SpareLinkPaymentStatus =
  | "created"
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "user_dropped";

export const ACTIVE_CASHFREE_PAYMENT_STATUSES: readonly SpareLinkPaymentStatus[] =
  ["created", "pending"];

export const RETRYABLE_CASHFREE_PAYMENT_STATUSES: readonly SpareLinkPaymentStatus[] =
  ["failed", "expired", "user_dropped"];

const CASHFREE_API_HOST: Record<CashfreeEnvironment, string> = {
  sandbox: "https://sandbox.cashfree.com/pg",
  production: "https://api.cashfree.com/pg",
};

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  return value.trim();
}

export function getCashfreeConfig(): CashfreeConfig {
  const raw = readOptionalEnv("CASHFREE_ENVIRONMENT");
  const normalized = raw?.toLowerCase();
  const productionNode = process.env.NODE_ENV === "production";

  let environment: CashfreeEnvironment;
  if (normalized === "sandbox" || normalized === "production") {
    environment = normalized;
  } else if (!normalized && !productionNode) {
    environment = "sandbox";
  } else {
    throw new Error(
      productionNode
        ? 'CASHFREE_ENVIRONMENT must be set to "sandbox" or "production" when NODE_ENV=production. Refusing to default production to sandbox.'
        : 'CASHFREE_ENVIRONMENT must be "sandbox" or "production".',
    );
  }

  const apiVersion = readOptionalEnv("CASHFREE_API_VERSION") ?? "2023-08-01";

  return {
    environment,
    apiVersion,
    apiBaseUrl: CASHFREE_API_HOST[environment],
  };
}

/**
 * Exact env names for each independent merchant. Missing HIN/IND keys are
 * expected until those firms are onboarded. Never fall back to another firm.
 */
const CASHFREE_CREDENTIAL_ENV: Record<
  string,
  { clientId: string; clientSecret: string }
> = {
  "firm-ambaji-traders": {
    clientId: "CASHFREE_AMB_CLIENT_ID",
    clientSecret: "CASHFREE_AMB_CLIENT_SECRET",
  },
  "firm-hind-motors": {
    clientId: "CASHFREE_HIN_CLIENT_ID",
    clientSecret: "CASHFREE_HIN_CLIENT_SECRET",
  },
  "firm-india-sales": {
    clientId: "CASHFREE_IND_CLIENT_ID",
    clientSecret: "CASHFREE_IND_CLIENT_SECRET",
  },
};

/**
 * Loads Cashfree credentials for a canonical firm ID from the server env.
 * Returns null when the firm is not allowlisted or that firm's credentials
 * are missing. Never logs clientId/clientSecret. Never uses another firm's keys.
 */
export function getCashfreeCredentialsForFirm(
  firmId: string,
): CashfreeFirmCredentials | null {
  if (!isAllowedFirmId(firmId)) {
    return null;
  }

  const firm = SPARELINK_FIRMS.find((item) => item.id === firmId);
  const envNames = CASHFREE_CREDENTIAL_ENV[firmId];
  if (!firm || !envNames || firm.id !== firmId) {
    return null;
  }

  const clientId = readOptionalEnv(envNames.clientId);
  const clientSecret = readOptionalEnv(envNames.clientSecret);
  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    firmId: firm.id,
    firmCode: firm.code,
    firmName: firm.name,
    clientId,
    clientSecret,
  };
}

/** True only when credentials were loaded for this exact firm ID. */
export function credentialsBelongToFirm(
  credentials: CashfreeFirmCredentials | null,
  firmId: string,
): credentials is CashfreeFirmCredentials {
  return Boolean(credentials && credentials.firmId === firmId);
}

export function isCashfreeConfiguredForFirm(firmId: string): boolean {
  return getCashfreeCredentialsForFirm(firmId) !== null;
}

/** Public, non-secret snapshot of which firms have credentials present. */
export function getCashfreeFirmConfigurationStatus(): Record<
  SpareLinkFirmCode,
  { firmId: string; configured: boolean }
> {
  const status = {} as Record<
    SpareLinkFirmCode,
    { firmId: string; configured: boolean }
  >;

  for (const firm of SPARELINK_FIRMS) {
    status[firm.code] = {
      firmId: firm.id,
      configured: isCashfreeConfiguredForFirm(firm.id),
    };
  }

  return status;
}

export function buildCashfreeHeaders(
  credentials: CashfreeFirmCredentials,
): Record<string, string> {
  const config = getCashfreeConfig();
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-api-version": config.apiVersion,
    "x-client-id": credentials.clientId,
    "x-client-secret": credentials.clientSecret,
  };
}

/** Convert integer paise to Cashfree INR amount without float drift. */
export function paiseToCashfreeAmount(paise: number): number {
  if (!Number.isInteger(paise) || paise <= 0) {
    throw new Error("Amount must be a positive integer number of paise.");
  }
  return Number(
    `${Math.trunc(paise / 100)}.${String(paise % 100).padStart(2, "0")}`,
  );
}

/** Convert Cashfree INR amount back to paise. Returns null if unsafe. */
export function cashfreeAmountToPaise(amount: unknown): number | null {
  let value: number;
  if (typeof amount === "number") {
    value = amount;
  } else if (typeof amount === "string" && amount.trim() !== "") {
    value = Number(amount);
  } else {
    return null;
  }
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  const paise = Math.round(value * 100);
  if (!Number.isSafeInteger(paise) || paise <= 0) {
    return null;
  }
  return paise;
}

/**
 * Cashfree order_id: 3–45 chars, alphanumeric / underscore / hyphen.
 * Compact firm-order id + attempt suffix stays unique per retry.
 */
export function buildCashfreeOrderId(firmOrderId: string): string {
  const compact = firmOrderId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
  const attempt = randomUUID().replace(/-/g, "").slice(0, 8);
  const id = `sl_${compact || "fo"}_${attempt}`;
  return id.slice(0, 45);
}

export function buildCashfreeReturnUrl(
  orderId: string,
  firmOrderId: string,
): string {
  const base = getPublicAppUrl();
  const params = new URLSearchParams({
    cf: "return",
    firmOrderId,
  });
  return `${base}/orders/${encodeURIComponent(orderId)}/payment?${params.toString()}`;
}

export function mapCashfreeOrderStatus(
  gatewayStatus: string | null | undefined,
): SpareLinkPaymentStatus {
  const status = (gatewayStatus ?? "").trim().toUpperCase();
  switch (status) {
    case "PAID":
      return "paid";
    case "EXPIRED":
      return "expired";
    case "TERMINATED":
      return "failed";
    case "USER_DROPPED":
      return "user_dropped";
    case "ACTIVE":
    case "TERMINATION_REQUESTED":
      return "pending";
    default:
      return "pending";
  }
}

export class CashfreeRequestError extends Error {
  readonly httpStatus: number;

  constructor(httpStatus: number, message: string) {
    super(message);
    this.name = "CashfreeRequestError";
    this.httpStatus = httpStatus;
  }
}

function parseCashfreeOrderEntity(payload: unknown): CashfreeOrderEntity | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const body = payload as Record<string, unknown>;
  const orderId =
    typeof body.order_id === "string" && body.order_id.trim()
      ? body.order_id.trim()
      : null;
  const paymentSessionId =
    typeof body.payment_session_id === "string" && body.payment_session_id.trim()
      ? body.payment_session_id.trim()
      : null;
  const orderStatus =
    typeof body.order_status === "string" ? body.order_status.trim() : "";

  if (!orderId || !orderStatus) {
    return null;
  }

  const cfOrderId =
    body.cf_order_id === undefined || body.cf_order_id === null
      ? null
      : String(body.cf_order_id);

  return {
    orderId,
    paymentSessionId,
    orderStatus,
    orderAmountPaise: cashfreeAmountToPaise(body.order_amount),
    orderCurrency:
      typeof body.order_currency === "string" ? body.order_currency : null,
    cfOrderId,
  };
}

async function cashfreeJsonRequest(
  credentials: CashfreeFirmCredentials,
  path: string,
  init: RequestInit,
): Promise<unknown> {
  const config = getCashfreeConfig();
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...buildCashfreeHeaders(credentials),
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    console.error("Cashfree API request failed", {
      path,
      httpStatus: response.status,
      firmCode: credentials.firmCode,
    });
    throw new CashfreeRequestError(
      response.status,
      "Unable to complete the payment request. Please try again.",
    );
  }

  return parsed;
}

export async function createCashfreeOrder(
  credentials: CashfreeFirmCredentials,
  input: CashfreeCreateOrderInput,
): Promise<CashfreeOrderEntity> {
  const payload = {
    order_id: input.orderId,
    order_amount: paiseToCashfreeAmount(input.amountPaise),
    order_currency: "INR",
    customer_details: input.customer,
    order_meta: {
      return_url: input.returnUrl,
    },
    ...(input.orderNote ? { order_note: input.orderNote } : {}),
  };

  const parsed = await cashfreeJsonRequest(credentials, "/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const entity = parseCashfreeOrderEntity(parsed);
  if (!entity?.paymentSessionId) {
    throw new CashfreeRequestError(
      502,
      "Payment gateway returned an incomplete order response.",
    );
  }
  return entity;
}

export async function getCashfreeOrder(
  credentials: CashfreeFirmCredentials,
  providerOrderId: string,
): Promise<CashfreeOrderEntity> {
  const parsed = await cashfreeJsonRequest(
    credentials,
    `/orders/${encodeURIComponent(providerOrderId)}`,
    { method: "GET" },
  );

  const entity = parseCashfreeOrderEntity(parsed);
  if (!entity) {
    throw new CashfreeRequestError(
      502,
      "Payment gateway returned an incomplete order status.",
    );
  }
  return entity;
}

export function toCashfreeCustomerPhone(
  phone: string | null | undefined,
): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return undefined;
  return digits.slice(-10);
}

export function getCashfreeWebhookSigningSecret(
  credentials: CashfreeFirmCredentials,
): string {
  return credentials.clientSecret;
}

/**
 * Cashfree PG (2023-08-01): Base64(HMAC-SHA256(timestamp + rawBody, client secret)).
 * Compare with x-webhook-signature using a constant-time check.
 */
export function verifyCashfreeWebhookSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
  secret: string,
): boolean {
  if (!rawBody || !timestamp.trim() || !signature.trim() || !secret) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(timestamp + rawBody, "utf8")
    .digest("base64");

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export type CashfreeWebhookPaymentDetails = {
  providerOrderId: string;
  gatewayStatus: string;
  mappedStatus: SpareLinkPaymentStatus;
  amountPaise: number | null;
  currency: string | null;
  providerPaymentId: string | null;
  eventType: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

export function mapCashfreePaymentWebhookStatus(
  paymentStatus: string | null | undefined,
): SpareLinkPaymentStatus {
  const status = (paymentStatus ?? "").trim().toUpperCase();
  switch (status) {
    case "SUCCESS":
    case "PAID":
      return "paid";
    case "FAILED":
    case "CANCELLED":
    case "CANCELED":
      return "failed";
    case "EXPIRED":
      return "expired";
    case "USER_DROPPED":
      return "user_dropped";
    default:
      return "pending";
  }
}

export function extractCashfreeWebhookPayment(
  payload: unknown,
): CashfreeWebhookPaymentDetails | null {
  const root = asRecord(payload);
  if (!root) return null;

  const data = asRecord(root.data) ?? root;
  const orderNode = asRecord(data.order);
  const paymentNode = asRecord(data.payment);

  const providerOrderId =
    readString(orderNode?.order_id) ??
    readString(data.order_id) ??
    readString(root.order_id);

  if (!providerOrderId) {
    return null;
  }

  const eventType = readString(root.type);
  const paymentStatus =
    readString(paymentNode?.payment_status) ??
    readString(orderNode?.order_status);

  const gatewayStatus = paymentStatus ?? eventType ?? "UNKNOWN";
  const mappedStatus = mapCashfreePaymentWebhookStatus(paymentStatus);

  const orderAmountPaise = cashfreeAmountToPaise(orderNode?.order_amount);
  const paymentAmountPaise = cashfreeAmountToPaise(
    paymentNode?.payment_amount,
  );

  return {
    providerOrderId,
    gatewayStatus,
    mappedStatus,
    amountPaise: orderAmountPaise ?? paymentAmountPaise,
    currency:
      readString(orderNode?.order_currency) ??
      readString(paymentNode?.payment_currency),
    providerPaymentId: readString(paymentNode?.cf_payment_id),
    eventType,
  };
}
