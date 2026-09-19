import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// A "use client" component that imports a VALUE from a module which reaches the
// connection pool pulls the Postgres driver into the browser bundle, and the
// production build fails on `Can't resolve 'fs'`. A type-check never sees it,
// because types erase and values do not — so the first thing that notices is a
// deployment, three minutes into someone else's build.
//
// This is what caught us: S5.5's board had always declared its own nature and
// timing options; when they moved into lib/design-procedures.ts, beside the
// queries, the board began importing them for their value. lib/cra-model.ts
// beside lib/cra.ts is the pattern that avoids it — the shared, pure half lives
// in its own module.

const ROOT = path.resolve(__dirname, "../..");
const SERVER_ONLY_IMPORTS = ["@/lib/db", "@/auth", "next-auth", "pg", "node:fs", "node:crypto"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const rel = (f: string) => path.relative(ROOT, f).replace(/\\/g, "/");

/** `import { a } from "x"` but not `import type { a } from "x"`. */
function valueImports(source: string): string[] {
  const out: string[] = [];
  const re = /^import\s+(?!type\s)([^;]*?)\s+from\s+["']([^"']+)["']/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    // `import { type A, type B } from "x"` imports no value either.
    const clause = m[1].trim();
    const onlyTypes =
      clause.startsWith("{") &&
      clause
        .slice(1, -1)
        .split(",")
        .filter((s) => s.trim())
        .every((s) => s.trim().startsWith("type "));
    if (!onlyTypes) out.push(m[2]);
  }
  return out;
}

const libFiles = walk(path.join(ROOT, "lib"));

/** Every @/lib module that reaches the database, directly or through another. */
function serverOnlyModules(): Set<string> {
  const direct = new Map<string, string[]>();
  for (const file of libFiles) {
    const spec = "@/lib/" + rel(file).replace(/^lib\//, "").replace(/\.tsx?$/, "");
    direct.set(spec, valueImports(readFileSync(file, "utf8")));
  }
  const tainted = new Set<string>();
  for (const [spec, imports] of direct) {
    if (imports.some((i) => SERVER_ONLY_IMPORTS.includes(i))) tainted.add(spec);
  }
  // Walk it outwards until nothing new is tainted.
  for (let changed = true; changed; ) {
    changed = false;
    for (const [spec, imports] of direct) {
      if (tainted.has(spec)) continue;
      if (imports.some((i) => tainted.has(i))) {
        tainted.add(spec);
        changed = true;
      }
    }
  }
  return tainted;
}

describe("the client/server boundary", () => {
  const tainted = serverOnlyModules();

  it("finds the modules that reach the database", () => {
    // A sanity check on the analysis itself: if this ever empties, the test
    // below passes for the wrong reason.
    expect(tainted.has("@/lib/db")).toBe(true); // it opens the pool itself
    expect(tainted.has("@/lib/design-procedures")).toBe(true); // reaches it through lib/db
    expect(tainted.has("@/lib/design-procedures-model")).toBe(false); // the pure half
    expect(tainted.has("@/lib/cra-model")).toBe(false); // the pattern this follows
    expect(tainted.size).toBeGreaterThan(5);
  });

  it("no client component imports a value from one of them", () => {
    const offenders: string[] = [];
    for (const file of [...walk(path.join(ROOT, "components")), ...walk(path.join(ROOT, "app"))]) {
      const source = readFileSync(file, "utf8");
      if (!/^\s*["']use client["']/m.test(source)) continue;
      for (const spec of valueImports(source)) {
        if (tainted.has(spec)) offenders.push(`${rel(file)} imports a value from ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
