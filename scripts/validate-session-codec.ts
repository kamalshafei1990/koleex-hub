#!/usr/bin/env tsx

/* ===========================================================================
   B1c-2a — Session v2 dual-read codec validator.

   Isolated, runtime-free assertions over src/lib/server/session-codec.ts.
   No Supabase, no cookies, no env — a fixed secret is passed in.

   Proves:
     · v1 (accountId.HMAC) parses exactly as the legacy session.ts did
     · v1 tamper / malformed → null (fail closed)
     · v2 (payload.HMAC) parses with tenant/branch
     · v2 tamper / bad-json / wrong-version / missing-aid / bad-tid → null
     · v1 and v2 signatures are domain-separated (no cross-replay)
   ========================================================================== */

import { createHmac } from "node:crypto";
import {
  parseSessionValue,
  buildSessionValueV2,
  signV1,
  signV2,
} from "../src/lib/server/session-codec";

const SECRET = "test-secret-please-ignore-0123456789abcdef"; // >= 32 chars
const AID = "11111111-1111-4111-8111-111111111111";
const TID = "22222222-2222-4222-8222-222222222222";
const BID = "33333333-3333-4333-8333-333333333333";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}`);
  }
}

/* ── v1 ──────────────────────────────────────────────────────────────── */
const v1 = `${AID}.${signV1(AID, SECRET)}`;
const p1 = parseSessionValue(v1, SECRET);
check("valid v1 → parsed", !!p1 && p1.sessionVersion === 1 && p1.accountId === AID);
check("valid v1 → no tenant/branch", !!p1 && p1.activeTenantId === null && p1.activeBranchId === null);

// v1 identical to the LEGACY getSessionAccountId logic (indexOf slice + HMAC verify)
function legacyV1AccountId(raw: string): string | null {
  const dot = raw.indexOf(".");
  if (dot < 0) return null;
  const id = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const expected = createHmac("sha256", SECRET).update(id).digest("base64url");
  return expected === sig ? id : null;
}
check("v1 behaviour identical to legacy parser", legacyV1AccountId(v1) === (p1?.accountId ?? null));

check("tampered v1 sig → null", parseSessionValue(`${AID}.${signV1(AID, SECRET)}X`, SECRET) === null);
check("malformed v1 (no dot) → null", parseSessionValue(AID, SECRET) === null);
check("malformed v1 (non-uuid head, garbage) → null", parseSessionValue("not-a-uuid.sig", SECRET) === null);
check("wrong-secret v1 → null", parseSessionValue(v1, "another-secret-0123456789abcdefghij") === null);

/* ── v2 ──────────────────────────────────────────────────────────────── */
const v2 = buildSessionValueV2({ aid: AID, tid: TID, bid: BID, iat: 1700000000 }, SECRET);
const p2 = parseSessionValue(v2, SECRET);
check("valid v2 → parsed", !!p2 && p2.sessionVersion === 2 && p2.accountId === AID);
check("valid v2 → tenant + branch", !!p2 && p2.activeTenantId === TID && p2.activeBranchId === BID);

const v2noTenant = buildSessionValueV2({ aid: AID, tid: null, bid: null, iat: 1700000000 }, SECRET);
const p2n = parseSessionValue(v2noTenant, SECRET);
check("valid v2 no tenant/branch → nulls", !!p2n && p2n.activeTenantId === null && p2n.activeBranchId === null);

check("tampered v2 sig → null", parseSessionValue(v2.replace(/.$/, (c) => (c === "A" ? "B" : "A")), SECRET) === null);

// tampered payload (flip a char in the head) → sig no longer matches
const [head, sig] = v2.split(".");
const flippedHead = head.slice(0, -1) + (head.slice(-1) === "A" ? "B" : "A");
check("tampered v2 payload → null", parseSessionValue(`${flippedHead}.${sig}`, SECRET) === null);

// invalid JSON but correctly signed → still null
const badJsonPayload = Buffer.from("this is not json", "utf8").toString("base64url");
check("v2 invalid JSON → null", parseSessionValue(`${badJsonPayload}.${signV2(badJsonPayload, SECRET)}`, SECRET) === null);

function signedV2(obj: unknown): string {
  const payload = Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
  return `${payload}.${signV2(payload, SECRET)}`;
}
check("v2 wrong version → null", parseSessionValue(signedV2({ v: 3, aid: AID, tid: null, bid: null, iat: 1 }), SECRET) === null);
check("v2 missing aid → null", parseSessionValue(signedV2({ v: 2, tid: null, bid: null, iat: 1 }), SECRET) === null);
check("v2 non-uuid aid → null", parseSessionValue(signedV2({ v: 2, aid: "nope", tid: null, bid: null, iat: 1 }), SECRET) === null);
check("v2 invalid tid → null", parseSessionValue(signedV2({ v: 2, aid: AID, tid: "nope", bid: null, iat: 1 }), SECRET) === null);
check("v2 invalid bid → null", parseSessionValue(signedV2({ v: 2, aid: AID, tid: null, bid: "nope", iat: 1 }), SECRET) === null);
check("v2 missing iat → null", parseSessionValue(signedV2({ v: 2, aid: AID, tid: null, bid: null }), SECRET) === null);

/* ── cross-domain replay ─────────────────────────────────────────────── */
// A v2 payload signed with the v1 algorithm must NOT verify as v2.
check("v1-signed v2 payload → null", parseSessionValue(`${head}.${signV1(head, SECRET)}`, SECRET) === null);

console.log(`\nsession-codec: ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
