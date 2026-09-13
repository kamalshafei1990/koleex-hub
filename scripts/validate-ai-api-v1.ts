/* ---------------------------------------------------------------------------
   validate:ai-api-v1 — Phase 2G gate.

   The versioned namespace exists so that the day a second client ships — the
   standalone web app, then desktop, then native — it pins a deliberate
   response contract instead of whatever the Hub components happened to need.

   The danger in adding a second URL for the same thing is that it becomes a
   second IMPLEMENTATION. Then auth, rate limits, the confirmation ledger and
   the seal chain have to be kept in sync by hand across two files, and the
   version that drifts is the one nobody is looking at. Every check here exists
   to keep that from happening: a v1 route must RE-EXPORT the legacy handler,
   never re-implement it.

   Owner decision, 2026-08-30 (Option A): requireInternalUser is unchanged on
   every route, v1 included. A versioned URL is not a looser door — and because
   v1 runs the identical function, it cannot be one.
   --------------------------------------------------------------------------- */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";

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

const V1_ROOT = "src/app/api/v1/ai";
const LEGACY_ROOT = "src/app/api/ai";
const read = (p: string) => readFileSync(p, "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function routeFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name === "route.ts") out.push(full);
    }
  };
  if (existsSync(root)) walk(root);
  return out.sort();
}

const v1Routes = routeFiles(V1_ROOT);
const legacyRoutes = routeFiles(LEGACY_ROOT);

console.log("\n── 1. The namespace exists and points somewhere real ──");
check(`v1 routes were found (${v1Routes.length})`, v1Routes.length > 0);
for (const f of v1Routes) {
  const code = strip(read(f));
  const m = code.match(/from\s+"([^"]+)"/);
  const target = m ? normalize(join(dirname(f), m[1])) + ".ts" : "";
  check(
    `${relative(V1_ROOT, f)} delegates to a real legacy route (${target ? relative(LEGACY_ROOT, target) : "NO IMPORT"})`,
    !!target && existsSync(target),
  );
}

console.log("\n── 2. v1 RE-EXPORTS; it does not re-implement ──");
/* The whole guarantee. A v1 file that grows its own handler body is a second
   implementation, and everything below stops being true of it. */
for (const f of v1Routes) {
  const code = strip(read(f));
  const reexports = /^export\s*\{[^}]+\}\s*from\s*"/m.test(code);
  const ownHandler = /^export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/m.test(code);
  check(`${relative(V1_ROOT, f)} re-exports its handlers`, reexports);
  check(`${relative(V1_ROOT, f)} defines no handler of its own`, !ownHandler);
}
for (const f of v1Routes) {
  const code = strip(read(f));
  check(
    `${relative(V1_ROOT, f)} contains no auth, rate-limit or seal logic of its own`,
    !/requireAuth|requireInternalUser|consumeBudget|sealFinalReply|supabaseServer|orchestrate\(/.test(code),
  );
}

console.log("\n── 3. Exposed methods match the legacy route exactly ──");
/* Fewer methods = a client silently loses a capability on v1. More = a method
   that does not exist. Both are drift; both fail here. */
function methodsOf(code: string): string[] {
  const c = strip(code);
  const set = new Set<string>();
  for (const m of c.matchAll(/^export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/gm)) set.add(m[1]);
  for (const m of c.matchAll(/^export\s*\{([^}]+)\}\s*from/gm)) {
    for (const raw of m[1].split(",")) {
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(name)) set.add(name);
    }
  }
  return [...set].sort();
}
for (const f of v1Routes) {
  const m = strip(read(f)).match(/from\s+"([^"]+)"/);
  const target = m ? normalize(join(dirname(f), m[1])) + ".ts" : "";
  if (!existsSync(target)) continue;
  const a = methodsOf(read(f));
  const b = methodsOf(read(target));
  check(
    `${relative(V1_ROOT, f)} exposes exactly the legacy methods (${b.join("/") || "none"})`,
    JSON.stringify(a) === JSON.stringify(b),
  );
}

console.log("\n── 4. Route segment config is not silently lost ──");
/* maxDuration and dynamic are read STATICALLY by the compiler from the route
   file, so they cannot be re-exported — they must be restated. A v1 route that
   forgets maxDuration would time out at the platform default on exactly the
   endpoint that needs 120s. */
function segConfig(code: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of strip(code).matchAll(/^export\s+const\s+(maxDuration|dynamic|runtime|revalidate|preferredRegion|fetchCache)\s*=\s*([^;]+);/gm)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}
for (const f of v1Routes) {
  const m = strip(read(f)).match(/from\s+"([^"]+)"/);
  const target = m ? normalize(join(dirname(f), m[1])) + ".ts" : "";
  if (!existsSync(target)) continue;
  const a = segConfig(read(f));
  const b = segConfig(read(target));
  const same = JSON.stringify(a) === JSON.stringify(b);
  check(
    `${relative(V1_ROOT, f)} carries the legacy segment config${same ? (Object.keys(b).length ? ` (${Object.entries(b).map(([k, v]) => `${k}=${v}`).join(", ")})` : " (none)") : ` — legacy ${JSON.stringify(b)} vs v1 ${JSON.stringify(a)}`}`,
    same,
  );
}

console.log("\n── 5. The legacy namespace is untouched ──");
check(
  `every legacy AI route still exists (${legacyRoutes.length})`,
  legacyRoutes.length >= 15,
);
check(
  "no legacy route was turned into a re-export of v1 (the delegation runs one way)",
  legacyRoutes.every((f) => !/from\s+"[^"]*\/v1\//.test(read(f))),
);
check(
  "requireInternalUser still guards the agent route (owner decision: Option A)",
  /requireInternalUser\(auth\)/.test(read(`${LEGACY_ROOT}/agent/route.ts`)),
);
{
  /* Classify EVERY route rather than counting. A threshold ("at least 12 of
     15") passes while the wrong three are the unguarded ones, and it was the
     first version of this check — it failed on a guessed number and taught
     nothing. Each route must carry the internal door OR the stricter
     super-admin gate; anything else is named.

     The super-admin routes use `auth.is_super_admin` (snake_case, the auth
     field), NOT `isSuperAdmin` (the UserContext field). A first pass grepped
     for the camelCase name, found nothing, and nearly reported the knowledge
     approval bench as unguarded — a false security finding avoided only by
     opening the file. */
  /* THE VOICE ROUTES GO THROUGH ONE SHARED GATE (ai/voice/gate.ts) rather than
     each carrying the chain, because a second copy of the chain is how the
     door got dropped from the session route once. The scan recognises that
     gate as the door ONLY because the next check proves the gate carries it —
     a recognised name with nothing behind it would be a hole with a label. */
  const gateSrc = read("src/lib/server/ai/voice/gate.ts");
  check(
    "the shared voice gate carries the internal door itself",
    /requireInternalUser\(auth\)/.test(gateSrc) && /export async function authorizeVoice\(/.test(gateSrc),
  );
  const hasInternalDoor = (c: string) => /requireInternalUser\(/.test(c) || /await authorizeVoice\(req\)|const authorize = authorizeVoice;/.test(c);
  const ungated = legacyRoutes.filter((f) => {
    const c = read(f);
    return !hasInternalDoor(c) && !/auth\.is_super_admin/.test(c);
  });
  check(
    `every legacy AI route carries the internal door or the super-admin gate${ungated.length ? ` — ungated: ${ungated.map((f) => relative(LEGACY_ROOT, f)).join(", ")}` : ""}`,
    ungated.length === 0,
  );
  const superAdminOnly = legacyRoutes.filter((f) => !hasInternalDoor(read(f)));
  check(
    `the knowledge approval bench is super-admin gated, stricter than internal (${superAdminOnly.length} routes)`,
    superAdminOnly.every((f) => /auth\.is_super_admin/.test(read(f))),
  );
}

console.log("\n── 6. No new schema was introduced (owner decision 1) ──");
{
  /* Anchored on the exact table name. A first version matched /ai_sessions/
     against filenames and flagged `qa_ai_sessions_phase8.sql` — an unrelated
     QA table that has existed for months. Substring matching produced a false
     positive here exactly as it did in the audit-Issue-2 case; the check now
     looks for the table being CREATED, not for a filename containing the
     word. */
  const migrations = readdirSync("supabase/migrations");
  const creators = migrations.filter((m) =>
    /create\s+table[^;]{0,80}?(?<![a-z_])ai_sessions\b/i.test(read(join("supabase/migrations", m))),
  );
  check(
    `no migration creates an ai_sessions table (owner decision: it is not needed)${creators.length ? ` — found in ${creators.join(", ")}` : ""}`,
    creators.length === 0,
  );
  check(
    "the pre-existing qa_ai_sessions table is untouched — it is unrelated and was not the subject of that decision",
    migrations.includes("qa_ai_sessions_phase8.sql"),
  );
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("v1 IS the legacy handler — not a copy of it. That is what makes the rest of this suite true.");
