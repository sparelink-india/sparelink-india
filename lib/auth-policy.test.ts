import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildLoginOptionsPayload,
  isGoogleOAuthConfigured,
  isOtpRequired,
  resolveLoginEmail,
} from "./auth-flags";
import {
  DOCUMENTED_LOCAL_APP_ORIGIN,
  DOCUMENTED_PRODUCTION_APP_ORIGIN,
  GOOGLE_OAUTH_SCOPES,
  assignRoleOnUserCreate,
  googleOAuthCallbackUrl,
  googleOAuthIsConfigured,
  isAdminRole,
  isBuyerRole,
  isDealerRole,
  isSuspendedRole,
  normalizeIndianMobile,
  payloadExposesSecrets,
  preserveRoleOnExistingSignIn,
  publicRegistrationResult,
  registrationRoleDecision,
  resolveRegistrationEmail,
  sessionHasRole,
} from "./auth-policy";
import { canAccessCustomerOrder } from "./order-architecture";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function withGoogleEnv(clientId: string | undefined, clientSecret: string | undefined, run: () => void) {
  const previousId = process.env.GOOGLE_CLIENT_ID;
  const previousSecret = process.env.GOOGLE_CLIENT_SECRET;
  try {
    if (clientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = clientId;
    if (clientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
    else process.env.GOOGLE_CLIENT_SECRET = clientSecret;
    run();
  } finally {
    if (previousId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = previousId;
    if (previousSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
    else process.env.GOOGLE_CLIENT_SECRET = previousSecret;
  }
}

describe("buyer registration with phone OTP", () => {
  it("verifies phone OTP before creating buyer account", () => {
    const page = source("app/register/page.tsx");
    const auth = source("lib/auth.ts");
    assert.match(page, /\/api\/auth\/phone-number\/send-otp/);
    assert.match(page, /\/api\/auth\/phone-number\/verify/);
    assert.match(auth, /function createAuth\(disableSignUp = true\)/);
    assert.match(auth, /disableSignUp,/);
    assert.match(auth, /createAuth\(false\)/);
    const registerRoute = source("app/api/auth/register/route.ts");
    assert.match(registerRoute, /registrationAuth\.api\.signUpEmail/);
    assert.match(auth, /phoneNumber\(/);
    assert.match(auth, /signUpOnVerification/);
  });

  it("maps a new username or email onto a buyer login without a phone code", () => {
    const email = resolveRegistrationEmail("Workshop.One");
    assert.equal(email.ok, true);
    if (email.ok) {
      assert.equal(email.email, "workshop.one@users.sparelink.local");
    }
    const direct = resolveRegistrationEmail("Buyer@Example.com");
    assert.equal(direct.ok, true);
    if (direct.ok) assert.equal(direct.email, "buyer@example.com");
    assert.equal(resolveLoginEmail("Workshop.One"), "workshop.one@users.sparelink.local");
  });
});

describe("buyer role assignment", () => {
  it("assigns buyer to every new account and keeps existing privileged roles", () => {
    assert.equal(assignRoleOnUserCreate(), "buyer");
    assert.equal(publicRegistrationResult().role, "buyer");
    assert.equal(preserveRoleOnExistingSignIn("admin"), "admin");
    assert.equal(preserveRoleOnExistingSignIn("dealer"), "dealer");
    assert.equal(preserveRoleOnExistingSignIn("buyer"), "buyer");
    assert.match(source("lib/auth.ts"), /assignRoleOnUserCreate\(\)/);
  });
});

describe("client cannot select admin or dealer role", () => {
  it("rejects privileged and unknown roles and still stores buyer", () => {
    assert.deepEqual(registrationRoleDecision(undefined), { ok: true, role: "buyer" });
    assert.deepEqual(registrationRoleDecision("buyer"), { ok: true, role: "buyer" });
    assert.equal(registrationRoleDecision("admin").ok, false);
    assert.equal(registrationRoleDecision("dealer").ok, false);
    assert.equal(registrationRoleDecision("Admin").ok, false);
    assert.equal(registrationRoleDecision(" dealer ").ok, false);
    assert.match(source("app/api/auth/register/route.ts"), /registrationRoleDecision/);
    assert.match(source("lib/auth.ts"), /input:\s*false/);
    assert.equal(source("app/register/page.tsx").includes('role: "admin"'), false);
    assert.equal(source("app/register/page.tsx").includes('role: "dealer"'), false);
  });

  it("refuses reserved bootstrap usernames", () => {
    assert.equal(resolveRegistrationEmail("000").ok, false);
    assert.equal(resolveRegistrationEmail("111").ok, false);
    assert.equal(resolveRegistrationEmail("123").ok, false);
  });
});

describe("Google provider configuration", () => {
  it("uses only openid, email, and profile", () => {
    assert.deepEqual([...GOOGLE_OAUTH_SCOPES], ["openid", "email", "profile"]);
    assert.equal(source("lib/auth.ts").includes("scope:"), false);
  });

  it("builds callback URLs from the Better Auth base path", () => {
    assert.equal(
      googleOAuthCallbackUrl(DOCUMENTED_PRODUCTION_APP_ORIGIN),
      "https://sparelinkindia.com/api/auth/callback/google",
    );
    assert.equal(
      googleOAuthCallbackUrl(`${DOCUMENTED_LOCAL_APP_ORIGIN}/`),
      "http://localhost:3000/api/auth/callback/google",
    );
  });

  it("reports Google unavailable when credentials are absent", () => {
    withGoogleEnv(undefined, undefined, () => {
      assert.equal(isGoogleOAuthConfigured(), false);
      assert.equal(googleOAuthIsConfigured(), false);
      assert.equal(buildLoginOptionsPayload().googleConfigured, false);
    });
    withGoogleEnv("test-client-id", "   ", () => {
      assert.equal(buildLoginOptionsPayload().googleConfigured, false);
    });
  });

  it("reports Google configured only when both credentials are non-empty", () => {
    withGoogleEnv("test-client-id", "unit-test-google-secret-marker", () => {
      const payload = buildLoginOptionsPayload();
      assert.equal(payload.googleConfigured, true);
      assert.equal(JSON.stringify(payload).includes("unit-test-google-secret-marker"), false);
      assert.equal(payloadExposesSecrets(payload), false);
    });
  });
});

describe("username/password login", () => {
  it("keeps bootstrap usernames and email login without OTP", () => {
    assert.equal(resolveLoginEmail("000"), "000@users.sparelink.local");
    assert.equal(resolveLoginEmail("111"), "111@users.sparelink.local");
    assert.equal(resolveLoginEmail("123"), "123@users.sparelink.local");
    assert.equal(resolveLoginEmail("Buyer@Example.com"), "buyer@example.com");
    const previous = process.env.OTP_REQUIRED;
    try {
      delete process.env.OTP_REQUIRED;
      assert.equal(isOtpRequired(), false);
      assert.equal(buildLoginOptionsPayload().otpRequired, false);
      assert.equal(buildLoginOptionsPayload().registrationOtpRequired, false);
    } finally {
      if (previous === undefined) delete process.env.OTP_REQUIRED;
      else process.env.OTP_REQUIRED = previous;
    }
    const login = source("app/api/auth/username-login/route.ts");
    assert.match(login, /signInEmail/);
    assert.equal(login.includes("send-otp"), false);
    assert.match(source("app/login/page.tsx"), /GoogleSignInButton/);
    assert.match(source("app/login/page.tsx"), /username-login/);
  });
});

describe("logout", () => {
  it("signs out through Better Auth", () => {
    const button = source("components/sign-out-button.tsx");
    assert.match(button, /authClient\.signOut\(/);
    assert.match(button, /\/login/);
  });
});

describe("admin, dealer, and buyer authorization", () => {
  it("allows only the matching role into each surface", () => {
    assert.equal(isAdminRole("admin"), true);
    assert.equal(isAdminRole("dealer"), false);
    assert.equal(isAdminRole("buyer"), false);
    assert.equal(isDealerRole("dealer"), true);
    assert.equal(isDealerRole("admin"), false);
    assert.equal(isDealerRole("buyer"), false);
    assert.equal(isBuyerRole("buyer"), true);
    assert.equal(isBuyerRole("admin"), false);
    assert.equal(isBuyerRole("dealer"), false);
    assert.equal(isSuspendedRole("suspended"), true);
    assert.equal(isSuspendedRole("buyer"), false);
    assert.equal(isSuspendedRole("admin"), false);
    assert.equal(sessionHasRole("admin", ["admin"]), true);
    assert.equal(sessionHasRole("buyer", ["admin"]), false);
    assert.equal(sessionHasRole("dealer", ["dealer"]), true);
    assert.equal(sessionHasRole("buyer", ["admin", "dealer"]), false);
  });

  it("keeps customer order ownership on the buyer who placed the order", () => {
    assert.equal(canAccessCustomerOrder({ id: "buyer-1", role: "buyer" }, "buyer-1"), true);
    assert.equal(canAccessCustomerOrder({ id: "buyer-2", role: "buyer" }, "buyer-1"), false);
    assert.equal(canAccessCustomerOrder({ id: "admin-1", role: "admin" }, "buyer-1"), true);
    assert.equal(canAccessCustomerOrder({ id: "dealer-1", role: "dealer" }, "buyer-1"), false);
    assert.match(source("lib/require-role.ts"), /isAdminRole/);
    assert.match(source("lib/require-role.ts"), /isDealerRole/);
    assert.match(source("app/api/cart/route.ts"), /isBuyerRole/);
    assert.match(source("lib/auth.ts"), /session:\s*\{\s*create:\s*\{\s*before/);
    assert.match(source("lib/auth.ts"), /isSuspendedRole/);
    assert.match(source("app/api/admin/users/route.ts"), /delete\(authSession\)/);
  });
});

describe("secret safety", () => {
  it("keeps Google secrets and password hashes out of client and public payloads", () => {
    for (const file of [
      "lib/auth-client.ts",
      "components/google-sign-in-button.tsx",
      "app/login/page.tsx",
      "app/register/page.tsx",
      "app/api/auth/login-options/route.ts",
    ]) {
      const text = source(file);
      assert.equal(text.includes("GOOGLE_CLIENT_SECRET"), false, file);
      assert.equal(text.includes("clientSecret"), false, file);
    }
    const result = publicRegistrationResult();
    assert.deepEqual(result, { ok: true, role: "buyer", redirectTo: "/" });
    assert.equal(payloadExposesSecrets(result), false);
    assert.equal(source("lib/auth.ts").includes("httpOnly: false"), false);
    assert.match(source("app/api/auth/register/route.ts"), /publicRegistrationResult/);
    assert.equal(normalizeIndianMobile("9876543210"), "+919876543210");
  });
});

describe("login-options Google configuration", () => {
  it("returns the live configuration flag and does not hardcode Google as enabled", () => {
    const route = source("app/api/auth/login-options/route.ts");
    assert.match(route, /buildLoginOptionsPayload/);
    assert.equal(route.includes("googleConfigured: true"), false);
    withGoogleEnv(undefined, undefined, () => {
      assert.equal(buildLoginOptionsPayload().googleConfigured, false);
    });
  });
});
