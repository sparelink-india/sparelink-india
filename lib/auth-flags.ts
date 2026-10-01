/**
 * Server-only username → account mapping.
 * Passwords are never stored here.
 */
/**
 * The roles a stored account can hold.
 *
 * `suspended` is deliberately a MEMBER and not a fourth audience. It is an
 * account STATE that disables an otherwise normal role, which is why the login
 * decision below compares against the raw string rather than against
 * `AppUserRole`: at the point the decision is made the role is an unvalidated
 * value from the session, and narrowing it to `AppUserRole` first would make
 * the suspended check a type error and tempt someone into deleting it.
 */
export type AppUserRole = "buyer" | "dealer" | "admin";

/**
 * The raw role value as it may arrive from a session, before validation.
 *
 * `string` is in the union on purpose. The value comes out of a database
 * column, so the type system cannot narrow it to the four literals that are
 * meaningful, and pretending otherwise is what would make the `suspended`
 * check look like dead code. The function's job is to decide what an
 * unrecognised value means: anything that is not one of the three audiences
 * and not `suspended` is refused, not silently treated as a customer.
 */
export type StoredRoleValue = AppUserRole | "suspended" | (string & {}) | null | undefined;

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


/**
 * THE ROOT CAUSE OF "This account cannot use this login."
 * ------------------------------------------------------------
 * The message came from `app/api/auth/username-login/route.ts`, and it was
 * CORRECT behaviour being reported as a bug:
 *
 *   if (expectedRole && role !== expectedRole) -> 403 "This account cannot
 *   use this login."
 *
 * The dealer login page posts `expectedRole: "dealer"`. An account whose role
 * is `admin` therefore fails that check, is signed straight back out, and gets
 * the 403. The same credentials work on the admin login because that page
 * either sends no `expectedRole` or sends `"admin"`.
 *
 * So this was never a broken credential path - it was the role gate doing its
 * job, and the user was signing in through the wrong door. The architecture
 * below makes the three doors explicit so the situation cannot recur.
 */

/** The three audiences, and the one route each authenticates against. */
export const AUTH_SURFACES = [
  { role: "admin", loginPath: "/admin", roleKey: "admin" },
  { role: "dealer", loginPath: "/login/dealer", roleKey: "dealer" },
  { role: "buyer", loginPath: "/login", roleKey: "buyer" },
] as const;

/**
 * The decision a login surface makes when the account's role does not match
 * the surface it was submitted to.
 *
 * RETURNED RATHER THAN THROWN because this is the security boundary the whole
 * dealer-authentication split turns on, and it needs to be a pure function
 * that can be exhaustively tested:
 *
 *   - `mismatch`   the credentials were VALID but belong to another audience.
 *                   The session is destroyed and the caller is refused. The
 *                   role is never upgraded to make the attempt succeed.
 *   - `suspended`  a valid account, administratively disabled. Distinct from a
 *                   mismatch because support needs to tell them apart.
 *   - `ok`         the role matches, or the surface did not constrain it.
 *
 * Note what is NOT here: there is no branch that lets an admin through the
 * dealer door, and none that silently converts a role. An operator who needs
 * both roles is modelled with an explicit linked dealer record - see
 * `lib/dealer-identity.ts` - never by widening this check.
 */
export type LoginRoleDecision =
  | { ok: true; role: AppUserRole }
  | { ok: false; kind: "mismatch" | "suspended"; status: 403; message: string };

export function evaluateLoginRole(
  accountRole: StoredRoleValue,
  expectedRole: string | null | undefined,
): LoginRoleDecision {
  if (accountRole === "suspended") {
    return {
      ok: false,
      kind: "suspended",
      status: 403,
      message: "This account is suspended.",
    };
  }

  /* An absent role on a live account means the record predates roles, which
     can only be a customer account, so it defaults to buyer. An UNRECOGNISED
     role - a value from a future migration, or a corrupted row - is refused
     rather than treated as a customer, because defaulting an unknown role to
     the least-privileged audience is only safe when the audience has no
     capability; a customer account can place orders, so it is not the safe
     default for an unknown value. */
  if (accountRole !== null && accountRole !== undefined) {
    if (accountRole !== "buyer" && accountRole !== "dealer" && accountRole !== "admin") {
      return {
        ok: false,
        kind: "mismatch",
        status: 403,
        message: "This account cannot use this login.",
      };
    }
  }
  const role: AppUserRole = (accountRole as AppUserRole | null | undefined) ?? "buyer";

  // No expected role means the surface accepts any authenticated account. Only
  // the customer and admin surfaces use that, and both are the account's own
  // home rather than someone else's.
  if (!expectedRole) return { ok: true, role };

  if (role !== expectedRole) {
    return {
      ok: false,
      kind: "mismatch",
      status: 403,
      // Deliberately the same wording the user already saw, and deliberately
      // NOT an invitation to try another door: telling an anonymous visitor
      // "this is an admin account, try /admin" is an account-enumeration
      // hint. The honest message is that this login does not accept the
      // account, and the surface that does is one the visitor already knows.
      message: "This account cannot use this login.",
    };
  }

  return { ok: true, role };
}

/**
 * Whether a role is a dealer-capable role for the dealer surface.
 *
 * `admin` is deliberately absent. This is the single fact that stops an admin
 * credential from becoming a dealer credential, and it is asserted in
 * `lib/dealer-identity.test.ts`.
 */
export function canAuthenticateAsDealer(role: string | null | undefined): boolean {
  return role === "dealer";
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
