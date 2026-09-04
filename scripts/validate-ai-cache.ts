/* ---------------------------------------------------------------------------
   validate:ai-cache — Phase 5C gate.

   A retrieval cache is a small performance change with one large failure mode:
   a key that omits the tenant serves one tenant's approved knowledge — source
   titles, page numbers, document bodies — into another tenant's prompt, for
   the length of the TTL. It behaves perfectly in every single-tenant test, and
   it looks like a performance win in review.

   So most of this suite is about the KEY, not about caching. The performance
   properties (TTL, bounded memory) are checked too, because an unbounded Map
   on a warm serverless instance is its own outage.
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import { createTenantCache, cacheKey } from "../src/lib/server/ai/cache/tenant-cache";

let pass = 0;
const failures: string[] = [];
function check(label: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(label);
    console.log(`  ✗ ${label}`);
  }
}

console.log("\n── 1. Tenant isolation: the reason this file exists ──");
{
  const c = createTenantCache<string>();
  c.set("tenant-a", "warranty", "A's approved knowledge");

  check("a tenant reads back its own entry", c.get("tenant-a", "warranty") === "A's approved knowledge");
  check(
    "ANOTHER TENANT WITH THE SAME QUERY GETS NOTHING — the leak this guards",
    c.get("tenant-b", "warranty") === undefined,
  );
  check(
    "and the platform namespace is not a back door into a tenant's entry",
    c.get(null, "warranty") === undefined,
  );

  c.set(null, "warranty", "platform knowledge");
  check("null is its own namespace, not an absent one", c.get(null, "warranty") === "platform knowledge");
  check("and writing it did not overwrite the tenant's entry", c.get("tenant-a", "warranty") === "A's approved knowledge");

  /* An id containing the separator must not be able to forge another key.
     String concatenation would let "a" + sep + "b:k" collide with "a:b" + sep
     + "k"; the JSON tuple cannot. */
  const forge = createTenantCache<string>();
  forge.set('a", "x', "k", "forged");
  check(
    "an id containing quotes or separators cannot forge another tenant's key",
    forge.get("a", '", "x", "k') === undefined && forge.get('a", "x', "k") === "forged",
  );
  check(
    "keys for different tenants are genuinely different strings",
    cacheKey("t1", "k") !== cacheKey("t2", "k") && cacheKey(null, "k") !== cacheKey("", "k"),
  );

  /* invalidateTenant must not clear a NEIGHBOUR whose id is a prefix. */
  const inv = createTenantCache<string>();
  inv.set("ab", "k", "neighbour");
  inv.set("abc", "k", "target");
  inv.invalidateTenant("abc");
  check(
    "invalidating a tenant does not clear one whose id is a prefix of it",
    inv.get("ab", "k") === "neighbour" && inv.get("abc", "k") === undefined,
  );
}

console.log("\n── 2. Expiry, and what a miss means ──");
{
  let clock = 1_000_000;
  const c = createTenantCache<string>({ ttlMs: 60_000, now: () => clock });
  c.set("t", "k", "v");
  check("a fresh entry hits", c.get("t", "k") === "v");
  clock += 59_999;
  check("it is still live one millisecond before the TTL", c.get("t", "k") === "v");
  clock += 1;
  check("and it is gone AT the TTL, not after it", c.get("t", "k") === undefined);
  check("an expired entry is dropped, not left to grow the map", c.size() === 0);
  check("a miss is undefined — the caller does the real work", c.get("t", "never-written") === undefined);
}

console.log("\n── 3. Bounded memory: serverless has no durable RAM ──");
{
  const c = createTenantCache<number>({ maxEntries: 3, ttlMs: 60_000 });
  for (let i = 0; i < 10; i++) c.set("t", `k${i}`, i);
  check(`the map never exceeds its cap (size=${c.size()})`, c.size() === 3);
  check("the newest entries survive", c.get("t", "k9") === 9 && c.get("t", "k8") === 8);
  check("the oldest were evicted", c.get("t", "k0") === undefined);

  /* A refreshed key must move to the back of the eviction order, or a HOT key
     is evicted ahead of colder ones written after it — the pathological case
     where the cache's most valuable entry is the one it keeps throwing away. */
  const h = createTenantCache<number>({ maxEntries: 3, ttlMs: 60_000 });
  h.set("t", "hot", 1);
  h.set("t", "a", 1);
  h.set("t", "b", 1);
  h.set("t", "hot", 2);
  h.set("t", "c", 1);
  check("a refreshed key is not evicted ahead of colder entries written after it", h.get("t", "hot") === 2);

  /* One tenant filling the cache must not be able to hide another's data
     wrongly — eviction may cost a hit, but never a wrong answer. */
  const m = createTenantCache<string>({ maxEntries: 2, ttlMs: 60_000 });
  m.set("a", "k", "A");
  m.set("b", "k", "B");
  m.set("c", "k", "C");
  check(
    "eviction across tenants loses hits but never returns another tenant's value",
    m.get("a", "k") === undefined && m.get("b", "k") === "B" && m.get("c", "k") === "C",
  );
}

console.log("\n── 4. The knowledge search uses it, correctly ──");
{
  const src = readFileSync("src/lib/server/ai-knowledge.ts", "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  check("searchApprovedUnits consults the cache", /approvedSearchCache\.get\(tenantId,/.test(code));
  check("and writes through it with the tenant, not a composed string", /approvedSearchCache\.set\(tenantId,/.test(code));
  check(
    "the cache key includes the LIMIT — the same words at a different limit are a different result set",
    /approved:\$\{limit\}:/.test(code),
  );
  check(
    "the key is built from SORTED words, so word order does not fragment the cache",
    /\[\.\.\.words\]\.sort\(\)/.test(code),
  );
  /* The single most important line: caching an error result would pin an empty
     answer in front of a tenant's knowledge for the whole TTL. */
  const setIdx = code.indexOf("approvedSearchCache.set(");
  const errIdx = code.indexOf("if (error || !data) return [];");
  check(
    "only a SUCCESSFUL query is cached — the error path returns before the write",
    errIdx !== -1 && setIdx !== -1 && errIdx < setIdx,
  );
  check(
    "an invalidation hook exists, so an approval does not wait out the TTL",
    /export function invalidateApprovedSearchCache/.test(code),
  );
}

console.log("\n── 5. No bare cache may creep back in beside it ──");
/* The protection is only worth anything while it is the ONLY cache in this
   file. A plain `new Map()` added later, keyed on the query alone, reopens the
   exact hole — and would pass every test above, because those test the cache
   that IS keyed correctly. */
{
  const src = readFileSync("src/lib/server/ai-knowledge.ts", "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const maps = [...code.matchAll(/const (\w+)\s*=\s*new Map</g)].map((m) => m[1]);
  /* qaCache predates this phase and IS tenant-keyed — it stores by
     `tenantId ?? "platform"`. It is named here rather than pattern-matched, so
     a NEW Map cannot inherit its exemption by looking similar. */
  /* taughtRowsCache joins it for the same reason and under the same terms: it
     holds the owner's taught Q&A rows, it is keyed by `tenantId ?? "platform"`
     exactly as qaCache is, and it exists so the three lanes that need those
     rows — the written prompt block, the search tool a voice call reaches them
     through, and the taught-question index — share ONE query instead of three.
     The check below is what stops that being taken on trust. */
  const KNOWN_TENANT_KEYED = ["qaCache", "taughtRowsCache"];
  const unknown = maps.filter((m) => !KNOWN_TENANT_KEYED.includes(m));
  check(
    `every cache in ai-knowledge is accounted for${unknown.length ? ` — unreviewed: ${unknown.join(", ")}` : ""}`,
    unknown.length === 0,
  );
  check(
    "and the allowlisted one really is keyed by tenant (so the exemption is not vacuous)",
    /qaCache\.get\(key\)/.test(code) && /const key = tenantId \?\? "platform"/.test(code),
  );
  /* THE SAME PROOF FOR THE SECOND ONE. An allowlist entry with no assertion
     behind it is a hole with a comment over it: the whole point of this
     section is that a bare Map in this file cannot serve one tenant's
     knowledge into another's prompt, and "we reviewed it" is not that proof.
     Both the read and the write must go through a tenant-derived key. */
  check(
    "and so is the second — its read AND its write are keyed by tenant",
    /taughtRowsCache\.get\(key\)/.test(code) &&
      /taughtRowsCache\.set\(key, \{ at: Date\.now\(\), rows \}\)/.test(code) &&
      (code.match(/const key = tenantId \?\? "platform"/g) ?? []).length >= 2,
  );
  /* AND THAT INVALIDATION CLEARS BOTH. They hold the same rows in two shapes;
     dropping only the derived one rebuilds it from the stale source, which
     looks exactly like the bug it was meant to fix. */
  check(
    "invalidating taught knowledge drops the rows as well as the block",
    /qaCache\.delete\(key\)/.test(code) && /taughtRowsCache\.delete\(key\)/.test(code),
  );
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("The tenant is the first argument of every cache operation, so it cannot be forgotten.");
