/* ---------------------------------------------------------------------------
   validate:ai-deepcheck — the findings of the 2026-09-24 deep check, pinned.

   Owner, 2026-09-24: "make a deep check for this app and fix any issue or
   bug". Five read-only audits (chat client, voice, server, performance,
   UI/UX) produced the list; each fix below is held by a check here so the
   next change cannot quietly undo it. The same-turn confirm guard lives in
   validate:ai-confirm-ledger beside the rest of the ledger.

   Phase 1 — security.
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}`);
  }
}
const read = (p: string) => readFileSync(p, "utf8");

console.log("\n── 1. Viewing as someone is read-only on every AI write ──");
{
  const writes: Array<[string, RegExp]> = [
    ["src/app/api/ai/agent/route.ts", /export async function POST\(req: Request\) \{[\s\S]{0,400}?requireAuth\(req\)/],
    ["src/app/api/ai/conversations/route.ts", /export async function POST\(req: Request\) \{\s*const auth = await requireAuth\(req\);/],
    ["src/app/api/ai/conversations/[id]/route.ts", /export async function PATCH\(req: Request, \{ params \}: RouteCtx\) \{\s*const auth = await requireAuth\(req\);/],
    ["src/app/api/ai/conversations/[id]/route.ts", /export async function DELETE\(req: Request, \{ params \}: RouteCtx\) \{\s*const auth = await requireAuth\(req\);/],
    ["src/app/api/ai/projects/route.ts", /export async function POST\(req: Request\) \{\s*const auth = await requireAuth\(req\);/],
    ["src/app/api/ai/projects/[id]/route.ts", /export async function PATCH\(req: Request, \{ params \}: RouteCtx\) \{\s*const auth = await requireAuth\(req\);/],
    ["src/app/api/ai/projects/[id]/route.ts", /export async function DELETE\(req: Request, \{ params \}: RouteCtx\) \{\s*const auth = await requireAuth\(req\);/],
    ["src/app/api/ai/feedback/route.ts", /export async function POST\(req: Request\) \{\s*const auth = await requireAuth\(req\);/],
    ["src/app/api/ai/attachments/route.ts", /export async function POST\(req: Request\) \{\s*const auth = await requireAuth\(req\);/],
    ["src/app/api/ai/attachments/chunk/route.ts", /export async function POST\(req: Request\) \{\s*const auth = await requireAuth\(req\);/],
  ];
  for (const [file, re] of writes) {
    const name = file.replace("src/app/api/ai/", "").replace("/route.ts", "");
    check(`${name}: the write handler hands its request to requireAuth, which refuses writes while viewing as`, re.test(read(file)));
  }
  check("requireAuth(req) is what blocks a mutating method while viewing as",
    /if \(req && auth\.viewing_as\) \{[\s\S]{0,200}method !== "GET" && method !== "HEAD" && method !== "OPTIONS"/.test(read("src/lib/server/auth.ts")));
}

console.log("\n── 2. Attachments read only the caller's own uploads ──");
{
  const att = read("src/app/api/ai/attachments/route.ts");
  check("the direct storage-path mode is gone: nothing downloads or deletes a path a ref names",
    !/async function extractFromStorage\(/.test(att) && !/\.download\(path\)/.test(att) && !/\.remove\(\[path\]\)/.test(att));
  check("a ref without an upload id is refused, not read",
    /\} else \{\s*\/\*[^*]*\*\/\s*const name = [^;]+;\s*results\.push\(\{ name, error: "read_failed" \}\);/.test(att));
  check("relayed pieces are still read from the signed-in account's own folder",
    /results\.push\(await extractFromParts\(ref, auth\.account_id, question\)\);/.test(att));
}

console.log("\n── 3. The chat list on this device belongs to one account ──");
{
  const app = read("src/components/ai/KoleexAiApp.tsx");
  check("the cache key carries the account id, and no account means no cache",
    /const id = getCurrentAccountIdSync\(\);\s*return id \? `koleex-ai-conversations-cache-v3:\$\{id\}` : null;/.test(app));
  check("the old shared key is removed and never written again",
    /sessionStorage\.removeItem\("koleex-ai-conversations-cache-v2"\)/.test(app) && !/setItem\("koleex-ai-conversations-cache-v2"/.test(app) && !/CONV_CACHE_KEY/.test(app));
  check("a refused list (401/403) clears what is on screen instead of leaving another account's rows",
    /if \(res\.status === 401 \|\| res\.status === 403\) \{\s*setConversations\(\[\]\);\s*return;\s*\}/.test(app));
}

console.log("\n── 4. Knowledge-base text is data, not instructions ──");
{
  const kn = read("src/lib/server/ai-knowledge.ts");
  const nudge = kn.slice(kn.indexOf("export async function getKnowledgeNudgeBlock("));
  check("the nudge's document lines go into the prompt inside the per-turn untrusted fence",
    /fenceUntrusted\(lines\.join\("\\n"\), "document", "Koleex knowledge base", newFenceId\(\)\)/.test(nudge) &&
      !/\+\s*lines\.join\("\\n"\)\s*\)/.test(nudge));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
