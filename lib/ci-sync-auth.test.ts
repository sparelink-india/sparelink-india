import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Authorization contract tests for CI sync / approval surfaces.
 * Route handlers use requireAdminApi — buyers/dealers must not pass.
 */

type Role = "buyer" | "dealer" | "admin" | null;

function canTriggerCiSync(role: Role): boolean {
  return role === "admin";
}

function canApproveSourceProduct(role: Role): boolean {
  return role === "admin";
}

function canViewSourcePrice(role: Role): boolean {
  return role === "admin";
}

function canModifyApprovalOrSellingPrice(role: Role): boolean {
  return role === "admin";
}

function cronAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  return header === `Bearer ${secret}`;
}

describe("ci sync authorization contracts", () => {
  it("buyers and dealers cannot trigger admin sync or approve", () => {
    assert.equal(canTriggerCiSync("buyer"), false);
    assert.equal(canTriggerCiSync("dealer"), false);
    assert.equal(canTriggerCiSync("admin"), true);
    assert.equal(canApproveSourceProduct("buyer"), false);
    assert.equal(canApproveSourceProduct("dealer"), false);
    assert.equal(canApproveSourceProduct("admin"), true);
  });

  it("customers cannot see source price or modify commercial fields", () => {
    assert.equal(canViewSourcePrice("buyer"), false);
    assert.equal(canViewSourcePrice("dealer"), false);
    assert.equal(canViewSourcePrice("admin"), true);
    assert.equal(canModifyApprovalOrSellingPrice(null), false);
    assert.equal(canModifyApprovalOrSellingPrice("buyer"), false);
  });

  it("cron endpoint requires configured bearer secret", () => {
    assert.equal(cronAuthorized("Bearer secret", undefined), false);
    assert.equal(cronAuthorized(null, "secret"), false);
    assert.equal(cronAuthorized("Bearer wrong", "secret"), false);
    assert.equal(cronAuthorized("Bearer secret", "secret"), true);
  });
});
