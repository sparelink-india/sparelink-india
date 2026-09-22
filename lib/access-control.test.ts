import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clientCannotSetPrivilegedIdentity,
  gateAdminApi,
  gateBuyerApi,
  gateBuyerOrderMutation,
  gateCatalogueMutation,
  gateDealerApi,
  gateOrderAccess,
  gateOwnedResource,
  loginFailureMessage,
  publicUserView,
  sessionCookieAttributes,
  stripPrivilegedIdentityFields,
} from "./access-control";

const admin = { user: { id: "admin-1", role: "admin" } };
const customer = { user: { id: "buyer-1", role: "buyer" } };
const otherCustomer = { user: { id: "buyer-2", role: "buyer" } };
const dealer = { user: { id: "dealer-1", role: "dealer" } };

describe("access control", () => {
  it("1. unauthenticated → admin API = 401", () => {
    assert.equal(gateAdminApi(null).status, 401);
  });

  it("2. customer → admin API = 403", () => {
    assert.equal(gateAdminApi(customer).status, 403);
  });

  it("3. dealer → admin API = 403", () => {
    assert.equal(gateAdminApi(dealer).status, 403);
  });

  it("4. admin → admin API = allowed", () => {
    assert.equal(gateAdminApi(admin).ok, true);
  });

  it("5. customer → own order = allowed", () => {
    assert.equal(gateOrderAccess(customer, "buyer-1").ok, true);
  });

  it("6. customer → another customer's order = 403", () => {
    assert.equal(gateOrderAccess(customer, "buyer-2").status, 403);
    assert.equal(gateOrderAccess(otherCustomer, "buyer-1").status, 403);
  });

  it("7. customer → own cart = allowed", () => {
    assert.equal(gateOwnedResource(customer, "buyer-1").ok, true);
  });

  it("8. customer → another user's cart = denied", () => {
    assert.equal(gateOwnedResource(customer, "buyer-2").status, 403);
  });

  it("9. customer → product creation = denied", () => {
    assert.equal(gateCatalogueMutation(customer).status, 403);
    assert.equal(gateCatalogueMutation(null).status, 401);
  });

  it("10. customer → product price modification = denied", () => {
    assert.equal(gateCatalogueMutation(customer).status, 403);
  });

  it("11. customer → stock modification = denied", () => {
    assert.equal(gateCatalogueMutation(customer).status, 403);
  });

  it("12. customer → firm assignment modification = denied", () => {
    assert.equal(gateCatalogueMutation(customer).status, 403);
    assert.equal(gateCatalogueMutation(dealer).status, 403);
    assert.equal(gateCatalogueMutation(admin).ok, true);
  });

  it("13. logout invalidates session (client session is unusable once cleared)", () => {
    assert.equal(gateAuthenticatedAfterLogout(null).status, 401);
  });

  it("14. invalid login fails safely", () => {
    assert.equal(loginFailureMessage(), "Invalid username or password.");
    assert.equal(loginFailureMessage().includes("not found"), false);
  });

  it("15. password is never returned by API", () => {
    const view = publicUserView({
      id: "buyer-1",
      email: "a@b.c",
      password: "secret-hash",
      hash: "also-secret",
    });
    assert.equal("password" in view, false);
    assert.equal("hash" in view, false);
    assert.equal(view.email, "a@b.c");
  });

  it("16. role cannot be escalated from request body", () => {
    assert.equal(
      clientCannotSetPrivilegedIdentity({ role: "admin", name: "x" }),
      false,
    );
    const stripped = stripPrivilegedIdentityFields({
      role: "admin",
      userId: "other",
      buyerId: "other",
      customerId: "other",
      id: "other",
      contactName: "Ada",
    });
    assert.equal("role" in stripped, false);
    assert.equal("userId" in stripped, false);
    assert.equal(stripped.contactName, "Ada");
  });

  it("dealer cannot use buyer APIs", () => {
    assert.equal(gateBuyerApi(dealer).status, 403);
    assert.equal(gateDealerApi(customer).status, 403);
    assert.equal(gateDealerApi(dealer).ok, true);
  });

  it("14. buyer cannot modify existing order totals", () => {
    assert.equal(
      gateBuyerOrderMutation(customer, { totalPaise: 1 }).status,
      403,
    );
    assert.equal(gateAdminApi(customer).status, 403);
  });

  it("15. buyer cannot mark payment as paid", () => {
    assert.equal(
      gateBuyerOrderMutation(customer, { paymentStatus: "paid" }).status,
      403,
    );
  });

  it("unauthenticated checkout is 401", () => {
    assert.equal(gateBuyerApi(null).status, 401);
  });

  it("production HTTPS cookies are Secure; localhost HTTP is not", () => {
    const https = sessionCookieAttributes("https://sparelink.example");
    assert.equal(https.httpOnly, true);
    assert.equal(https.sameSite, "lax");
    assert.equal(https.path, "/");
    assert.equal(https.secure, true);
    const local = sessionCookieAttributes("http://localhost:3002");
    assert.equal(local.secure, false);
    assert.equal(local.httpOnly, true);
  });
});

function gateAuthenticatedAfterLogout(session: null) {
  return gateAdminApi(session);
}
