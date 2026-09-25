import { validateGSTIN } from "@/lib/gst";
import { normalizeIndianMobile, PASSWORD_MIN_LENGTH } from "@/lib/auth-policy";

/**
 * Client-side validation and payload construction for the email + password
 * registration path on /register.
 *
 * This module is intentionally pure so it can be unit tested without a DOM.
 * Two invariants are enforced here and asserted in the tests:
 *
 *  1. The registration payload NEVER contains a `role` key. The role is server
 *     assigned (`buyer`) and must not be selectable from the client.
 *  2. A password value NEVER appears in any error, message, or return value
 *     other than the payload handed to the registration API.
 */

export type ShippingPreference = "courier" | "self_pickup" | "transport";

export const SHIPPING_PREFERENCES: readonly ShippingPreference[] = [
  "courier",
  "self_pickup",
  "transport",
];

export const REGISTRATION_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type EmailPasswordRegistrationInput = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phoneNumber?: string;
  businessName?: string;
  gstin?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  shippingPreference?: ShippingPreference;
  transportName?: string;
  transportPhone?: string;
  transportGstin?: string;
};

export type EmailPasswordRegistrationField =
  | "fullName"
  | "email"
  | "password"
  | "confirmPassword"
  | "phoneNumber"
  | "gstin"
  | "transportName";

/** Stable, translated on the client. Never contains user input. */
export type EmailPasswordRegistrationErrorCode =
  | "nameRequired"
  | "emailRequired"
  | "emailInvalid"
  | "passwordRequired"
  | "passwordTooShort"
  | "confirmRequired"
  | "passwordMismatch"
  | "phoneInvalid"
  | "gstinInvalid"
  | "transportNameRequired";

export type EmailPasswordRegistrationErrors = Partial<
  Record<EmailPasswordRegistrationField, EmailPasswordRegistrationErrorCode>
>;

function trimmed(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateEmailPasswordRegistration(
  input: EmailPasswordRegistrationInput,
): EmailPasswordRegistrationErrors {
  const errors: EmailPasswordRegistrationErrors = {};

  if (!trimmed(input.fullName)) {
    errors.fullName = "nameRequired";
  }

  const email = trimmed(input.email);
  if (!email) {
    errors.email = "emailRequired";
  } else if (!REGISTRATION_EMAIL_PATTERN.test(email)) {
    errors.email = "emailInvalid";
  }

  const password = typeof input.password === "string" ? input.password : "";
  if (!password) {
    errors.password = "passwordRequired";
  } else if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = "passwordTooShort";
  }

  const confirm = typeof input.confirmPassword === "string" ? input.confirmPassword : "";
  if (!confirm) {
    errors.confirmPassword = "confirmRequired";
  } else if (confirm !== password) {
    errors.confirmPassword = "passwordMismatch";
  }

  const phoneRaw = trimmed(input.phoneNumber);
  if (phoneRaw && !normalizeIndianMobile(phoneRaw)) {
    errors.phoneNumber = "phoneInvalid";
  }

  const gstin = trimmed(input.gstin).toUpperCase();
  if (gstin && !validateGSTIN(gstin).valid) {
    errors.gstin = "gstinInvalid";
  }

  if (input.shippingPreference === "transport" && !trimmed(input.transportName)) {
    errors.transportName = "transportNameRequired";
  }

  return errors;
}

export function hasRegistrationErrors(
  errors: EmailPasswordRegistrationErrors,
): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Build the body for the EXISTING `POST /api/auth/register` endpoint.
 * No new API, no new field. `role` is never included: the server assigns it.
 */
export function buildEmailPasswordRegistrationPayload(
  input: EmailPasswordRegistrationInput,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: trimmed(input.fullName),
    email: trimmed(input.email).toLowerCase(),
    password: typeof input.password === "string" ? input.password : "",
  };

  const optional: Array<[string, string | undefined]> = [
    ["phoneNumber", trimmed(input.phoneNumber)],
    ["businessName", trimmed(input.businessName)],
    ["gstin", trimmed(input.gstin).toUpperCase()],
    ["shippingAddressLine1", trimmed(input.addressLine1)],
    ["shippingCity", trimmed(input.city)],
    ["shippingState", trimmed(input.state)],
    ["shippingPincode", trimmed(input.pincode)],
  ];

  for (const [key, value] of optional) {
    if (value) payload[key] = value;
  }

  const preference =
    input.shippingPreference && SHIPPING_PREFERENCES.includes(input.shippingPreference)
      ? input.shippingPreference
      : "courier";
  payload.shippingPreference = preference;

  if (preference === "transport") {
    const transportName = trimmed(input.transportName);
    if (transportName) payload.transportName = transportName;
    const transportPhone = trimmed(input.transportPhone);
    if (transportPhone) payload.transportPhone = transportPhone;
    const transportGstin = trimmed(input.transportGstin).toUpperCase();
    if (transportGstin) payload.transportGstin = transportGstin;
  }

  return payload;
}
