#!/usr/bin/env node
/* validate:schema-barrel — no browser module imports the product-schema
 * registry.
 *
 * `@/lib/product-schema` (index.ts) imports every spec template — 532 KB of
 * source — to build the server-side registry. Any "use client" module that
 * imports even one helper through it ships the whole registry to every
 * visitor of its route. Found three times on 19/09/2026: the product page
 * (−280 KB when fixed), the product editor and the spec icon hub. The
 * helpers live in leaf modules (visibility.ts, visual-options.ts,
 * readiness.ts); the registry's ANSWERS come from /api/product-schema via
 * lib/product-schema-client.ts.
 *
 * Rule: a file whose first statement is "use client" must not import from
 * "@/lib/product-schema" or "@/lib/product-schema/registry" or any
 * "@/lib/product-schema/schemas/…". Both directions exercised.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/strip-comments";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string, why?: string) => { failed++; console.error(`  ✗ ${m}${why ? `\n      ${why}` : ""}`); };
const expect = (cond: boolean, m: string, why?: string) => (cond ? ok(m) : fail(m, why));

const BARREL = /from\s+["'](@\/lib\/product-schema|@\/lib\/product-schema\/registry|@\/lib\/product-schema\/schemas\/[^"']+)["']/;
const strip = (src: string) => stripComments(src);
const isClient = (src: string) => /^\s*["']use client["'];?/.test(src);

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== "__tests__") walk(p, out); }
    else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

console.log("\n§1 no client module imports the registry");
const files = walk(path.join(ROOT, "src"));
let clientCount = 0;
const offenders: string[] = [];
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  if (!isClient(src)) continue;
  clientCount++;
  if (BARREL.test(strip(src))) offenders.push(path.relative(ROOT, f));
}
expect(clientCount > 100, `scanned ${clientCount} client modules`, "too few — is the \"use client\" detection broken?");
expect(offenders.length === 0, "no \"use client\" module imports @/lib/product-schema (the barrel) or its registry/templates", offenders.join("\n      "));
{
  const mutated = strip('"use client";\nimport { resolveSchema } from "@/lib/product-schema";\n');
  expect(isClient(mutated) && BARREL.test(mutated), "  (the rule sees the failure direction)");
  const leaf = strip('"use client";\nimport { filterFieldsForSurface } from "@/lib/product-schema/visibility";\n');
  expect(!BARREL.test(leaf), "  (a leaf import passes)");
}

console.log("\n§2 the answers come from the route");
const client = strip(fs.readFileSync(path.join(ROOT, "src/lib/product-schema-client.ts"), "utf8"));
expect(/fetch\(`\/api\/product-schema\?\$\{/.test(client) && /fetch\("\/api\/product-schema\?all=1"/.test(client), "product-schema-client asks /api/product-schema for a resolution and for the list");
expect(fs.existsSync(path.join(ROOT, "src/app/api/product-schema/route.ts")), "the route exists");

console.log(failed ? `\n✗ schema barrel: ${failed} check(s) failed\n` : "\n✓ schema barrel: all checks passed\n");
process.exit(failed ? 1 : 0);
