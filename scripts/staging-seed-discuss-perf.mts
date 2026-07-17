/* ---------------------------------------------------------------------------
   staging-seed-discuss-perf — synthetic large-thread fixture for the Discuss
   redesign baseline. STAGING ONLY.

   WHY THIS EXISTS
   The redesign's acceptance criterion is measured improvement, and you cannot
   measure a virtualized message list against 13 messages per channel — which is
   all Production has. This builds the thread the measurement needs.

   WHY IT CANNOT TOUCH PRODUCTION
   The production ref is a DENYLIST and the staging ref is an ALLOWLIST, checked
   before any client is constructed. Note the inversion versus discuss-run-c.mts,
   which is the opposite (production allowlisted) — the two scripts have opposite
   safety postures and must never share a code path. Seeding 5,000 rows into
   Production would be unrecoverable-by-inspection: synthetic rows would be
   indistinguishable from the 91 real test messages the operator explicitly chose
   to keep.

   EVERY row it writes is tagged `metadata.__kxperf = FIXTURE_TAG`, and the
   cleanup manifest is written locally. Removal is therefore exact, not a guess.
   --------------------------------------------------------------------------- */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
/* The APP's own hasher — never a reimplementation. If Koleex changes its argon2
   parameters, the fixture follows automatically instead of silently drifting
   into a password the real signin route cannot verify. */
import { hashPassword } from "../src/lib/server/password";

/* ── guards ──────────────────────────────────────────────────────────────── */

const STAGING_REF = "gmtjbshjsuexqayqumix";        // ALLOWLIST — the only target
const PRODUCTION_REF = "yxyizbnfjrwrnmwhkvme";     // DENYLIST — never, under any flag

const FIXTURE_TAG = "kxperf-discuss-baseline";
const CHANNEL_NAME = "zz-kxperf-synthetic-5k (DELETE ME)";
const MANIFEST = ".local/kxperf-seed-manifest.json";
const TARGET_MESSAGES = 5000;

function die(m: string): never {
  console.error(`\n  ABORT: ${m}\n  Nothing was written.\n`);
  process.exit(1);
}

const url = process.env.SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url || !key) die("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co$/.exec(url)?.[1] ?? "";
if (ref === PRODUCTION_REF) die("target is PRODUCTION. This script may never seed production.");
if (ref !== STAGING_REF) die(`target ref '${ref}' is not the staging ref. Refusing.`);
if (process.env.KXPERF_SEED_APPROVED !== "true") die('KXPERF_SEED_APPROVED must be exactly "true".');
console.log(`  guard: OK — target ${ref} (staging), production denylisted`);

const db: SupabaseClient = createClient(url, key, { auth: { persistSession: false } });

/* ── message corpus ──────────────────────────────────────────────────────── */

/* Realistic length variation: real threads are mostly short with a long tail.
   A uniform corpus would make virtualization look better than it is, because
   equal-height rows are the easy case. Variable heights are the honest test. */
const SHORT = ["ok", "got it", "thanks", "yes", "no", "on it", "done", "👍", "sure", "one sec"];
const MEDIUM = [
  "Can you check the lockstitch spec before we send the quote?",
  "Supplier confirmed the lead time is 6 weeks from deposit.",
  "Updated the price list — margins look tight on the XSL line.",
  "Customer asked about spare parts availability for the overlock units.",
  "Shipment cleared customs this morning, docs are in the folder.",
];
const LONG = [
  "Following up on the factory visit: the spreading machine line was running at about 70% capacity when we were there. They said the bottleneck is the cutting table changeover, which takes roughly 40 minutes between runs. If we push for the automated changeover option it adds cost but should recover most of that time. Worth modelling before we commit to the volume tier.",
  "Summary of the pricing discussion — we agreed to hold the current tier for Q3, revisit in Q4 once the FX position settles. The customer wants a written commitment on lead times which I'd rather not give until the supplier confirms their own capacity plan. I'll draft something conservative and circulate for review before it goes out.",
];

function bodyFor(i: number): string {
  const r = i % 20;
  if (r < 12) return SHORT[i % SHORT.length];
  if (r < 18) return MEDIUM[i % MEDIUM.length];
  return LONG[i % LONG.length];
}

/* Fixture secrets live here for the lifetime of the process ONLY. Never
   written to the manifest, a log, or stdout. */
let seededSecrets: Array<{ username: string; secret: string }> = [];
void seededSecrets;

/* ── seed ────────────────────────────────────────────────────────────────── */

async function main() {
  if (existsSync(MANIFEST)) {
    die(`${MANIFEST} already exists — a fixture set may already be seeded. ` +
        `Run the cleanup first rather than stacking two synthetic threads.`);
  }

  /* Tenant: reuse an existing one if staging ever gains real data, so the
     fixture never competes with it. Staging is currently a clean room (0
     tenants), so one synthetic tenant is created and recorded for cleanup. */
  const { data: tExisting } = await db.from("tenants").select("id").limit(1);
  let tenantId = tExisting?.[0]?.id as string | undefined;
  let tenantCreated = false;
  if (!tenantId) {
    tenantId = randomUUID();
    const { error } = await db.from("tenants").insert({
      id: tenantId, name: "KXPERF Fixture Tenant (DELETE ME)", slug: "kxperf-fixture",
    });
    if (error) die(`tenant insert failed: ${error.message}`);
    tenantCreated = true;
  }
  console.log(`  tenant: ${tenantCreated ? "created (synthetic)" : "reused existing"}`);

  /* Two fixture accounts: sender + receiver, for the two-session measurement.
     `accounts_identity_per_type` requires an internal account to carry a
     person_id — identity lives in `people`, and the account references it. So a
     person row comes first; inventing an account without one is rejected by the
     database, correctly. */
  const people = [
    { id: randomUUID(), full_name: "KXPERF Sender (fixture)" },
    { id: randomUUID(), full_name: "KXPERF Receiver (fixture)" },
  ];
  const { error: pErr } = await db.from("people").insert(
    people.map((p) => ({ id: p.id, full_name: p.full_name, tenant_id: tenantId })),
  );
  if (pErr) die(`person insert failed: ${pErr.message}`);

  const accounts = [
    { id: randomUUID(), username: "kxperf_sender", login_email: "kxperf_sender@fixture.invalid", person_id: people[0].id },
    { id: randomUUID(), username: "kxperf_receiver", login_email: "kxperf_receiver@fixture.invalid", person_id: people[1].id },
  ];
  /* Fixture passwords: random per account, hashed with the APP's argon2 so the
     real signin route verifies them — authentication is exercised, never
     bypassed or weakened. The plaintext lives in this process only: it is
     returned to the caller in memory, never written to the manifest, a log, a
     file, Git, or stdout. A password printed "just for convenience" is a
     password that outlives the test. */
  const secrets = accounts.map(() => randomBytes(24).toString("base64url"));
  const hashes = await Promise.all(secrets.map((s) => hashPassword(s)));

  const { error: aErr } = await db.from("accounts").insert(
    accounts.map((a, i) => ({
      id: a.id, username: a.username, login_email: a.login_email,
      person_id: a.person_id,
      tenant_id: tenantId, user_type: "internal", status: "active",
      is_super_admin: false, force_password_change: false,
      password_hash: typeof hashes[i] === "string" ? hashes[i] : (hashes[i] as { hash: string }).hash,
      password_algo: "argon2id",
      internal_notes: FIXTURE_TAG,
    })),
  );
  if (aErr) die(`account insert failed: ${aErr.message}`);
  console.log(`  accounts: 2 fixture accounts + 2 people created (passwords set, never printed)`);
  // Handed to the login step in-process; never persisted anywhere.
  seededSecrets = accounts.map((a, i) => ({ username: a.username, secret: secrets[i] }));

  const channelId = randomUUID();
  const { error: cErr } = await db.from("discuss_channels").insert({
    id: channelId, kind: "group", name: CHANNEL_NAME,
    description: `Synthetic performance fixture (${FIXTURE_TAG}). Safe to delete.`,
    tenant_id: tenantId,
  });
  if (cErr) die(`channel insert failed: ${cErr.message}`);

  const { error: mErr } = await db.from("discuss_members").insert(
    accounts.map((a) => ({
      id: randomUUID(), channel_id: channelId, account_id: a.id,
      role: "member", muted: false, notification_pref: "all",
      joined_at: new Date(Date.now() - 90 * 864e5).toISOString(),
      last_read_at: new Date(Date.now() - 90 * 864e5).toISOString(),
    })),
  );
  if (mErr) die(`membership insert failed: ${mErr.message}`);
  console.log(`  channel + 2 memberships created`);

  /* Timestamps span 90 days, denser toward the present — a flat distribution
     would not exercise date separators or the unread divider realistically. */
  const now = Date.now();
  const span = 90 * 864e5;
  const ids: string[] = [];
  const rows = Array.from({ length: TARGET_MESSAGES }, (_, i) => {
    const id = randomUUID();
    ids.push(id);
    const frac = (i / TARGET_MESSAGES) ** 1.6; // skew recent
    const created = new Date(now - span + frac * span).toISOString();
    const author = accounts[i % 2];
    const edited = i % 97 === 0;
    const deleted = i % 163 === 0;
    return {
      id, channel_id: channelId, author_account_id: author.id,
      kind: "text", body: bodyFor(i), body_html: null,
      metadata: { __kxperf: FIXTURE_TAG },
      created_at: created,
      edited_at: edited ? new Date(now - span + frac * span + 60_000).toISOString() : null,
      deleted_at: deleted ? new Date(now - span + frac * span + 120_000).toISOString() : null,
      reply_to_message_id: null as string | null,
    };
  });

  // Replies: point at an EARLIER seeded message so the parent always exists.
  for (let i = 50; i < rows.length; i += 37) rows[i].reply_to_message_id = ids[i - 40];

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await db.from("discuss_messages").insert(slice);
    if (error) die(`message insert failed at offset ${i}: ${error.message}`);
    process.stdout.write(`\r  messages: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  console.log();

  const reactions = ids.filter((_, i) => i % 53 === 0).flatMap((mid, n) => [{
    id: randomUUID(), message_id: mid, account_id: accounts[n % 2].id,
    emoji: ["👍", "🎉", "❤️", "😄"][n % 4], created_at: new Date().toISOString(),
  }]);
  const { error: rErr } = await db.from("discuss_reactions").insert(reactions);
  if (rErr) die(`reaction insert failed: ${rErr.message}`);

  mkdirSync(".local", { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify({
    created_at: new Date().toISOString(),
    project_ref: ref, fixture_tag: FIXTURE_TAG,
    channel_id: channelId, channel_name: CHANNEL_NAME,
    tenant_id: tenantId, tenant_created_by_fixture: tenantCreated,
    account_ids: accounts.map((a) => a.id),
    person_ids: people.map((p) => p.id),
    message_ids: ids, reaction_ids: reactions.map((r) => r.id),
    counts: { messages: rows.length, reactions: reactions.length, accounts: 2, people: 2, channels: 1 },
  }, null, 2));

  console.log(`\n  ── SEED COMPLETE (staging ${ref}) ──`);
  console.log(`  messages : ${rows.length}   (edited ${rows.filter((r) => r.edited_at).length}, deleted ${rows.filter((r) => r.deleted_at).length}, replies ${rows.filter((r) => r.reply_to_message_id).length})`);
  console.log(`  reactions: ${reactions.length}`);
  console.log(`  manifest : ${MANIFEST} (exact ids — cleanup is precise, never a prefix)\n`);
}

/* ── cleanup ─────────────────────────────────────────────────────────────── */

async function cleanup() {
  if (!existsSync(MANIFEST)) die(`no manifest at ${MANIFEST}.`);
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  if (m.project_ref !== STAGING_REF) die("manifest is not for staging.");

  await db.from("discuss_reactions").delete().in("id", m.reaction_ids);
  for (let i = 0; i < m.message_ids.length; i += 500) {
    await db.from("discuss_messages").delete().in("id", m.message_ids.slice(i, i + 500));
  }
  await db.from("discuss_members").delete().eq("channel_id", m.channel_id);
  await db.from("discuss_channels").delete().eq("id", m.channel_id);
  await db.from("accounts").delete().in("id", m.account_ids);
  if (m.person_ids) await db.from("people").delete().in("id", m.person_ids);
  /* Only remove the tenant if THIS fixture created it — never a tenant that
     already existed, which would take real staging data down with it. */
  if (m.tenant_created_by_fixture && m.tenant_id) await db.from("tenants").delete().eq("id", m.tenant_id);

  const { count } = await db.from("discuss_messages").select("*", { count: "exact", head: true })
    .eq("channel_id", m.channel_id);
  console.log(`\n  cleanup done — messages remaining in fixture channel: ${count ?? 0} (expect 0)\n`);
}


/* ── session ─────────────────────────────────────────────────────────────────
   Mint a real session for a fixture account through the REAL signin route.

   The seeder deliberately kept fixture passwords in-process, which means they
   are gone once it exits — correct for secrecy, useless for logging in later.
   Rather than persist a password (which would outlive the test and defeat the
   point), this ROTATES it: generate a new random secret, store its argon2 hash,
   immediately exchange it at /api/auth/signin, and emit ONLY the session cookie.
   The plaintext never leaves this process, and the cookie is a scoped, revocable
   session — not a credential.

   Auth is exercised, never bypassed: the same route, the same argon2 verify, the
   same membership and permission checks a real user hits. */
async function session() {
  if (!existsSync(MANIFEST)) die(`no manifest at ${MANIFEST} — seed first.`);
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  if (m.project_ref !== STAGING_REF) die("manifest is not for staging.");

  const which = process.argv[3] ?? "";
  const username = which === "receiver" ? "kxperf_receiver" : "kxperf_sender";
  const origin = process.env.KXPERF_ORIGIN ?? "http://localhost:3000";

  const secret = randomBytes(24).toString("base64url");
  const h = await hashPassword(secret);
  const hash = typeof h === "string" ? h : (h as { hash: string }).hash;

  const { error } = await db.from("accounts")
    .update({ password_hash: hash, password_algo: "argon2id", force_password_change: false })
    .eq("username", username).eq("internal_notes", FIXTURE_TAG);   // fixture rows only
  if (error) die(`password rotate failed: ${error.message}`);

  /* A Preview deployment sits behind Vercel Deployment Protection, which answers
     401 BEFORE the app is reached — indistinguishable from a real auth failure
     unless you look. KXPERF_BYPASS carries a deployment-scoped automation bypass
     so the request reaches the REAL signin route; auth itself is never bypassed
     (the same argon2 verify and the same checks still run, and bad credentials
     still 401). Read from env only — never committed, never printed. */
  const bypass = process.env.KXPERF_BYPASS;
  const res = await fetch(`${origin}/api/auth/signin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(bypass ? { "x-vercel-protection-bypass": bypass } : {}),
    },
    body: JSON.stringify({ username, password: secret }),
  });
  const setCookie = res.headers.get("set-cookie") ?? "";
  const cookie = /koleex_session=([^;]+)/.exec(setCookie)?.[1] ?? "";
  if (!res.ok || !cookie) {
    die(`signin failed (http ${res.status}) — auth was NOT bypassed; the fixture simply did not authenticate.`);
  }
  // ONLY the session cookie. Never the password.
  console.log(`KOLEEX_SESSION=${cookie}`);
}

const mode = process.argv[2] ?? "";
if (mode === "seed") await main();
else if (mode === "cleanup") await cleanup();
else if (mode === "session") await session();
else { console.error("\n  usage: staging-seed-discuss-perf.mts <seed|cleanup|session [sender|receiver]>\n"); process.exit(1); }
