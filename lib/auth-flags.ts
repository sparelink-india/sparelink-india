/**
 * Server-only username → account mapping.
 * Passwords are never stored here.
 */
export type AppUserRole = "buyer" | "dealer" | "admin";

export const USERNAME_ACCOUNTS: Record<
  string,
  { email: string; role: AppUserRole; name: string }
> = {
  "000": {
    email: "000@users.sparelink.local",
    role: "buyer",
    name: "SpareLink Customer",
  },
  "111": {
    email: "111@users.sparelink.local",
    role: "dealer",
    name: "SpareLink Dealer",
  },
  "123": {
    email: "123@users.sparelink.local",
    role: "admin",
    name: "SpareLink Admin",
  },
};

export function resolveLoginEmail(usernameOrEmail: string): string | null {
  const value = usernameOrEmail.trim();
  if (!value) return null;
  const mapped = USERNAME_ACCOUNTS[value];
  if (mapped) return mapped.email;
  if (value.includes("@")) return value.toLowerCase();
  if (/^[A-Za-z0-9._-]{3,32}$/.test(value)) {
    return `${value.toLowerCase()}@users.sparelink.local`;
  }
  return null;
}

export function isOtpRequired(): boolean {
  return process.env.OTP_REQUIRED === "true";
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
}


/** Map a public username to the synthetic login email used at registration. */
export function usernameToLoginEmail(username: string): string | null {
  const value = username.trim();
  if (!value) return null;
  if (!/^[A-Za-z0-9._-]{3,32}$/.test(value)) return null;
  if (Object.prototype.hasOwnProperty.call(USERNAME_ACCOUNTS, value)) return null;
  return `${value.toLowerCase()}@users.sparelink.local`;
}

export function isRegistrationOtpRequired(): boolean {
  return process.env.REGISTRATION_OTP_REQUIRED === "true" || isOtpRequired();
}

export function buildLoginOptionsPayload() {
  return {
    googleConfigured: isGoogleOAuthConfigured(),
    otpRequired: isOtpRequired(),
    registrationOtpRequired: isRegistrationOtpRequired(),
  };
}
