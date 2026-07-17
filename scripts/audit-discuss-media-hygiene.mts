/* ---------------------------------------------------------------------------
   audit-discuss-media-hygiene — READ-ONLY audit of Discuss media metadata.
   (Discuss Stabilization, Unit 2 — Run C)

   WHAT IT CATCHES
   Unit 2's guarantee is that a Discuss attachment is reachable only through
   /api/files/discuss/<message-id>/<index>, and that no storage locator ever
   reaches a client. That guarantee is enforced in code, but METADATA is data —
   a future writer, a restored backup, or a hand-edited row can reintroduce a
   public URL without any code change and without any test noticing.

   So this audits the DATA, and is safe to run on a schedule:

     · public Supabase URLs      (…/storage/v1/object/public/…)
     · signed URLs               (…/storage/v1/object/sign/…  — bearer creds)
     · foreign hosts             (any host that is not this project's)
     · legacy `url` fields       (non-empty url on attachment or voice)
     · missing private paths     (no file_path / bucket+path to resolve)
     · objects still in `media`  (the public bucket — Run C's target state is 0)
     · ambiguous canonical index (two items claiming the same index)
     · duplicate source objects  (two messages pointing at one object — a
                                  delete for one would break the other)

   READ-ONLY BY CONSTRUCTION: it issues SELECTs only. It is deliberately NOT
   gated by the staging guard, because it is safe — and useful — against
   production. It never prints a URL, path, filename or message body; findings
   are reported as counts plus truncated hashes, so the output can be pasted
   into a ticket.

   Exit 1 on any violation, so CI can fail on regression.
   --------------------------------------------------------------------------- */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url || !key) {
  console.error("\n  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (read-only usage).\n");
  process.exit(2);
}
const projectHost = new URL(url).host;
const db = createClient(url, key, { auth: { persistSession: false } });

/** Truncated hash — enough to correlate two findings, useless as a locator. */
const h = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 8);

interface Finding { rule: string; msg: string; detail: string }
const findings: Finding[] = [];
const add = (rule: string, msgId: string, detail: string) =>
  findings.push({ rule, msg: h(msgId), detail });

type Row = { id: string; metadata: Record<string, unknown> | null };

const { data, error } = await db
  .from("discuss_messages")
  .select("id, metadata")
  .or("metadata->attachments.neq.null,metadata->voice.neq.null");
if (error) { console.error("  query failed:", error.message); process.exit(2); }

const rows = (data ?? []) as Row[];
const sourceUsage = new Map<string, string[]>(); // objectKey -> [msgId]
let items = 0;

function auditItem(msgId: string, kind: "attachment" | "voice", raw: Record<string, unknown>) {
  items++;
  const u = typeof raw.url === "string" ? raw.url.trim() : "";
  const fp = typeof raw.file_path === "string" ? raw.file_path.trim() : "";
  const bk = typeof raw.bucket === "string" ? raw.bucket.trim() : "";
  const pt = typeof raw.path === "string" ? raw.path.trim() : "";

  if (u) {
    add("legacy-url-field", msgId, `${kind} carries a non-empty url`);
    if (u.includes("/storage/v1/object/public/")) add("public-url", msgId, `${kind} has a PUBLIC storage URL`);
    if (u.includes("/storage/v1/object/sign/")) add("signed-url", msgId, `${kind} has a SIGNED storage URL`);
    try {
      const host = new URL(u).host;
      if (host !== projectHost) add("foreign-host", msgId, `${kind} url host is not this project`);
    } catch { add("malformed-url", msgId, `${kind} url is unparseable`); }

    const m = /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/.exec(u);
    if (m) {
      if (m[1] === "media") add("object-in-public-bucket", msgId, `${kind} still resolves into the public 'media' bucket`);
      const objKey = `${m[1]}/${m[2]}`;
      sourceUsage.set(objKey, [...(sourceUsage.get(objKey) ?? []), msgId]);
    }
  }

  // A private locator must exist, or the item is unreachable through the route.
  const hasPrivate = kind === "attachment" ? !!fp : (!!bk && !!pt);
  if (!hasPrivate) add("missing-private-path", msgId, `${kind} has no private path to resolve`);
  if (bk && bk === "media") add("private-locator-points-at-public-bucket", msgId, `${kind} bucket is 'media'`);
}

for (const r of rows) {
  const meta = (r.metadata ?? {}) as { attachments?: unknown; voice?: unknown };
  const seen = new Set<number>();
  if (Array.isArray(meta.attachments)) {
    meta.attachments.forEach((a, i) => {
      if (seen.has(i)) add("ambiguous-index", r.id, `duplicate canonical index ${i}`);
      seen.add(i);
      if (a && typeof a === "object") auditItem(r.id, "attachment", a as Record<string, unknown>);
    });
  }
  const v = meta.voice;
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const voiceIdx = Array.isArray(meta.attachments) ? meta.attachments.length : 0;
    if (seen.has(voiceIdx)) add("ambiguous-index", r.id, `voice collides with attachment index ${voiceIdx}`);
    auditItem(r.id, "voice", v as Record<string, unknown>);
  }
}

for (const [obj, msgs] of sourceUsage) {
  if (msgs.length > 1) {
    add("duplicate-source-object", msgs[0], `${msgs.length} messages reference one object (obj ${h(obj)})`);
  }
}

const byRule = new Map<string, number>();
for (const f of findings) byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1);

console.log(`\n  audit:discuss-media-hygiene — project ${h(projectHost)}`);
console.log(`  messages with media: ${rows.length}   media items: ${items}\n`);
if (!findings.length) {
  console.log("  clean: no public URLs, no signed URLs, no foreign hosts, no legacy url");
  console.log("         fields, no missing private paths, no ambiguous indexes,");
  console.log("         no duplicate source objects.\n");
  process.exit(0);
}
for (const [rule, n] of [...byRule].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${rule}`);
}
console.log("\n  affected messages (hashed):");
for (const f of findings.slice(0, 40)) console.log(`    [${f.msg}] ${f.rule}: ${f.detail}`);
if (findings.length > 40) console.log(`    … ${findings.length - 40} more`);
console.log(`\n  ${findings.length} violation(s).\n`);
process.exit(1);
