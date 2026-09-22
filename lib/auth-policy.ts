import {
  type AppUserRole,
  USERNAME_ACCOUNTS,
  isGoogleOAuthConfigured,
  usernameToLoginEmail,
} from "@/lib/auth-flags";

/** Better Auth email/password minimum. Server-side hashing stays in Better Auth. */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Better Auth Google provider defaults. Do not append `scope` on the provider:
 * that option is added on top of these, which would request extra Google APIs.
 */
export const GOOGLE_OAUTH_SCOPES = ["openid", "email", "profile"] as const;

/** better-auth default basePath `/api/auth` + getOAuthCallbackPath `/callback/google`. */
export const GOOGLE_OAUTH_CALLBACK_PATH = "/api/auth/callback/google";

/** Documented public origins. The live callback host is BETTER_AUTH_URL or NEXT_PUBLIC_APP_URL. */
export const DOCUMENTED_PRODUCTION_APP_ORIGIN = "https://sparelinkindia.com";
export const DOCUMENTED_LOCAL_APP_ORIGIN = "http://localhost:3000";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function googleOAuthCallbackUrl(baseUrl: string): string {
  const origin = baseUrl.trim().replace(/\/+$/, "");
  return `${origin}${GOOGLE_OAUTH_CALLBACK_PATH}`;
}

export function assignRoleOnUserCreate(): "buyer" {
  return "buyer";
}

/** Existing admin/dealer roles are left unchanged on later sign-in or account link. */
export function preserveRoleOnExistingSignIn<T extends string>(existingRole: T): T {
  return existingRole;
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

export function isDealerRole(role: string | null | undefined): boolean {
  return role === "dealer";
}

export function isBuyerRole(role: string | null | undefined): boolean {
  return role === "buyer";
}

export function sessionHasRole(
  role: string | null | undefined,
  allowed: readonly AppUserRole[],
): boolean {
  return typeof role === "string" && (allowed as readonly string[]).includes(role);
}

/**
 * Public registration never accepts a client-selected role.
 * Only an omitted role, or the literal buyer role, is allowed — and the
 * stored role is still forced to buyer.
 */
export function registrationRoleDecision(
  clientRole: unknown,
): { ok: true; role: "buyer" } | { ok: false } {
  if (clientRole === undefined || clientRole === null || clientRole === "") {
    return { ok: true, role: "buyer" };
  }
  if (typeof clientRole !== "string") return { ok: false };
  if (clientRole.trim().toLowerCase() === "buyer") {
    return { ok: true, role: "buyer" };
  }
  return { ok: false };
}

export function resolveRegistrationEmail(
  identifier: string,
): { ok: true; email: string } | { ok: false; error: string } {
  const value = identifier.trim();
  if (!value) {
    return { ok: false, error: "Enter a username or email." };
  }

  if (value.includes("@")) {
    const email = value.toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      return { ok: false, error: "Enter a valid email address." };
    }
    return { ok: true, email };
  }

  if (Object.prototype.hasOwnProperty.call(USERNAME_ACCOUNTS, value)) {
    return { ok: false, error: "This username is not available." };
  }

  const email = usernameToLoginEmail(value);
  if (!email) {
    return {
      ok: false,
      error: "Username must be 3–32 letters, numbers, dots, underscores, or hyphens.",
    };
  }
  return { ok: true, email };
}

export function normalizeIndianMobile(input: string): string | null {
  const compact = input.replace(/[\s-]/g, "");
  if (!compact) return null;
  if (/^\+91[6-9]\d{9}$/.test(compact)) return compact;
  if (/^[6-9]\d{9}$/.test(compact)) return `+91${compact}`;
  return null;
}

/** Registration success payload. Never includes passwords, tokens, or OAuth secrets. */
export function publicRegistrationResult() {
  return {
    ok: true as const,
    role: assignRoleOnUserCreate(),
    redirectTo: "/",
  };
}

export function payloadExposesSecrets(payload: unknown): boolean {
  const text = JSON.stringify(payload);
  if (!text) return false;
  const markers = [
    "clientSecret",
    "client_secret",
    "GOOGLE_CLIENT_SECRET",
    "passwordHash",
    "accessToken",
    "refreshToken",
    "idToken",
    "set-cookie",
  ];
  return markers.some((marker) => text.includes(marker));
}

export function googleOAuthIsConfigured(): boolean {
  return isGoogleOAuthConfigured();
}
