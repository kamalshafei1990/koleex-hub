#!/usr/bin/env node
/* validate:discuss-idempotency — Discuss Stabilization, Unit 1 (Phase 3).
   Deterministic static guards (no DB / no browser) over the message-identity
   contract. The DATABASE half of this contract (unique index enforces, NULLs
   allowed, cross-channel allowed, legacy rows untouched) is proven separately
   against the live database and recorded in
   docs/performance/DISCUSS_RELIABILITY_TEST_RESULTS.md.

   These guards lock the CODE half so a later edit cannot silently reintroduce
   duplicate sends:
   (A) client mints one stable UUID per logical send and reuses it;
   (B) server inserts it and treats a uniqueness conflict as idempotent SUCCESS;
   (C) the replay path re-checks membership and does NOT re-notify;
   (D) double-send + IME protections stay in place.
   Run: node --import tsx scripts/validate-discuss-idempotency.mts */
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = (p: string) => path.resolve(__dirname, "..", p);
const read = (p: string) => fs.readFileSync(R(p), "utf8");

let pass = 0, fail = 0;
const check = (n: string, c: boolean) => { c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.error("  ✗ " + n)); };

const app = read("src/components/discuss/DiscussApp.tsx");
const lib = read("src/lib/discuss.ts");
const route = read("src/app/api/discuss/mutate/route.ts");
const types = read("src/types/supabase.ts");

/* ── A. Client: one stable key per logical send ───────────────────────────── */
check("client mints a UUID per send (not a collidable timestamp)",
  /const clientMsgId = crypto\.randomUUID\(\)/.test(app));
/* Negative assertion targets a real ASSIGNMENT, not any mention — the source
   comment legitimately names the old collidable pattern to explain the fix. */
check("temp id derives from that UUID (no `temp_${Date.now()}` collision)",
  /const tempId = `temp_\$\{clientMsgId\}`/.test(app)
  && !/const tempId\s*=\s*`temp_\$\{Date\.now\(\)\}`/.test(app));
check("the key is sent to the server on every send",
  /clientMsgId,/.test(app) && /sendDiscussMessage\(/.test(app));
check("send lib forwards clientMsgId in the mutate payload",
  /clientMsgId\?: string/.test(lib) && /clientMsgId: input\.clientMsgId \?\? null/.test(lib));

/* ── B. Server: insert the key + conflict = idempotent success ────────────── */
check("server reads clientMsgId from the request", /const clientMsgId = str\(p\.clientMsgId\)/.test(route));
check("server persists it on insert", /client_msg_id: clientMsgId/.test(route));
check("unique_violation (23505) is handled, not surfaced as an error",
  /error\.code === "23505"/.test(route));
check("replay returns the EXISTING canonical row", /\.eq\("client_msg_id", clientMsgId\)/.test(route));
check("replay is scoped to the channel (key is per-channel, not global)",
  /\.eq\("channel_id", channelId\)\s*\n\s*\.eq\("client_msg_id", clientMsgId\)/.test(route));
check("replay responds ok:true (reported as idempotent success)",
  /\{ ok: true, data: existing, idempotent: true \}/.test(route));

/* ── C. Replay must not bypass authz and must not re-notify ───────────────── */
{
  const send = route.slice(route.indexOf('case "sendMessage"'), route.indexOf('case "editMessage"'));
  const iMember = send.indexOf("isMember(channelId)");
  const iInsert = send.indexOf(".insert({");
  const iConflict = send.indexOf('error.code === "23505"');
  const iNotify = send.indexOf("const notifyMembers");
  check("membership is checked BEFORE the insert", iMember > -1 && iInsert > -1 && iMember < iInsert);
  check("membership is checked BEFORE the idempotent replay can return a row",
    iMember > -1 && iConflict > -1 && iMember < iConflict);
  check("replay returns before notifyMembers is ever defined/dispatched (no duplicate realtime/push)",
    iConflict > -1 && iNotify > -1 && iConflict < iNotify
      && /return NextResponse\.json\(\s*\{ ok: true, data: existing, idempotent: true \}/.test(send));
}

/* ── D. Double-send + IME protection ──────────────────────────────────────── */
check("synchronous ref guard exists (state alone cannot stop 2 sends in one tick)",
  /const sendingRef = useRef\(false\)/.test(app));
check("handleSend bails when a send is already in flight", /if \(sendingRef\.current\) return;/.test(app));
check("the guard is released after the send settles", /sendingRef\.current = false;/.test(app));
check("Enter does not send while an IME is composing (Chinese/Japanese input)",
  /nativeEvent\.isComposing \|\| e\.keyCode === 229/.test(app));

/* ── E. Schema typing ─────────────────────────────────────────────────────── */
check("DiscussMessageRow types client_msg_id as nullable (legacy rows)",
  /client_msg_id: string \| null;/.test(types));

/* ── F. Privacy: the key is an opaque UUID, never message content ─────────── */
check("no message body is logged alongside the key", !/console\.log\([^)]*body/.test(route));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
