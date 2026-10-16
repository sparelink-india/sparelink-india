import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("storefront-header top-right Login link", () => {
  it("utility strip top-right link uses Login label and /login destination", () => {
    const header = source("components/storefront-header.tsx");

    // Utility strip: Login label (not Dealer Login) pointing to /login
    assert.ok(
      header.includes('t("nav.login")'),
      'Expected t("nav.login") in header utility strip',
    );
    assert.ok(
      header.includes('href="/login"'),
      'Expected href="/login" in header utility strip',
    );

    // Verify the utility strip no longer uses Dealer Login (moved to mobile drawer only)
    const dealerCount = (header.match(/t\("nav\.dealer"\)/g) || []).length;
    assert.equal(
      dealerCount,
      1,
      'Expected exactly one t("nav.dealer") occurrence (mobile drawer only)',
    );
  });

  it("main header account link still uses /login with Login / Register", () => {
    const header = source("components/storefront-header.tsx");
    assert.ok(
      header.includes('t("nav.loginRegister")'),
      'Expected t("nav.loginRegister") in main header account link',
    );
    assert.ok(
      header.includes('href="/login"'),
      'Expected href="/login" in main header account link',
    );
  });

  it("mobile drawer still has separate Dealer Login entry (preserved)", () => {
    const header = source("components/storefront-header.tsx");
    // Mobile drawer uses JavaScript object syntax: href: "/login/dealer"
    assert.ok(
      header.includes('href: "/login/dealer"'),
      'Expected href: "/login/dealer" preserved in mobile drawer',
    );
    assert.ok(
      header.includes('t("nav.dealer")'),
      'Expected t("nav.dealer") preserved in mobile drawer',
    );
  });
});
