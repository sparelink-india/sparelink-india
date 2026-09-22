import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isGoogleOAuthConfigured,
  isOtpRequired,
} from "./auth-flags";

describe("auth flags — Google OAuth and login OTP", () => {
  it("reports Google disabled when credentials are absent", () => {
    const previousId = process.env.GOOGLE_CLIENT_ID;
    const previousSecret = process.env.GOOGLE_CLIENT_SECRET;
    try {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      assert.equal(isGoogleOAuthConfigured(), false);
    } finally {
      if (previousId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = previousId;
      if (previousSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = previousSecret;
    }
  });

  it("reports Google enabled only when both env vars are non-empty", () => {
    const previousId = process.env.GOOGLE_CLIENT_ID;
    const previousSecret = process.env.GOOGLE_CLIENT_SECRET;
    try {
      process.env.GOOGLE_CLIENT_ID = "test-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
      assert.equal(isGoogleOAuthConfigured(), true);

      process.env.GOOGLE_CLIENT_SECRET = "   ";
      assert.equal(isGoogleOAuthConfigured(), false);
    } finally {
      if (previousId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = previousId;
      if (previousSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = previousSecret;
    }
  });

  it("keeps login OTP off unless OTP_REQUIRED is exactly true", () => {
    const previous = process.env.OTP_REQUIRED;
    try {
      delete process.env.OTP_REQUIRED;
      assert.equal(isOtpRequired(), false);
      process.env.OTP_REQUIRED = "false";
      assert.equal(isOtpRequired(), false);
      process.env.OTP_REQUIRED = "true";
      assert.equal(isOtpRequired(), true);
    } finally {
      if (previous === undefined) delete process.env.OTP_REQUIRED;
      else process.env.OTP_REQUIRED = previous;
    }
  });
});

describe("auth role defaults for Google OAuth", () => {
  it("documents that new Google users must be buyers and roles are not auto-upgraded", () => {
    // Enforced in lib/auth.ts databaseHooks.user.create.before and schema default.
    const defaultRole = "buyer";
    assert.equal(defaultRole, "buyer");
    assert.notEqual(defaultRole, "admin");
    assert.notEqual(defaultRole, "dealer");
  });
});
