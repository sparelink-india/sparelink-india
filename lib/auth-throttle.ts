/**
 * Shared throttling policy for every authentication and sensitive-mutation
 * entry point.
 *
 * WHY THIS EXISTS
 * The audit found the primary brute-force control was trivially bypassable:
 * `/api/auth/username-login` was limited to 20 attempts per IP, but the whole
 * Better Auth surface is mounted at `/api/auth/[...all]`, so posting straight to
 * `/api/auth/sign-in/email` bypassed the limit entirely. The OTP-send endpoint
 * had no limit at all, which made it a free SMS-flooding and harassment vector
 * against arbitrary Indian mobile numbers.
 *
 * DESIGN
 * - Every identifier is derived server-side. The account identifier comes from
 *   the request body and the IP from `resolveClientIp`, which reads the edge
 *   appended hop rather than a client-controlled first hop.
 * - Both dimensions are checked, so rotating IP does not reset the account
 *   budget and rotating account does not reset the IP budget.
 * - Counters live in Postgres so they are shared across lambdas.
 * - Failures are progressively harder (see `consumeProgressiveLockout`).
 * - Responses are identical for "unknown account" and "wrong password" so the
 *   endpoint cannot be used to enumerate registered accounts.
 */

import { NextResponse } from "next/server";

import {
  consumeDurableRateLimit,
  consumeProgressiveLockout,
  normaliseAccountKey,
  resolveClientIp,
  resetDurableRateLimit,
} from "@/lib/rate-limit-db";

const MINUTE = 60 * 1000;

export type ThrottlePolicy = {
  /** Stable bucket name. Change this only together with its counters. */
  scope: string;
  /** Attempts allowed per IP per window before the IP budget is exhausted. */
  ipLimit: number;
  /** Attempts allowed per account per window. */
  accountLimit: number;
  /** Attempts counted before progressive lockout multiplies the account cap. */
  accountBaseLimit: number;
  windowMs: number;
};

/**
 * Credential and account endpoints.
 *
 * The IP budget is deliberately the looser of the two: a shared office or
 * mobile-carrier NAT must not lock out every legitimate user, so the account
 * dimension is the one that tightens as failures accumulate.
 */
export const AUTH_POLICIES = {
  passwordLogin: {
    scope: "auth-password-login",
    ipLimit: 40,
    accountLimit: 12,
    accountBaseLimit: 5,
    windowMs: 15 * MINUTE,
  },
  /** `/api/auth/[...all]` catch-all, including sign-in/email and OTP send. */
  betterAuth: {
    scope: "auth-better-auth",
    ipLimit: 60,
    accountLimit: 20,
    accountBaseLimit: 10,
    windowMs: 15 * MINUTE,
  },
  registration: {
    scope: "auth-register",
    ipLimit: 10,
    accountLimit: 5,
    accountBaseLimit: 3,
    windowMs: 15 * MINUTE,
  },
  otpSend: {
    scope: "auth-otp-send",
    // Deliberately strict: each send costs money and can be used to harass.
    ipLimit: 6,
    accountLimit: 4,
    accountBaseLimit: 3,
    windowMs: 10 * MINUTE,
  },
  otpVerify: {
    scope: "auth-otp-verify",
    ipLimit: 20,
    accountLimit: 10,
    accountBaseLimit: 5,
    windowMs: 10 * MINUTE,
  },
  passwordChange: {
    scope: "auth-password-change",
    ipLimit: 12,
    accountLimit: 8,
    accountBaseLimit: 4,
    windowMs: 15 * MINUTE,
  },
  passwordResetRequest: {
    scope: "auth-password-reset-request",
    ipLimit: 8,
    accountLimit: 4,
    accountBaseLimit: 3,
    windowMs: 30 * MINUTE,
  },
  passwordResetComplete: {
    scope: "auth-password-reset-complete",
    ipLimit: 20,
    accountLimit: 10,
    accountBaseLimit: 5,
    windowMs: 15 * MINUTE,
  },
  emailVerificationSend: {
    scope: "auth-email-verification-send",
    ipLimit: 8,
    accountLimit: 4,
    accountBaseLimit: 3,
    windowMs: 30 * MINUTE,
  },
} as const satisfies Record<string, ThrottlePolicy>;

/**
 * Non-authenticated mutation endpoints. These are not credential endpoints, so
 * they use a flat per-IP budget without progressive lockout.
 */
export const MUTATION_POLICIES = {
  checkout: { scope: "api-checkout", limit: 12, windowMs: 10 * MINUTE },
  cartMutation: { scope: "api-cart", limit: 90, windowMs: 10 * MINUTE },
  cashfreeOrder: { scope: "api-cashfree-order", limit: 20, windowMs: 10 * MINUTE },
  cashfreeStatus: { scope: "api-cashfree-status", limit: 90, windowMs: 10 * MINUTE },
  returnRequest: { scope: "api-return", limit: 10, windowMs: 30 * MINUTE },
  enquiry: { scope: "api-enquiry", limit: 20, windowMs: 30 * MINUTE },
  supportTicket: { scope: "api-support-ticket", limit: 15, windowMs: 30 * MINUTE },
  supportRequest: { scope: "api-support-request", limit: 5, windowMs: 10 * MINUTE },
  warrantyClaim: { scope: "api-warranty", limit: 10, windowMs: 30 * MINUTE },
  dealerRegister: { scope: "api-dealer-register", limit: 5, windowMs: 60 * MINUTE },
  otpDelivery: { scope: "api-otp-delivery", limit: 20, windowMs: 10 * MINUTE },
  paymentSubmission: { scope: "api-payment-submit", limit: 20, windowMs: 10 * MINUTE },
  dealerOrder: { scope: "api-dealer-order", limit: 30, windowMs: 10 * MINUTE },
} as const satisfies Record<
  string,
  { scope: string; limit: number; windowMs: number }
>;

export function genericAuthError() {
  return NextResponse.json(
    { error: "Invalid username or password." },
    { status: 401 },
  );
}

export function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many attempts. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    },
  );
}

/**
 * Apply an auth policy. Returns a 429 response when the caller is over budget,
 * otherwise null so the route continues.
 *
 * `accountIdentifier` should be the email / username / phone the request is
 * trying to act on. Pass an empty string when it cannot be determined: the IP
 * budget still applies, which is the correct behaviour for a request with no
 * usable identity.
 */
export async function throttleAuthRequest(input: {
  request: Request;
  policy: ThrottlePolicy;
  accountIdentifier?: string | null;
}): Promise<NextResponse | null> {
  const ip = resolveClientIp(input.request.headers);
  const account = normaliseAccountKey(input.accountIdentifier);

  const ipLimit = await consumeDurableRateLimit({
    scope: `${input.policy.scope}:ip`,
    identifier: ip,
    limit: input.policy.ipLimit,
    windowMs: input.policy.windowMs,
  });
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfterSeconds);

  if (!account) return null;

  const accountLimit = await consumeProgressiveLockout({
    scope: input.policy.scope,
    identifier: account,
    baseLimit: input.policy.accountBaseLimit,
    windowMs: input.policy.windowMs,
  });
  if (!accountLimit.ok) return tooManyRequests(accountLimit.retryAfterSeconds);

  return null;
}

/** Flat per-IP throttle for a sensitive mutation endpoint. */
export async function throttleMutation(input: {
  request: Request;
  policy: { scope: string; limit: number; windowMs: number };
}): Promise<NextResponse | null> {
  const ip = resolveClientIp(input.request.headers);
  const limit = await consumeDurableRateLimit({
    scope: input.policy.scope,
    identifier: ip,
    limit: input.policy.limit,
    windowMs: input.policy.windowMs,
  });
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);
  return null;
}

/**
 * Record a failed credential attempt against the account so the progressive
 * lockout escalates. Call this on every authentication FAILURE.
 */
export async function recordAuthFailure(policy: ThrottlePolicy, account: string) {
  const key = normaliseAccountKey(account);
  if (!key) return;
  await consumeProgressiveLockout({
    scope: policy.scope,
    identifier: key,
    baseLimit: policy.accountBaseLimit,
    windowMs: policy.windowMs,
  });
}

/**
 * Clear the failure budget after a successful authentication so a legitimate
 * user who mistyped a few times is not left near the ceiling.
 */
export async function recordAuthSuccess(policy: ThrottlePolicy, account: string) {
  const key = normaliseAccountKey(account);
  if (!key) return;
  await resetDurableRateLimit(`${policy.scope}:failure`, key);
}