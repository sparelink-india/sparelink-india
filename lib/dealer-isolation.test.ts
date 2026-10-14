import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

/**
 * DEALER + CUSTOMER ISOLATION TESTS (STRUCTURAL).
 *
 * Same method as `lib/procurement/api-security.test.ts`: these read ROUTE
 * SOURCE, because the property under test is "the gate exists in the code
 * path", which source inspection proves directly. They do NOT prove runtime
 * row contents — request-level tests with signed-in roles would be the
 * ceiling; these are the floor, and they fail loudly if a gate is removed.
 *
 * Verified facts encoded here (checked against source before writing):
 * - every route under app/api/dealer/ gates via requireDealerApi and scopes
 *   reads/writes by the server-resolved dealer profile id;
 * - only app/api/admin/* routes ever read body.firmId (admins legitimately
 *   select a firm); no customer or dealer route does;
 * - cart and order reads/writes pin buyerId to the session user id.
 */

const ROOT = process.cwd();

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...routeFiles(full));
    else if (name === "route.ts") out.push(full);
  }
  return out;
}

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function extractFunction(source: string, verb: string): string {
  const start = source.indexOf(`export async function ${verb}`);
  if (start === -1) return "";
  const rest = source.slice(start + 1);
  const next = rest.search(/\nexport (async function|const|default)/);
  return next === -1 ? rest : rest.slice(0, next);
}

const DEALER_ROUTES = routeFiles(join(ROOT, "app", "api", "dealer")).map((f) =>
  f.slice(ROOT.length + 1).replace(/\\/g, "/"),
);

const CUSTOMER_ROUTES = [
  "app/api/cart/route.ts",
  "app/api/orders/route.ts",
  "app/api/demand/route.ts",
  "app/api/wishlist/route.ts",
];

function inlineTriplePresent(body: string): boolean {
  return (
    /getServerSession\(\)/.test(body) &&
    /role\s*!==?\s*["']dealer["']/.test(body) &&
    /denyIfMustChangePassword\(/.test(body)
  );
}

function helperBody(source: string, name: string): string {
  const start = source.indexOf(`async function ${name}`);
  if (start === -1) return "";
  const rest = source.slice(start);
  const next = rest.search(/\nexport (async function|const|default)/);
  return next === -1 ? rest : rest.slice(0, next);
}

function verbGateOk(source: string, verbBody: string): boolean {
  if (/requireDealerApi\(\)/.test(verbBody)) return true;
  if (inlineTriplePresent(verbBody)) return true;
  // Delegated form (dashboard): the verb awaits a local access helper that
  // itself enforces the triple. The helper body is checked, not assumed.
  const helperCall = verbBody.match(/await\s+([A-Za-z_$][\w$]*)\(\)/);
  if (helperCall) {
    const body = helperBody(source, helperCall[1]);
    if (body && inlineTriplePresent(body)) return true;
  }
  return false;
}

describe("dealer routes are gated and profile-scoped (structural)", () => {
  it("discovers dealer routes to guard", () => {
    assert.ok(DEALER_ROUTES.length > 0, "no dealer routes discovered at all");
  });

  for (const rel of DEALER_ROUTES) {
    it(`${rel} gates every verb on a dealer session`, () => {
      const source = read(rel);
      const verbs = [...source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)/g)].map(
        (m) => m[1],
      );
      assert.ok(verbs.length > 0, `${rel} exports no HTTP verb`);
      for (const verb of verbs) {
        assert.ok(
          verbGateOk(source, extractFunction(source, verb)),
          `${rel}#${verb} has neither requireDealerApi() nor a verified ` +
            `equivalent gate (getServerSession + non-dealer 403 + denyIfMustChangePassword, ` +
            `directly or via a checked local helper)`,
        );
      }
    });

    it(`${rel} scopes data by the server-resolved profile id`, () => {
      const source = read(rel);
      assert.match(
        source,
        /profile\.id/,
        `${rel} must constrain queries by the server-resolved dealer profile id`,
      );
    });
  }
});

describe("no customer or dealer route takes firmId from the client (structural)", () => {
  for (const rel of [...CUSTOMER_ROUTES, ...DEALER_ROUTES]) {
    it(`${rel} never reads firmId from the body or query`, () => {
      const source = read(rel);
      assert.doesNotMatch(
        source,
        /body\.firmId|body\["firmId"\]|body\.firm_id|body\["firm_id"\]/,
        `${rel} reads a firm id from the request body; firm must come from the server`,
      );
      assert.doesNotMatch(
        source,
        /searchParams\.get\(["']firmId["']\)/,
        `${rel} accepts firmId as a query parameter on a non-admin route`,
      );
    });
  }

  it("only admin routes legitimately read a client-supplied firmId", () => {
    const adminReaders = routeFiles(join(ROOT, "app", "api", "admin"))
      .map((f) => f.slice(ROOT.length + 1).replace(/\\/g, "/"))
      .filter((rel) =>
        /body\.firmId|body\["firmId"\]/.test(read(rel)),
      );
    for (const rel of adminReaders) {
      assert.match(
        read(rel),
        /requireAdminApi\(\)/,
        `${rel} reads body.firmId so it must be admin-gated`,
      );
    }
  });
});

describe("cart and order rows are pinned to the session buyer (structural)", () => {
  for (const rel of ["app/api/cart/route.ts", "app/api/orders/route.ts"]) {
    it(`${rel} scopes every buyerId by session.user.id`, () => {
      const source = read(rel);
      assert.match(
        source,
        /buyerId,\s*session\.user\.id|buyerId:\s*session\.user\.id/,
        `${rel} must pin buyerId to the session user, never to client input`,
      );
      assert.doesNotMatch(
        source,
        /body\.buyerId|body\["buyerId"\]/,
        `${rel} must not accept buyerId from the request body`,
      );
    });
  }
});
