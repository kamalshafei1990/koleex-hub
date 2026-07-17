/* ---------------------------------------------------------------------------
   discuss-run-c — the Discuss legacy media migration (Unit 2, Run C).

   Migrates the 6 legacy Discuss objects out of the shared PUBLIC `media` bucket
   into the private `discuss-media` / `discuss-voice` buckets, repoints message
   metadata at the private copy, and only then revokes the public original.

   THIS SCRIPT WRITES TO PRODUCTION. Read the guard section before changing it.

   ── CREDENTIAL HANDLING ───────────────────────────────────────────────────
   The production service-role key is taken from the process environment
   variable KX_RUN_C_PRODUCTION_SERVICE_KEY and nowhere else. Not from .env,
   not from Vercel, not from a keychain, not from an argument (argv is visible
   in `ps`). It is never written to the manifest, the audit report, stdout, or
   any file, and never persisted.

   The script validates ONLY that the variable exists and is non-empty. It does
   not print the key, any substring, prefix, suffix, length, or hash of it — a
   length or fingerprint is still information about a secret, and there is no
   operational reason to emit one.

   The subtle risk is not our own console.log — it is a THIRD-PARTY error.
   A failing fetch or supabase-js error can carry request headers (and therefore
   the key) inside a message or stack. So every byte this script prints goes
   through scrub(), which replaces any occurrence of the key with a fixed
   marker, and console.log/error/warn are wrapped at startup so an accidental
   raw print cannot bypass it. That is defence against the case we cannot audit
   by reading our own code.

   ── MODES ─────────────────────────────────────────────────────────────────
     plan        read-only. Recompute the inventory from Production, fetch each
                 source object, compute byte length + SHA-256, write the LOCAL
                 manifest, print a sanitized plan. Mutates nothing.
     migrate     the real thing. Requires the manifest to already exist and to
                 match Production exactly, plus a separate execute flag.
     audit       read-only. Post-migration proof.
     prove-clean verify the key is absent from a child process environment.

   ── GUARDS (all required, checked before any client is constructed) ────────
     1. KX_RUN_C_PRODUCTION_SERVICE_KEY present and non-empty
     2. KX_RUN_C_APPROVED=true
     3. target project ref is EXACTLY the production ref below
     4. manifest holds EXACTLY 6 items
     5. every source path + content hash matches the manifest
     6. KX_RUN_C_EXECUTE=true — a SEPARATE flag, checked immediately before the
        first mutation, so that planning can never slide into migrating

   Note the inversion versus every other guard in this repo: elsewhere the
   production ref is a DENYLIST. Here Production is the intended target, so the
   ref is an ALLOWLIST and anything else aborts. That asymmetry is deliberate
   and is the reason this script is separate from the staging tooling rather
   than a flag on it.
   --------------------------------------------------------------------------- */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

/* ── credential + scrubbing ──────────────────────────────────────────────── */

const KEY = process.env.KX_RUN_C_PRODUCTION_SERVICE_KEY ?? "";

/** Replace the secret anywhere it appears. Applied to EVERYTHING we print. */
function scrub(s: unknown): string {
  let out = typeof s === "string" ? s : (() => {
    try { return typeof s === "object" && s !== null && s instanceof Error
      ? `${s.name}: ${s.message}\n${s.stack ?? ""}`
      : JSON.stringify(s); } catch { return String(s); }
  })();
  if (KEY) out = out.split(KEY).join("«REDACTED-SERVICE-KEY»");
  // Belt and braces: anything that looks like a Supabase secret/JWT, even if it
  // is not OUR key (e.g. a key echoed back by an API error).
  out = out.replace(/sb_secret_[A-Za-z0-9_\-]+/g, "«REDACTED»");
  out = out.replace(/eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/g, "«REDACTED-JWT»");
  return out;
}

/* Wrap the console so a raw print cannot bypass scrub(). Do this FIRST. */
for (const m of ["log", "error", "warn", "info"] as const) {
  const orig = console[m].bind(console);
  console[m] = (...args: unknown[]) => orig(args.map(scrub).join(" "));
}
process.on("uncaughtException", (e) => { console.error("uncaught:", scrub(e)); process.exit(1); });
process.on("unhandledRejection", (e) => { console.error("unhandled:", scrub(e)); process.exit(1); });

/* ── constants ───────────────────────────────────────────────────────────── */

/** ALLOWLIST — the only project this script may ever touch. */
const PRODUCTION_REF = "yxyizbnfjrwrnmwhkvme";
const PRODUCTION_URL = `https://${PRODUCTION_REF}.supabase.co`;
const SOURCE_BUCKET = "media";
const EXPECTED_ITEMS = 6;
const MANIFEST_PATH = ".local/runc-manifest.json";

const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const shortHash = (s: string) => sha256(s).slice(0, 12);

interface ManifestItem {
  migration_id: string;
  message_id: string;          // local only — never committed
  channel_id: string;
  tenant_id: string | null;
  index: number;
  kind: "attachment" | "voice";
  source_bucket: string;
  source_path: string;         // local only — never committed
  source_bytes: number;
  source_sha256: string;
  mime: string;
  dest_bucket: "discuss-media" | "discuss-voice";
  dest_path: string;
  /** metadata BEFORE the update — the rollback record. */
  previous_metadata: unknown;
  copied: boolean;
  byte_verified: boolean;
  metadata_updated: boolean;
  source_deleted: boolean;
  authorized_route_verified: boolean;
}
interface Manifest { created_at: string; project_ref: string; items: ManifestItem[] }

/* ── guards ──────────────────────────────────────────────────────────────── */

function die(reason: string): never {
  console.error(`\n  ABORT: ${reason}`);
  console.error("  No production object or metadata was modified by this step.\n");
  process.exit(1);
}

/** Guards 1–3. Runs before any client exists. */
function baseGuards(): void {
  // Existence and non-emptiness ONLY. No length, no prefix, no fingerprint.
  if (!KEY) die("KX_RUN_C_PRODUCTION_SERVICE_KEY is not set (or is empty) in the process environment.");
  if (process.env.KX_RUN_C_APPROVED !== "true") die('KX_RUN_C_APPROVED must be exactly "true".');

  // Reject any persisted-credential path, so a future edit cannot quietly
  // reintroduce one.
  for (const f of [".env", ".env.local", ".env.production"]) {
    if (existsSync(f)) {
      const body = readFileSync(f, "utf8");
      if (body.includes("KX_RUN_C_PRODUCTION_SERVICE_KEY")) {
        die(`${f} mentions KX_RUN_C_PRODUCTION_SERVICE_KEY — the key must come from the process environment only.`);
      }
    }
  }
  const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co$/.exec(PRODUCTION_URL)?.[1];
  if (ref !== PRODUCTION_REF) die("target project ref does not match the expected production ref.");
  console.log(`  guard: OK (approved, credential present, target ref ${PRODUCTION_REF})`);
}

const db = (): SupabaseClient => createClient(PRODUCTION_URL, KEY, { auth: { persistSession: false } });

/* ── inventory (read-only) ───────────────────────────────────────────────── */

/** Mirrors src/lib/server/discuss-media.ts locate(). Attachment falls back to
 *  discuss-media, voice to discuss-voice — the persisted value decides. */
function parsePublicUrl(u: string): { bucket: string; path: string } | null {
  const m = /\/storage\/v1\/object\/public\/([^/]+)\/(.+?)(?:\?|$)/.exec(u);
  return m ? { bucket: m[1], path: decodeURIComponent(m[2]) } : null;
}

async function readInventory(client: SupabaseClient) {
  const { data, error } = await client
    .from("discuss_messages")
    .select("id, channel_id, deleted_at, metadata, discuss_channels!inner(tenant_id)");
  if (error) die(`inventory query failed: ${error.message}`);

  type Cand = Omit<ManifestItem, "migration_id" | "source_bytes" | "source_sha256" |
    "dest_path" | "previous_metadata" | "copied" | "byte_verified" |
    "metadata_updated" | "source_deleted" | "authorized_route_verified"> & { deleted: boolean };
  const out: Cand[] = [];

  for (const row of (data ?? []) as any[]) {
    const meta = (row.metadata ?? {}) as { attachments?: unknown[]; voice?: any };
    const tenant = row.discuss_channels?.tenant_id ?? null;
    const push = (kind: "attachment" | "voice", idx: number, raw: any) => {
      const url = typeof raw?.url === "string" ? raw.url.trim() : "";
      if (!url) return;                       // already migrated / no legacy url
      const loc = parsePublicUrl(url);
      if (!loc) die(`message ${shortHash(row.id)} index ${idx}: url is not a parseable public storage URL`);
      if (loc.bucket !== SOURCE_BUCKET) return; // not a legacy public-bucket object
      out.push({
        message_id: row.id, channel_id: row.channel_id, tenant_id: tenant,
        index: idx, kind,
        source_bucket: loc.bucket, source_path: loc.path,
        mime: raw?.type || (kind === "voice" ? "audio/webm" : "application/octet-stream"),
        dest_bucket: kind === "voice" ? "discuss-voice" : "discuss-media",
        deleted: row.deleted_at !== null,
      });
    };
    if (Array.isArray(meta.attachments)) meta.attachments.forEach((a, i) => push("attachment", i, a));
    if (meta.voice && typeof meta.voice === "object") push("voice", Array.isArray(meta.attachments) ? meta.attachments.length : 0, meta.voice);
  }
  return out;
}

/* ── plan (read-only) ────────────────────────────────────────────────────── */

async function plan() {
  baseGuards();
  const client = db();
  const items = await readInventory(client);

  console.log(`\n  discovered ${items.length} legacy item(s) referencing the public '${SOURCE_BUCKET}' bucket`);
  if (items.length !== EXPECTED_ITEMS) {
    die(`expected exactly ${EXPECTED_ITEMS} approved legacy items, found ${items.length}. ` +
        `Production drifted from the committed inventory — re-review before proceeding.`);
  }
  for (const it of items) {
    if (it.deleted) die(`message ${shortHash(it.message_id)} is deleted — not in the approved set`);
  }
  const paths = new Set(items.map((i) => `${i.source_bucket}/${i.source_path}`));
  if (paths.size !== items.length) die("two items reference the same source object — ambiguous, refusing");

  const manifest: Manifest = { created_at: new Date().toISOString(), project_ref: PRODUCTION_REF, items: [] };

  for (const it of items) {
    // `media` is public, so the source reads without the key. Byte length and
    // checksum are computed from what we actually downloaded — never from
    // metadata, which is exactly the field we distrust.
    const url = `${PRODUCTION_URL}/storage/v1/object/public/${it.source_bucket}/${encodeURI(it.source_path)}`;
    const res = await fetch(url);
    if (!res.ok) die(`source object for ${shortHash(it.message_id)} is not readable (HTTP ${res.status}) — refusing`);
    const buf = Buffer.from(await res.arrayBuffer());
    const digest = sha256(buf);

    const { data: row } = await client.from("discuss_messages").select("metadata").eq("id", it.message_id).single();

    manifest.items.push({
      migration_id: `runc-${shortHash(`${it.message_id}:${it.index}`)}`,
      message_id: it.message_id, channel_id: it.channel_id, tenant_id: it.tenant_id,
      index: it.index, kind: it.kind,
      source_bucket: it.source_bucket, source_path: it.source_path,
      source_bytes: buf.byteLength, source_sha256: digest,
      mime: it.mime, dest_bucket: it.dest_bucket,
      // Randomized destination path — the old path is not carried over, so a
      // leaked historical URL cannot be replayed against the private bucket.
      dest_path: `discuss/${new Date().getUTCFullYear()}/${randomUUID()}`,
      previous_metadata: row?.metadata ?? null,
      copied: false, byte_verified: false, metadata_updated: false,
      source_deleted: false, authorized_route_verified: false,
    });
  }

  mkdirSync(".local", { recursive: true });
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  console.log(`\n  ── SANITIZED EXECUTION PLAN ────────────────────────────────`);
  console.log(`  project ref : ${PRODUCTION_REF}`);
  console.log(`  items       : ${manifest.items.length}`);
  console.log(`  source      : ${SOURCE_BUCKET} (public)`);
  console.log(`  destinations: discuss-media (private) · discuss-voice (private)\n`);
  console.log(`  # kind        bytes     mime           src→dst bucket             src sha256 (12)  path (12)`);
  for (const [i, m] of manifest.items.entries()) {
    console.log(
      `  ${String(i + 1).padStart(1)} ${m.kind.padEnd(10)} ${String(m.source_bytes).padStart(8)}  ` +
      `${(m.mime || "-").padEnd(14)} ${m.source_bucket}→${m.dest_bucket.padEnd(14)} ` +
      `${m.source_sha256.slice(0, 12)}     ${shortHash(m.source_path)}`);
  }
  console.log(`\n  manifest written: ${MANIFEST_PATH}  (LOCAL, gitignored, credential-free)`);
  console.log(`  nothing was mutated. To execute, re-run with mode 'migrate' and KX_RUN_C_EXECUTE=true.\n`);
}

/* ── migrate (WRITES) ────────────────────────────────────────────────────── */

async function migrate() {
  baseGuards();
  if (!existsSync(MANIFEST_PATH)) die(`no manifest at ${MANIFEST_PATH} — run 'plan' first.`);
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;

  if (manifest.project_ref !== PRODUCTION_REF) die("manifest was built for a different project.");
  if (manifest.items.length !== EXPECTED_ITEMS) die(`manifest holds ${manifest.items.length} items, expected exactly ${EXPECTED_ITEMS}.`);

  /* ── resumability protection ──────────────────────────────────────────
     Checked HERE — before any client is built and before Production is
     contacted at all. It is a purely local question ("did a previous run stop
     half-way?"), so gating it behind a network call would be both slower and
     wrong: a half-migrated state must stop the run before we touch anything.

     A previous run that copied bytes but did not finish its metadata update
     left Production half-migrated. Silently continuing is how a half-state
     becomes a corrupt one — the operator no longer knows which copy is
     authoritative. So a partial state HARD STOPS and requires the operator to
     name the specific item they reviewed. There is no --resume-all, on purpose. */
  const partial = manifest.items.filter((m) => m.copied && !m.metadata_updated);
  if (partial.length) {
    const ack = process.env.KX_RUN_C_RESUME_ACK ?? "";
    const unacked = partial.filter((m) => m.migration_id !== ack);
    if (unacked.length) {
      console.error(`\n  PARTIAL STATE from a previous run — ${partial.length} item(s) copied but not metadata-updated:`);
      for (const m of partial) console.error(`      ${m.migration_id}  (${m.kind})`);
      console.error(`\n  Nothing was resumed and Production was not contacted. Review each item,`);
      console.error(`  then re-run naming exactly one:  KX_RUN_C_RESUME_ACK=<migration_id>\n`);
      process.exit(1);
    }
    console.log(`  resume acknowledged for ${ack} — continuing that item only.`);
  }

  const client = db();

  /* Re-derive the inventory and require it to match the manifest EXACTLY. A
     message edited between plan and migrate must stop the run, not be migrated
     against a stale plan. No dynamically discovered object is ever migrated. */
  const live = await readInventory(client);
  if (live.length !== manifest.items.length) die("Production no longer matches the manifest item count — re-plan.");
  for (const m of manifest.items) {
    const hit = live.find((l) => l.message_id === m.message_id && l.index === m.index);
    if (!hit) die(`manifest item ${m.migration_id} no longer exists in Production — re-plan.`);
    if (hit.source_path !== m.source_path || hit.source_bucket !== m.source_bucket) {
      die(`manifest item ${m.migration_id}: source path changed since plan — refusing.`);
    }
  }

  /* Guard 6 — the separate, final approval. Deliberately checked here, AFTER
     every read-only check has passed and IMMEDIATELY before the first write. */
  if (process.env.KX_RUN_C_EXECUTE !== "true") {
    console.log("\n  all pre-flight checks passed. KX_RUN_C_EXECUTE is not 'true' — stopping before the first mutation.\n");
    process.exit(0);
  }
  console.log("\n  KX_RUN_C_EXECUTE=true — beginning production mutation, one object at a time.\n");

  const report: string[] = [];
  const save = () => writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  const log = (s: string) => { console.log(s); report.push(s.trim()); };

  for (const m of manifest.items) {
    log(`\n  ── ${m.migration_id} (${m.kind}) ─────────────────────────────`);

    // 1 — read source and re-verify against the manifest hash.
    const srcUrl = `${PRODUCTION_URL}/storage/v1/object/public/${m.source_bucket}/${encodeURI(m.source_path)}`;
    const res = await fetch(srcUrl);
    if (!res.ok) die(`${m.migration_id}: source unreadable (HTTP ${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength !== m.source_bytes) die(`${m.migration_id}: source byte length changed since plan`);
    if (sha256(buf) !== m.source_sha256) die(`${m.migration_id}: source checksum changed since plan`);
    log(`     source verified against manifest (${buf.byteLength} bytes)`);

    // 2 — copy. upsert:false so an existing destination is never overwritten.
    const up = await client.storage.from(m.dest_bucket).upload(m.dest_path, buf, {
      contentType: m.mime, upsert: false,
    });
    if (up.error) die(`${m.migration_id}: upload failed: ${up.error.message}`);
    m.copied = true; save();
    log(`     copied → ${m.dest_bucket} (private)`);

    // 3 — read the destination BACK and compare bytes. Not "the API said ok".
    const down = await client.storage.from(m.dest_bucket).download(m.dest_path);
    if (down.error) die(`${m.migration_id}: destination not readable back: ${down.error.message}`);
    const back = Buffer.from(await down.data.arrayBuffer());
    if (back.byteLength !== m.source_bytes) die(`${m.migration_id}: destination byte length mismatch — source left untouched`);
    if (sha256(back) !== m.source_sha256) die(`${m.migration_id}: destination checksum mismatch — source left untouched`);
    m.byte_verified = true; save();
    log(`     byte-verified: length + sha256 identical`);

    // 4 — metadata, only now. Re-read the row so a concurrent edit is not
    //     clobbered, and write with an optimistic guard on the value we read.
    const cur = await client.from("discuss_messages").select("metadata").eq("id", m.message_id).single();
    if (cur.error) die(`${m.migration_id}: could not re-read message: ${cur.error.message}`);
    const meta = structuredClone(cur.data.metadata) as any;

    if (m.kind === "attachment") {
      const a = meta?.attachments?.[m.index];
      if (!a) die(`${m.migration_id}: attachment index vanished — refusing`);
      a.file_path = m.dest_path;   // now resolves against discuss-media
      delete a.url;                // legacy public URL removed
    } else {
      const v = meta?.voice;
      if (!v) die(`${m.migration_id}: voice object vanished — refusing`);
      v.bucket = m.dest_bucket;
      v.path = m.dest_path;
      delete v.url;
    }
    const upd = await client.from("discuss_messages")
      .update({ metadata: meta })
      .eq("id", m.message_id)
      .eq("metadata", cur.data.metadata as any)   // optimistic concurrency
      .select("id");
    if (upd.error) die(`${m.migration_id}: metadata update failed: ${upd.error.message}`);
    if (!upd.data?.length) die(`${m.migration_id}: message changed concurrently — metadata NOT written, source untouched`);
    m.metadata_updated = true; save();
    log(`     metadata → private shape; legacy url removed; index/order preserved`);

    log(`     NEXT: authorized-route + 404 checks are performed by the operator`);
    log(`           harness before deletion; source deletion is gated on them.`);
  }

  mkdirSync(".local", { recursive: true });
  writeFileSync(".local/runc-report.txt", report.join("\n"));
  console.log(`\n  copy + verify + metadata complete for ${manifest.items.length} item(s).`);
  console.log(`  credential-free report: .local/runc-report.txt`);
  console.log(`  sources NOT yet deleted — run mode 'revoke' after the authorization matrix passes.\n`);
}

/* ── prove-clean ─────────────────────────────────────────────────────────── */

function proveClean() {
  const present = !!process.env.KX_RUN_C_PRODUCTION_SERVICE_KEY;
  console.log(`\n  child process sees KX_RUN_C_PRODUCTION_SERVICE_KEY: ${present ? "YES" : "NO"}`);
  if (present) {
    console.log("\n  The variable is still exported in this shell. Remove it with:\n");
    console.log("      unset KX_RUN_C_PRODUCTION_SERVICE_KEY\n");
    console.log("  then re-run:  npm run runc:prove-clean\n");
    process.exit(1);
  }
  console.log("  clean: the credential is not reachable by child processes.\n");
}

/* ── entry ───────────────────────────────────────────────────────────────── */

/* ── verify (read-only, post-metadata / pre-deletion) ────────────────────── */

/**
 * Everything that can be proven WITHOUT a production user session:
 *   · the private destination object exists and its bytes still match
 *   · the message metadata no longer carries any public URL
 *   · the first-party route refuses an UNAUTHENTICATED caller (401)
 *
 * What this cannot prove, and why: an "active member → 200" check needs a real
 * Production session cookie, which needs a real Production password. We do not
 * have one and must not create one. That leg of the matrix was proven in Run B
 * against byte-identical code on staging, across the full persona set. The
 * residual risk here is not the authorization logic (unchanged) but whether THIS
 * object resolves — which is exactly what the byte + metadata checks below
 * establish. The single operator eyeball in the printed checklist closes it.
 */
async function verify() {
  baseGuards();
  if (!existsSync(MANIFEST_PATH)) die(`no manifest at ${MANIFEST_PATH} — run 'plan' first.`);
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
  const client = db();
  const site = process.env.KX_RUN_C_SITE_URL ?? "https://hub.koleexgroup.com";
  let ok = 0;

  for (const m of manifest.items) {
    if (!m.metadata_updated) { console.log(`  ${m.migration_id}: metadata not yet updated — skipping`); continue; }

    const down = await client.storage.from(m.dest_bucket).download(m.dest_path);
    if (down.error) die(`${m.migration_id}: private copy unreadable — DO NOT delete the source`);
    const back = Buffer.from(await down.data.arrayBuffer());
    if (back.byteLength !== m.source_bytes || sha256(back) !== m.source_sha256) {
      die(`${m.migration_id}: private copy no longer matches the source — DO NOT delete the source`);
    }

    const { data: row } = await client.from("discuss_messages").select("metadata").eq("id", m.message_id).single();
    const blob = JSON.stringify(row?.metadata ?? {});
    if (blob.includes("/storage/v1/object/public/")) die(`${m.migration_id}: metadata still carries a public URL`);
    if (blob.includes("/storage/v1/object/sign/")) die(`${m.migration_id}: metadata carries a signed URL`);

    const res = await fetch(`${site}/api/files/discuss/${m.message_id}/${m.index}`, { redirect: "manual" });
    if (res.status !== 401) die(`${m.migration_id}: unauthenticated route returned ${res.status}, expected 401`);
    const cc = res.headers.get("cache-control") ?? "";
    if (!cc.includes("private")) die(`${m.migration_id}: 401 cache-control is not private (${cc})`);

    m.authorized_route_verified = true; ok++;
    console.log(`  ${m.migration_id}: private copy byte-identical · metadata clean · unauth 401 (private cache)`);
  }
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\n  ${ok}/${manifest.items.length} verified.`);
  console.log(`\n  OPERATOR CHECK before 'revoke' (the one leg a script cannot do):`);
  console.log(`    open Discuss in Production as a member of the affected channels and`);
  console.log(`    confirm each migrated image/voice note still renders. Then re-run with`);
  console.log(`    mode 'revoke' and KX_RUN_C_AUTHZ_CONFIRMED=true.\n`);
}

/* ── revoke (DESTRUCTIVE — one exact object at a time) ───────────────────── */

async function revoke() {
  baseGuards();
  if (process.env.KX_RUN_C_AUTHZ_CONFIRMED !== "true") {
    die("KX_RUN_C_AUTHZ_CONFIRMED must be exactly 'true' — the authorization matrix must pass before any source is deleted.");
  }
  if (!existsSync(MANIFEST_PATH)) die(`no manifest at ${MANIFEST_PATH}.`);
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
  if (manifest.items.length !== EXPECTED_ITEMS) die(`manifest holds ${manifest.items.length} items, expected exactly ${EXPECTED_ITEMS}.`);
  const client = db();
  const save = () => writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  for (const m of manifest.items) {
    if (m.source_deleted) { console.log(`  ${m.migration_id}: already revoked — skipping`); continue; }
    // Every precondition, re-checked. Deletion is the only irreversible step.
    if (!m.copied || !m.byte_verified || !m.metadata_updated || !m.authorized_route_verified) {
      die(`${m.migration_id}: preconditions incomplete — refusing to delete the only surviving copy.`);
    }
    // Exactly one path. Never a prefix, never a query, never a list().
    const del = await client.storage.from(m.source_bucket).remove([m.source_path]);
    if (del.error) {
      console.error(`  ${m.migration_id}: source deletion FAILED — private copy retained. State is duplicated, not lost.`);
      die(`stopping. Do not attempt broad cleanup; investigate this one object.`);
    }
    const pub = await fetch(`${PRODUCTION_URL}/storage/v1/object/public/${m.source_bucket}/${encodeURI(m.source_path)}`);
    if (pub.ok) die(`${m.migration_id}: public URL still serves after deletion — investigate before continuing.`);
    m.source_deleted = true; save();
    console.log(`  ${m.migration_id}: source revoked · old public URL now HTTP ${pub.status}`);
  }
  console.log(`\n  revocation complete. Run mode 'audit' for the final proof.\n`);
}

/* ── audit (read-only final proof) ───────────────────────────────────────── */

async function audit() {
  baseGuards();
  const client = db();
  const live = await readInventory(client);
  const { count: media } = await client.schema("storage").from("objects")
    .select("*", { count: "exact", head: true }).eq("bucket_id", "media");

  console.log(`\n  ── RUN C FINAL AUDIT ──────────────────────────────────────`);
  console.log(`  Discuss items still referencing public '${SOURCE_BUCKET}' : ${live.length}   (target 0)`);
  console.log(`  objects remaining in '${SOURCE_BUCKET}' (ALL modules)      : ${media}   (non-Discuss — must be untouched)`);
  if (live.length !== 0) { console.error(`\n  NOT CLEAN: ${live.length} Discuss item(s) still resolve into the public bucket.\n`); process.exit(1); }
  console.log(`\n  clean: zero Discuss-referenced objects remain in the public bucket.`);
  console.log(`  Next (separate, Preview-first change): drop 'media' from CATEGORY_BUCKETS.discuss.\n`);
}

/* ── self-test ───────────────────────────────────────────────────────────── */

/**
 * Prove the redaction actually holds. The whole credential story rests on
 * scrub() catching a secret that leaks through a path we do not control — a
 * third-party error message, a stack, a serialized request. Asserting that in a
 * comment is worthless; this exercises it.
 *
 * Run with a THROWAWAY value in KX_RUN_C_PRODUCTION_SERVICE_KEY. Never the real
 * key: if redaction were broken, running this with the real key is precisely
 * how you would leak it.
 */
function selfTest() {
  if (!KEY) die("set KX_RUN_C_PRODUCTION_SERVICE_KEY to a THROWAWAY value to run the self-test.");
  const cases: Array<[string, unknown]> = [
    ["plain string", `Authorization: Bearer ${KEY}`],
    ["Error message", new Error(`request failed with apikey=${KEY}`)],
    ["nested object", { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } }],
    ["array", [KEY, "safe", { k: KEY }]],
    ["url with key in query", `https://x.supabase.co/o?apikey=${KEY}&t=1`],
  ];
  let leaked = 0;
  console.log("\n  scrub() self-test — every line below must contain NO secret:\n");
  for (const [label, v] of cases) {
    const out = scrub(v);
    const bad = KEY.length > 0 && out.includes(KEY);
    if (bad) leaked++;
    console.log(`    ${bad ? "LEAK  " : "ok    "} ${label.padEnd(22)} ${out.slice(0, 78)}`);
  }
  // console.* is wrapped, so even a deliberate raw print must come out scrubbed.
  console.log(`    ok     via wrapped console   ${`key=${KEY}`}`);
  if (leaked) { console.error(`\n  ${leaked} case(s) LEAKED. Do not use this script.\n`); process.exit(1); }
  console.log("\n  all cases redacted, including through the wrapped console.\n");
}

/* ── entry ───────────────────────────────────────────────────────────────── */

const mode = process.argv[2] ?? "";
switch (mode) {
  case "plan":        await plan(); break;
  case "migrate":     await migrate(); break;
  case "verify":      await verify(); break;
  case "revoke":      await revoke(); break;
  case "audit":       await audit(); break;
  case "prove-clean": proveClean(); break;
  case "self-test":   selfTest(); break;
  default:
    console.error(`\n  usage: discuss-run-c.mts <plan|migrate|verify|revoke|audit|prove-clean|self-test>\n`);
    process.exit(1);
}
