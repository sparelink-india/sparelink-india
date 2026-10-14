import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * The browser must never be able to REACH `lib/db`.
 *
 * This is not a style rule. Two things depend on it:
 *
 *   1. The build. `lib/db` pulls in the `postgres` driver, which imports `fs`,
 *      `net`, `tls` and `perf_hooks`. A client component that reaches it - even
 *      through a lazy `import()` - fails the production build with
 *      "Module not found: Can't resolve 'fs'". That is what happened when the
 *      analytics provider lazily loaded `requestPermission` from
 *      `lib/analytics/location.ts`, which reaches `lib/db` through
 *      `lib/analytics/india-locations.ts`.
 *
 *   2. Secrets. `lib/db` reads DATABASE_URL. A module graph that reaches it from
 *      the browser is a module graph that ships the database driver's
 *      configuration surface to every visitor.
 *
 * So this walks the ACTUAL import graph rather than grepping for a pattern. A
 * single deep import chain is exactly what a grep-based check misses, and it is
 * the failure that already happened once.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const SERVER_ONLY_ROOTS = ["@/lib/db", "@/drizzle/schema", "@/lib/analytics/queries.ts"];

/** Resolve a `@/...` or relative specifier to an absolute path, with extensions. */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? join(ROOT, specifier.slice(2))
    : resolve(dirname(fromFile), specifier);

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/**
 * Collect the local module specifiers of a file, marking the type-only ones.
 *
 * Type-only imports are tracked separately because they are erased at compile
 * time. `components/promotional-banner-slider.tsx` imports a type from a module
 * that reaches the database, which is harmless and predates this module; a VALUE
 * import doing the same would ship the driver to the browser. Conflating the two
 * would mean either tolerating a real leak or restructuring unrelated code, so
 * they are asserted differently and the distinction is written down.
 */
function localSpecifiers(file: string): Array<{ specifier: string; typeOnly: boolean }> {
  const source = readFileSync(file, "utf8");
  const found: Array<{ specifier: string; typeOnly: boolean }> = [];
  const pattern =
    /(import\s+type\s+(?:\{[^}]*\}|[A-Za-z0-9_$]+)\s+from\s+|import\s*\{\s*type\s|import\s+type\s*\*|import\s*\*\s+as\s+)?["']([^"']+)["']|(?:from\s+|import\s*\(\s*|require\(\s*)["']([^"']+)["']/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const specifier = match[2] ?? match[3];
    if (!specifier) continue;
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) continue;
    const prefix = match[1] ?? "";
    const typeOnly = /^\s*(import\s+type\b|import\s*\{\s*type\b|import\s*\*\s+as\s+type\b)/.test(prefix);
    found.push({ specifier, typeOnly });
  }
  return found;
}

/**
 * The transitive closure of local modules reachable from an entry point, split by
 * whether every edge on the path was type-only.
 *
 * Cycles are fine and expected; the visited sets make them cheap.
 */
function moduleClosure(
  entry: string,
  mode: "value" | "any" = "any",
): Set<string> {
  const seen = new Set<string>();
  const queue: Array<{ file: string; typeOnlySoFar: boolean }> = [
    { file: entry, typeOnlySoFar: false },
  ];
  while (queue.length > 0) {
    const { file, typeOnlySoFar } = queue.pop()!;
    const key = `${typeOnlySoFar ? "t" : "v"}:${file}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const { specifier, typeOnly } of localSpecifiers(file)) {
      const resolved = resolveSpecifier(file, specifier);
      if (!resolved) continue;
      const nextTypeOnly = typeOnlySoFar || typeOnly;
      if (mode === "value" && nextTypeOnly) continue;
      queue.push({ file: resolved, typeOnlySoFar: nextTypeOnly });
    }
  }
  return new Set([...seen].map((key) => key.slice(2)));
}

/** Entry points that genuinely run in the browser. */
const BROWSER_ENTRY_POINTS = [
  "lib/analytics/client.ts",
  "lib/analytics/events.ts",
  "lib/analytics/privacy.ts",
  "lib/analytics/browser-location.ts",
  "components/analytics/analytics-provider.tsx",
  "components/analytics/analytics-root.tsx",
  "components/analytics/privacy-consent.tsx",
  "components/analytics/report-problem.tsx",
  "components/analytics/india-address-fields.tsx",
];

/** Components carrying the client directive. */
function clientComponents(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      clientComponents(full, found);
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    if (/^\s*(?:\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(readFileSync(full, "utf8"))) {
      found.push(full);
    }
  }
  return found;
}

describe("the browser never reaches the database", () => {
  const CLIENT_COMPONENTS = clientComponents(join(ROOT, "components"));

  it("finds the client components, so the check below is not vacuous", () => {
    assert.ok(
      CLIENT_COMPONENTS.length > 5,
      `only found ${CLIENT_COMPONENTS.length} client components`,
    );
  });

  for (const entry of BROWSER_ENTRY_POINTS) {
    it(`${entry} cannot reach server-only modules`, () => {
      const absolute = join(ROOT, entry);
      assert.ok(existsSync(absolute), `${entry} must exist`);
      const closure = moduleClosure(absolute);
      for (const forbidden of SERVER_ONLY_ROOTS) {
        const offenders = [...closure].filter((file) => {
          const relative = file.slice(ROOT.length + 1).replace(/\\/g, "/");
          return relative.startsWith(forbidden.replace("@/", "").replace(/\.ts$/, ""));
        });
        assert.deepEqual(
          offenders.map((file) => file.slice(ROOT.length + 1).replace(/\\/g, "/")),
          [],
          `${entry} reaches a server-only module`,
        );
      }
    });
  }

  it("no client component reaches the database through a VALUE import", () => {
    /* The general form of the test above, and the one that decides whether the
       production bundle is safe. It is what catches a new "use client" component
       importing something that happens to touch the database.

       A type-only path is not asserted here: `promotional-banner-slider.tsx`
       imports a type from `lib/promotional-banners.ts`, which reaches the
       database, and that import is erased at compile time. It is listed below so
       the exception is written down rather than merely tolerated. */
    const offenders: string[] = [];
    for (const component of CLIENT_COMPONENTS) {
      const componentPath = component.slice(ROOT.length + 1).replace(/\\/g, "/");
      for (const file of moduleClosure(component, "value")) {
        const relative = file.slice(ROOT.length + 1).replace(/\\/g, "/");
        if (relative.startsWith("lib/db/") || relative.startsWith("drizzle/schema")) {
          offenders.push(`${componentPath} -> ${relative}`);
        }
      }
    }
    assert.deepEqual(offenders, [], "a client component can reach the database layer");
  });

  it("records the known type-only client-to-database paths", () => {
    /* So that if this list grows, the growth is a decision rather than a surprise,
       and so the reason each one is safe is written next to it. */
    const typeOnlyChains: string[] = [];
    for (const component of CLIENT_COMPONENTS) {
      const componentPath = component.slice(ROOT.length + 1).replace(/\\/g, "/");
      const all = moduleClosure(component, "any");
      const values = moduleClosure(component, "value");
      for (const file of all) {
        if (values.has(file)) continue;
        const relative = file.slice(ROOT.length + 1).replace(/\\/g, "/");
        if (relative.startsWith("lib/db/") || relative.startsWith("drizzle/schema")) {
          typeOnlyChains.push(`${componentPath} -> ${relative}`);
        }
      }
    }
    assert.deepEqual(
      [...new Set(typeOnlyChains)].sort(),
      [
        "components/promotional-banner-slider.tsx -> drizzle/schema.ts",
        "components/promotional-banner-slider.tsx -> lib/db/index.ts",
      ],
      "a new type-only client-to-database path appeared; it is safe but should be recorded",
    );
  });

  it("the browser location module is a leaf, with no imports at all", () => {
    /* Structural guarantee rather than a graph check: if this file ever needs an
       import, the author has to think about where the module goes. */
    const source = readFileSync(join(ROOT, "lib/analytics/browser-location.ts"), "utf8");
    assert.doesNotMatch(source, /^\s*import\s/m, "browser-location must stay import-free");
    assert.doesNotMatch(source, /^\s*export\s+\{/m, "browser-location must export one function");
  });
});
