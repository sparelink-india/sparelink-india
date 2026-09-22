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
