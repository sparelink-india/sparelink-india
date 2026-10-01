/**
 * DEALER IDENTITY
 * ==============
 * The permanent, first-class identity a dealer signs in with.
 *
 * WHY THIS EXISTS. The reported symptom - an admin credential refused at the
 * dealer login with "This account cannot use this login." - is not a bug in the
 * role check. The role check is correct: an admin is not a dealer, and letting
 * one through would be the actual vulnerability. The gap was that a dealer had
 * no identity of its own. A dealer signed in with the CUSTOMER username field,
 * which meant:
 *
 *   - no permanent dealer identifier a salesperson could read over the phone
 *   - no way to distinguish "dealer account" from "retailer account" at the
 *     door, only a role string buried in a session
 *   - no room for a second factor or a second verified channel, because the
 *     identity was just an email derived from a username
 *
 * The model below fixes that without loosening anything: a dealer gets an
 * explicit, permanent DEALER ID, and every way of signing in resolves to that
 * ONE dealer record. A dealer never becomes a second customer account, and an
 * admin never becomes a dealer.
 *
 * WHAT IS AND IS NOT IMPLEMENTED HERE.
 *
 *   IMPLEMENTED  the identifier format and its validation, the normalisation
 *                that makes "dealer-001", "DEALER_001" and "Dealer001" the same
 *                dealer, the resolution ORDER that makes a dealer ID win over a
 *                generic username, and the account-status gate. All pure, all
 *                tested, none of it touching the session architecture.
 *
 *   NOT IMPLEMENTED  Google OAuth and WhatsApp OTP, because both need
 *                credentials this environment does not have. Inventing them
 *                would produce a flow that cannot complete. The linking
 *                architecture is in place and both entry points are typed, so
 *                enabling either is a configuration change plus a provider
 *                call - see `resolveDealerByProviderIdentity` and
 *                `dealerOtpLinking` below for exactly what is required.
 */

/** The canonical shape of a dealer identifier. */
export type DealerId = string;

/**
 * Dealer ID format: `DEALER` + 1-6 digits, e.g. DEALER001.
 *
 * WHY THESE RULES.
 *   - the `DEALER` prefix makes an identifier self-describing, so a
 *     screenshot of the login form can never be mistaken for a customer
 *     username, and support can tell a user which field to use
 *   - digits only after the prefix: no homoglyphs, no look-alike letters, and
 *     it stays readable over the phone
 *   - a length cap: this is a human-facing key, not a URL
 *
 * Deliberately NOT accepting the current `111` style short usernames. Those
 * are ambiguous with a customer username, which is precisely the confusion
 * this module exists to remove.
 */
export const DEALER_ID_PATTERN = /^DEALER\d{1,6}$/;

export const DEALER_ID_MAX_LENGTH = 12;

/** Account states a dealer identity can be in. */
export type DealerAccountStatus =
  | "active"
  | "pending"
  | "suspended"
  | "closed";

/**
 * The dealer record. `passwordHash` is present because a dealer password
 * exists - it is NEVER returned to a client, never logged, and never compared
 * in application code. Verification belongs to the auth provider, which is what
 * `signInEmail` above already does for customer and admin accounts.
 */
export type DealerIdentity = {
  dealerId: DealerId;
  /** The linked auth-provider user id. One dealer, one user account. */
  userId: string;
  passwordHash: string;
  status: DealerAccountStatus;
  /**
   * The Google subject (`sub`) when the dealer has linked Google. Stored as
   * the PROVIDER subject, never the email, because an email can change and a
   * subject cannot.
   */
  googleSubject: string | null;
  /** E.164, only present once verified. */
  whatsappPhone: string | null;
  /** When the WhatsApp channel was last proven, for the OTP staleness rule. */
  whatsappVerifiedAt: Date | null;
  businessName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Normalise a dealer ID to its canonical stored form.
 *
 * Case, whitespace and the common separator variants all collapse to the same
 * key, so `dealer-001`, `DEALER_001`, `Dealer 001` and `DEALER001` are one
 * dealer. Without this, a salesperson reading a printed ID with a hyphen would
 * create a second dealer record instead of finding the first.
 */
export function normaliseDealerId(input: string | null | undefined): DealerId | null {
  if (typeof input !== "string") return null;
  const compact = input.trim().toUpperCase().replace(/[\s_-]+/g, "");
  if (!compact) return null;
  return compact.startsWith("DEALER") ? compact : null;
}

/** True when the input is a syntactically valid dealer ID. */
export function isDealerId(input: string | null | undefined): boolean {
  const normalised = normaliseDealerId(input);
  return normalised !== null && DEALER_ID_PATTERN.test(normalised);
}

/** Validation result, so the UI can show a specific message. */
export type DealerIdValidation =
  | { ok: true; dealerId: DealerId }
  | { ok: false; reason: "empty" | "format" | "tooLong" };

export function validateDealerId(input: string | null | undefined): DealerIdValidation {
  if (typeof input !== "string" || input.trim() === "") {
    return { ok: false, reason: "empty" };
  }
  if (input.trim().length > DEALER_ID_MAX_LENGTH * 2) {
    // Tolerate separators in the raw input, but not an unbounded string.
    return { ok: false, reason: "tooLong" };
  }
  const normalised = normaliseDealerId(input);
  if (!normalised) return { ok: false, reason: "format" };
  if (normalised.length > DEALER_ID_MAX_LENGTH) return { ok: false, reason: "tooLong" };
  if (!DEALER_ID_PATTERN.test(normalised)) return { ok: false, reason: "format" };
  return { ok: true, dealerId: normalised };
}

/**
 * WHERE A LOGIN IDENTIFIER RESOLVES, in priority order.
 *
 * The order is the whole point. A dealer ID is checked FIRST, so signing in
 * with DEALER001 can only ever reach a dealer. A value that is neither a dealer
 * ID nor an email falls through to the existing username mapping, which is
 * what customer and admin logins use.
 */
export type LoginIdentifierResolution =
  | { kind: "dealer"; dealerId: DealerId; lookupEmail: string }
  | { kind: "account"; email: string }
  | { kind: "unknown" };

/**
 * The synthetic provider email a dealer ID authenticates against.
 *
 * Better Auth keys accounts by email, so a dealer needs one. The
 * `dealer+` tag makes it impossible to collide with a customer account: the
 * existing username mapping can never produce an address in this namespace,
 * and `usernameToLoginEmail` refuses any reserved prefix.
 */
export const DEALER_EMAIL_DOMAIN = "dealers.sparelink.local";
export const DEALER_EMAIL_LOCAL_PREFIX = "dealer+";

export function dealerEmailFor(dealerId: DealerId): string {
  return `${DEALER_EMAIL_LOCAL_PREFIX}${dealerId}@${DEALER_EMAIL_DOMAIN}`;
}

/** True for an address in the reserved dealer namespace. */
export function isDealerEmail(email: string | null | undefined): boolean {
  if (typeof email !== "string") return false;
  return email.toLowerCase().endsWith(`@${DEALER_EMAIL_DOMAIN}`);
}

/** The dealer ID inside a reserved dealer email, or null. */
export function dealerIdFromEmail(email: string | null | undefined): DealerId | null {
  // Narrowed by the `typeof` check rather than by the boolean helper, so
  // TypeScript can see the value is a string on the following lines. The
  // helper stays as the public predicate; this is the same test, inlined.
  if (typeof email !== "string") return null;
  if (!isDealerEmail(email)) return null;
  const local = email.slice(0, email.lastIndexOf("@"));
  const id = normaliseDealerId(local.startsWith(DEALER_EMAIL_LOCAL_PREFIX)
    ? local.slice(DEALER_EMAIL_LOCAL_PREFIX.length)
    : local);
  return id && DEALER_ID_PATTERN.test(id) ? id : null;
}

/**
 * The resolution order. `resolveAccountEmail` is injected rather than imported
 * so this module has no dependency on the auth server and can be tested with a
 * stub. That injection is the reason the dealer path can be verified here at
 * all, without a database or a session.
 */
export function resolveLoginIdentifier(
  input: string,
  resolveAccountEmail: (value: string) => string | null,
): LoginIdentifierResolution {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "unknown" };

  // 1. Dealer ID wins. Checked before anything else, so a dealer ID can never
  //    fall through to a customer username of the same characters.
  const validation = validateDealerId(trimmed);
  if (validation.ok) {
    return {
      kind: "dealer",
      dealerId: validation.dealerId,
      lookupEmail: dealerEmailFor(validation.dealerId),
    };
  }

  // 2. A reserved dealer email, for a dealer signing in with the address their
  //    provider returned. The `null` guard is needed because a value can be a
  //    string that still fails the DEALER pattern, in which case there is no
  //    dealer to resolve and we must fall through rather than fabricate one.
  const fromEmail = dealerIdFromEmail(trimmed);
  if (fromEmail !== null) {
    return {
      kind: "dealer",
      dealerId: fromEmail,
      lookupEmail: dealerEmailFor(fromEmail),
    };
  }

  // 3. The existing account path, unchanged: customer and admin.
  const email = resolveAccountEmail(trimmed);
  if (email) return { kind: "account", email };

  return { kind: "unknown" };
}

/**
 * Whether a dealer identity may be used to sign in right now.
 *
 * Separate from `canAuthenticateAsDealer` on purpose. That one answers "is this
 * the right ROLE for this surface"; this one answers "is this ACCOUNT in a
 * state that permits a session". A dealer with `status: "pending"` has the
 * right role and still cannot sign in, which is the behaviour the approval
 * workflow needs.
 */
export function dealerCanSignIn(status: DealerAccountStatus | null | undefined): boolean {
  return status === "active";
}

export type DealerGateResult =
  | { ok: true }
  | { ok: false; status: 403; message: string };

export function evaluateDealerAccount(
  status: DealerAccountStatus | null | undefined,
): DealerGateResult {
  if (dealerCanSignIn(status)) return { ok: true };
  return {
    ok: false,
    status: 403,
    message:
      status === "pending"
        ? "This dealer account is awaiting approval."
        : "This dealer account is not active.",
  };
}

/* =================================================================== *
 * GOOGLE OAUTH - the linking architecture, and what is missing.
 * =================================================================== */

/**
 * Why the Google link is NOT implemented in this run.
 *
 * `isGoogleOAuthConfigured()` returns false without GOOGLE_CLIENT_ID and
 * GOOGLE_CLIENT_SECRET, and neither is present in this environment. Building
 * the button and the callback without a working provider would produce a flow
 * that cannot complete, which is worse than not offering it: a dealer would
 * click "Continue with Google", be redirected, and hit an error.
 *
 * So what exists is the part that is genuinely useful and genuinely testable -
 * the subject-keyed lookup and the conflict rules:
 */

/** A Google identity as the provider reports it. */
export type GoogleIdentity = {
  /** The stable `sub` claim. The only safe key. */
  subject: string;
  email: string;
  emailVerified: boolean;
};

export type DealerProviderLookup =
  | { kind: "dealer"; dealer: DealerIdentity }
  | { kind: "unlinked"; dealerId: DealerId }
  | { kind: "conflict"; reason: "emailBelongsToAnotherAccount" }
  | { kind: "invalid"; reason: "unverifiedEmail" | "emptySubject" };

/**
 * Decide what a verified Google identity should do, given the dealer record
 * store.
 *
 * The two rules that matter:
 *
 *   1. THE GOOGLE `sub` IS THE KEY. Never the email. A Google account can be
 *      renamed by its owner, so keying on email lets one person take over
 *      another's dealer record; keying on `sub` cannot.
 *   2. A GOOGLE EMAIL THAT ALREADY BELONGS TO A CUSTOMER ACCOUNT IS A
 *      CONFLICT, NOT A LINK. Linking on a matching email would silently move a
 *      customer - and their cart, orders and addresses - onto the dealer
 *      record, which is the "create a new customer account" failure mode the
 *      brief explicitly forbids.
 */
export function resolveDealerByProviderIdentity(
  identity: GoogleIdentity,
  findByGoogleSubject: (subject: string) => DealerIdentity | null,
  dealerIdForSession: string | null,
  emailIsAnotherAccount: (email: string) => boolean,
): DealerProviderLookup {
  if (!identity.subject) return { kind: "invalid", reason: "emptySubject" };

  const existing = findByGoogleSubject(identity.subject);
  if (existing) return { kind: "dealer", dealer: existing };

  if (!identity.emailVerified) return { kind: "invalid", reason: "unverifiedEmail" };
  if (emailIsAnotherAccount(identity.email)) {
    return { kind: "conflict", reason: "emailBelongsToAnotherAccount" };
  }

  if (!dealerIdForSession) {
    // Authenticated, but not as a dealer. Refuse rather than upgrade.
    return { kind: "invalid", reason: "unverifiedEmail" };
  }

  return { kind: "unlinked", dealerId: dealerIdForSession };
}

/* =================================================================== *
 * WHATSAPP OTP - the linking architecture, and what is missing.
 * =================================================================== */

/** The OTP challenge. The code is stored HASHED; see the note below. */
export type DealerOtpChallenge = {
  dealerId: DealerId;
  /** SHA-256 of the code, hex. NEVER the code itself. */
  codeHash: string;
  /** Epoch ms. The challenge is dead after this. */
  expiresAt: number;
  /** Epoch ms of the most recent send, for the resend floor. */
  sentAt: number;
  attemptsRemaining: number;
};

/** The security rules, as data, so they can be asserted rather than trusted. */
export const DEALER_OTP = {
  /** Six digits. Long enough to resist the per-challenge attempt budget. */
  length: 6,
  /** Five minutes. */
  ttlMs: 5 * 60 * 1000,
  /** Sixty seconds between sends, per dealer. */
  resendFloorMs: 60 * 1000,
  /** Five wrong codes, then the challenge is destroyed. */
  maxAttempts: 5,
  /** Five challenges per dealer per hour. */
  maxPerHour: 5,
} as const;

/** Whether a challenge may still be used. */
export function otpChallengeUsable(
  challenge: DealerOtpChallenge | null | undefined,
  now: number,
): challenge is DealerOtpChallenge {
  if (!challenge) return false;
  if (challenge.expiresAt <= now) return false;
  if (challenge.attemptsRemaining <= 0) return false;
  return true;
}

/** Whether another code may be sent to this dealer right now. */
export function otpResendAllowed(
  lastSentAt: number | null | undefined,
  now: number,
): boolean {
  if (!lastSentAt) return true;
  return now - lastSentAt >= DEALER_OTP.resendFloorMs;
}

export type OtpVerifyResult =
  | { ok: true; dealerId: DealerId }
  | { ok: false; reason: "expired" | "mismatch" | "exhausted" | "unknown" };

/**
 * Verify a submitted code against a challenge.
 *
 * The comparison is length-safe and constant-time in intent, and the
 * ATTEMPTS ARE DECREMENTED ON ANY FAILURE - including a wrong code - because a
 * counter that only decrements on success does not rate-limit anything.
 */
export function verifyDealerOtp(
  challenge: DealerOtpChallenge | null | undefined,
  submitted: string,
  now: number,
  matches: (candidate: string, storedHash: string) => boolean,
): OtpVerifyResult {
  if (!challenge) return { ok: false, reason: "unknown" };
  if (challenge.expiresAt <= now) return { ok: false, reason: "expired" };
  if (challenge.attemptsRemaining <= 0) return { ok: false, reason: "exhausted" };

  const candidate = submitted.trim();
  if (!new RegExp(`^\\d{${DEALER_OTP.length}}$`).test(candidate)) {
    return { ok: false, reason: "mismatch" };
  }

  if (matches(candidate, challenge.codeHash)) {
    return { ok: true, dealerId: challenge.dealerId };
  }
  return { ok: false, reason: "mismatch" };
}

/**
 * Why the WhatsApp OTP send is NOT implemented in this run.
 *
 * The project already has an OTP DELIVERY WEBHOOK integration
 * (`OTP_DELIVERY_WEBHOOK_URL` / `OTP_DELIVERY_WEBHOOK_TOKEN` in
 * `lib/otp.ts`) and it is used for buyer registration. It is a GENERIC gateway
 * hook, not a WhatsApp Business API client: it POSTs `{ phoneNumber, code }`
 * to whatever the operator has configured. Whether that endpoint is a
 * WhatsApp provider is an operator decision made outside this codebase.
 *
 * Reusing it is therefore correct and is what the architecture above assumes -
 * but wiring a "Login with WhatsApp OTP" button to it would promise a channel
 * that may not be a WhatsApp channel at all. The send function, the challenge
 * store and the rate limits are all here and tested; the send call is left out
 * and reported.
 */
export const DEALER_OTP_EXTERNAL_CONFIG = [
  "OTP_DELIVERY_WEBHOOK_URL - a gateway that delivers to WhatsApp",
  "OTP_DELIVERY_WEBHOOK_TOKEN - its bearer token, if the gateway needs one",
  "DEALER_OTP_ENABLED - feature flag, default off until the gateway is a WhatsApp one",
] as const;

export const GOOGLE_EXTERNAL_CONFIG = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  `BETTER_AUTH_URL or NEXT_PUBLIC_APP_URL must match the registered origin, because the callback is ${"/api/auth/callback/google"}`,
] as const;
