import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildEmailPasswordRegistrationPayload,
  hasRegistrationErrors,
  REGISTRATION_EMAIL_PATTERN,
  validateEmailPasswordRegistration,
  type EmailPasswordRegistrationInput,
} from "./register-form";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const SECRET = "Sup3rSecret!Value";

function valid(overrides: Partial<EmailPasswordRegistrationInput> = {}): EmailPasswordRegistrationInput {
  return {
    fullName: "Ansh Anand",
    email: "owner@example.com",
    password: SECRET,
    confirmPassword: SECRET,
    ...overrides,
  };
}

describe("email + password registration validation", () => {
  it("accepts a complete valid submission", () => {
    const errors = validateEmailPasswordRegistration(valid());
    assert.deepEqual(errors, {});
    assert.equal(hasRegistrationErrors(errors), false);
  });

  it("requires a full name", () => {
    assert.equal(
      validateEmailPasswordRegistration(valid({ fullName: "   " })).fullName,
      "nameRequired",
    );
  });

  it("requires a valid email address", () => {
    assert.equal(
      validateEmailPasswordRegistration(valid({ email: "" })).email,
      "emailRequired",
    );
    for (const bad of ["owner", "owner@", "owner@x", "owner @example.com", "@example.com"]) {
      assert.equal(
        validateEmailPasswordRegistration(valid({ email: bad })).email,
        "emailInvalid",
        `${bad} must be rejected`,
      );
    }
  });

  it("enforces the shared minimum password length", () => {
    const short = "a".repeat(7);
    assert.equal(
      validateEmailPasswordRegistration(
        valid({ password: short, confirmPassword: short }),
      ).password,
      "passwordTooShort",
    );
    const minimum = "a".repeat(8);
    assert.deepEqual(
      validateEmailPasswordRegistration(
        valid({ password: minimum, confirmPassword: minimum }),
      ),
      {},
    );
  });

  it("requires a password to be entered", () => {
    assert.equal(
      validateEmailPasswordRegistration(valid({ password: "", confirmPassword: "" })).password,
      "passwordRequired",
    );
  });

  it("rejects a password confirmation mismatch", () => {
    const errors = validateEmailPasswordRegistration(
      valid({ confirmPassword: `${SECRET}x` }),
    );
    assert.equal(errors.confirmPassword, "passwordMismatch");
  });

  it("requires the confirmation to be filled in", () => {
    assert.equal(
      validateEmailPasswordRegistration(valid({ confirmPassword: "" })).confirmPassword,
      "confirmRequired",
    );
  });

  it("keeps the phone optional but validates it when present", () => {
    assert.deepEqual(validateEmailPasswordRegistration(valid({ phoneNumber: "" })), {});
    assert.deepEqual(
      validateEmailPasswordRegistration(valid({ phoneNumber: "9876543210" })),
      {},
    );
    assert.equal(
      validateEmailPasswordRegistration(valid({ phoneNumber: "12345" })).phoneNumber,
      "phoneInvalid",
    );
  });

  it("keeps GSTIN optional but validates it when present", () => {
    assert.deepEqual(validateEmailPasswordRegistration(valid({ gstin: "" })), {});
    assert.equal(
      validateEmailPasswordRegistration(valid({ gstin: "NOTAGSTIN" })).gstin,
      "gstinInvalid",
    );
  });

  it("requires a transporter name only when transport is selected", () => {
    assert.deepEqual(
      validateEmailPasswordRegistration(valid({ shippingPreference: "courier" })),
      {},
    );
    assert.equal(
      validateEmailPasswordRegistration(
        valid({ shippingPreference: "transport", transportName: " " }),
      ).transportName,
      "transportNameRequired",
    );
    assert.deepEqual(
      validateEmailPasswordRegistration(
        valid({ shippingPreference: "transport", transportName: "TCI Freight" }),
      ),
      {},
    );
  });
});

describe("registration payload construction", () => {
  it("targets the existing registration contract", () => {
    const payload = buildEmailPasswordRegistrationPayload(valid());
    assert.equal(payload.name, "Ansh Anand");
    assert.equal(payload.email, "owner@example.com");
    assert.equal(payload.password, SECRET);
    assert.equal(payload.shippingPreference, "courier");
  });

  it("never includes a role, so the role cannot be selected from the client", () => {
    const payload = buildEmailPasswordRegistrationPayload(valid());
    assert.equal("role" in payload, false);
    assert.equal(
      Object.keys(payload).some((key) => key.toLowerCase().includes("role")),
      false,
    );
  });

  it("normalises the email to lower case", () => {
    const payload = buildEmailPasswordRegistrationPayload(
      valid({ email: "  Owner@Example.COM  " }),
    );
    assert.equal(payload.email, "owner@example.com");
  });

  it("omits blank optional fields instead of sending empty strings", () => {
    const payload = buildEmailPasswordRegistrationPayload(
      valid({ phoneNumber: "  ", businessName: "", gstin: "", addressLine1: "", city: "", pincode: "" }),
    );
    for (const key of [
      "phoneNumber",
      "businessName",
      "gstin",
      "shippingAddressLine1",
      "shippingCity",
      "shippingState",
      "shippingPincode",
    ]) {
      assert.equal(key in payload, false, `${key} must be omitted when blank`);
    }
  });

  it("includes transport details only for the transport preference", () => {
    const courier = buildEmailPasswordRegistrationPayload(
      valid({ transportName: "TCI", transportPhone: "9876543210" }),
    );
    assert.equal("transportName" in courier, false);
    assert.equal("transportPhone" in courier, false);

    const transport = buildEmailPasswordRegistrationPayload(
      valid({
        shippingPreference: "transport",
        transportName: "TCI",
        transportPhone: "9876543210",
        transportGstin: "24abcde1234f1z5",
      }),
    );
    assert.equal(transport.transportName, "TCI");
    assert.equal(transport.transportPhone, "9876543210");
    assert.equal(transport.transportGstin, "24ABCDE1234F1Z5");
  });

  it("falls back to courier for an unknown shipping preference", () => {
    const payload = buildEmailPasswordRegistrationPayload(
      valid({ shippingPreference: "teleport" as never }),
    );
    assert.equal(payload.shippingPreference, "courier");
  });
});

describe("password confidentiality", () => {
  it("never places the password into any validation error", () => {
    const errors = validateEmailPasswordRegistration(
      valid({ confirmPassword: "different-entirely" }),
    );
    const serialised = JSON.stringify(errors);
    assert.equal(serialised.includes(SECRET), false);
    assert.equal(serialised.toLowerCase().includes("secret"), false);
    assert.deepEqual(Object.values(errors), ["passwordMismatch"]);
  });

  it("never places the password into any error code or key", () => {
    const errors = validateEmailPasswordRegistration(
      valid({ email: "bad", password: "short", confirmPassword: "nope" }),
    );
    for (const [field, code] of Object.entries(errors)) {
      assert.equal(
        String(code).toLowerCase().includes(SECRET.toLowerCase()),
        false,
        `${field} error leaked the password`,
      );
    }
  });

  it("the register page never logs or echoes the password", () => {
    const page = source("app/register/page.tsx");
    // No console statement may receive the password or confirmPassword value.
    for (const match of page.matchAll(/console\.[a-z]+\(([^)]*)\)/g)) {
      assert.equal(
        /password/i.test(match[1]),
        false,
        `console call must not reference the password: ${match[0]}`,
      );
    }
    // The password is cleared from state after a successful submit.
    assert.match(page, /setPassword\(""\)/);
    assert.match(page, /setConfirmPassword\(""\)/);
    // Password inputs are masked and never rendered as text.
    assert.match(page, /type="password"/);
    assert.equal(/type="text"[^>]*value=\{password\}/.test(page), false);
  });

  it("validation errors surfaced to the user are translated codes, not raw input", () => {
    const page = source("app/register/page.tsx");
    assert.match(page, /t\(`register\.err\./);
  });
});

describe("register page structure", () => {
  const page = () => source("app/register/page.tsx");

  it("renders both registration modes with a visible selector", () => {
    assert.match(page(), /register\.modeEmail/);
    assert.match(page(), /register\.modeOtp/);
    assert.match(page(), /aria-pressed=\{mode === "email"\}/);
    assert.match(page(), /aria-pressed=\{mode === "otp"\}/);
  });

  it("collects the required email and password credentials", () => {
    const p = page();
    assert.match(p, /register\.email\b/);
    assert.match(p, /register\.confirmPassword/);
    assert.match(p, /autoComplete="email"/);
    assert.equal((p.match(/type="password"/g) ?? []).length, 2);
  });

  it("submits to the existing registration endpoint, not a new API", () => {
    const p = page();
    assert.match(p, /fetch\("\/api\/auth\/register"/);
    assert.equal(
      /api\/auth\/otp|email-otp|emailOTP/.test(p),
      false,
      "must not reference any OTP route or plugin",
    );
  });

  it("keeps the existing OTP registration flow intact", () => {
    const p = page();
    assert.match(p, /handleSendOtp/);
    assert.match(p, /handleVerifyOtp/);
    assert.match(p, /\/api\/auth\/phone-number\/send-otp/);
    assert.match(p, /\/api\/auth\/phone-number\/verify/);
    assert.match(p, /register\.sendOtp/);
    assert.match(p, /register\.otpTitle/);
    assert.match(p, /register\.verify\b/);
  });

  it("does not expose any role selector in the UI", () => {
    const p = page();
    for (const forbidden of ['role: "admin"', 'role: "dealer"', 'name="role"', 'value="admin"', 'value="dealer"']) {
      assert.equal(p.includes(forbidden), false, `UI must not contain ${forbidden}`);
    }
  });

  it("redirects a successful registration to the normal buyer destination", () => {
    const p = page();
    const handler = p.slice(p.indexOf("async function handleEmailRegister"));
    assert.match(handler, /router\.push\("\/"\)/);
    assert.match(handler, /router\.refresh\(\)/);
  });

  it("surfaces the server error message safely", () => {
    const p = page();
    const handler = p.slice(p.indexOf("async function handleEmailRegister"));
    assert.match(handler, /data\?\.error \|\| t\("register\.fail"\)/);
  });
});

describe("email pattern", () => {
  it("accepts ordinary addresses and rejects malformed ones", () => {
    for (const good of ["a@b.co", "first.last@sub.domain.com"]) {
      assert.equal(REGISTRATION_EMAIL_PATTERN.test(good), true, good);
    }
    for (const bad of ["a@b", "a b@c.com", "a@.com", "@b.com", "plain"]) {
      assert.equal(REGISTRATION_EMAIL_PATTERN.test(bad), false, bad);
    }
  });
});
