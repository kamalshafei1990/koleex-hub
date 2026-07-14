/* ==========================================================================
   validate:realtime — automated two-client proof for the Discuss realtime
   lockdown (RLS realtime-lockdown P3).

   The Discuss tables are locked to service_role; realtime is delivered by
   server Broadcast pings + gated reads. This script proves that end-to-end
   WITHOUT a human second browser:

     · A real 2nd client (anon Supabase realtime socket) subscribes to a
       channel topic + an account topic.
     · Persona A (admin) sends a message via the gated mutate route.
     · We assert the server Broadcast ping reaches the subscriber (i.e. the
       other "person" gets realtime), that a channel MEMBER can read the
       message through the gated endpoint, that a NON-member gets nothing,
       and that the anon key can no longer read the messages table at all.

   Requirements: dev server running; SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
   + NEXT_PUBLIC_SUPABASE_ANON_KEY (or .env.local). Probe accounts p0b_admin
   (SA) + p0b_customer. Missing prerequisites skip, never silently pass.
   ========================================================================== */

import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { hash as argon2Hash } from "@node-rs/argon2";

function loadEnvLocal() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch { /* rely on process.env */ }
}
loadEnvLocal();

const SUPA_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE_URL = process.env.KX_BASE_URL ?? "http://localhost:3001";
if (!SUPA_URL || !SERVICE_KEY || !ANON_KEY) {
  console.warn("[realtime] SUPABASE_URL + SERVICE_ROLE + ANON_KEY required; skipping.");
  process.exit(0);
}
const db = createClient(SUPA_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0, fail = 0, skip = 0;
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); }
}
function skipped(name: string, why: string) { skip++; console.log(`  ⏭️  ${name} — ${why}`); }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function signIn(username: string, password: string): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/api/auth/signin`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) return null;
  const cookies =
    typeof (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (res.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : [res.headers.get("set-cookie") ?? ""];
  const jar = cookies.filter(Boolean).map((c) => c.split(";")[0]).join("; ");
  return jar || null;
}
async function api(cookie: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init, headers: { Cookie: cookie, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let json: unknown = null; try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, json: json as { ok?: boolean; data?: unknown } | null };
}
async function prepProbe(username: string) {
  const { data: rows, error: selErr } = await db.from("accounts").select("id, username").ilike("username", username).limit(2);
  if (selErr) { console.warn(`[realtime] lookup ${username}: ${selErr.message}`); return null; }
  const acc = (rows ?? [])[0] as { id: string; username: string } | undefined;
  if (!acc) { console.warn(`[realtime] probe account ${username} not found`); return null; }
  const password = `Probe-${randomBytes(9).toString("base64url")}`;
  const password_hash = await argon2Hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const { error } = await db.from("accounts").update({
    password_hash, password_algo: "argon2id", password_rehash_required: false,
    force_password_change: false, status: "active",
  }).eq("id", acc.id);
  if (error) { console.warn(`[realtime] rotate ${username}: ${error.message}`); return null; }
  return { id: acc.id, username: acc.username, password };
}

/** Subscribe an anon realtime client to a broadcast topic; resolve a getter
 *  that reports whether a "changed" ping has arrived. */
async function listen(rt: { channel: (t: string) => RealtimeChannel }, topic: string): Promise<{ got: () => boolean; channel: RealtimeChannel }> {
  let received = false;
  const channel = rt.channel(topic);
  await new Promise<void>((resolve) => {
    channel.on("broadcast", { event: "changed" }, () => { received = true; })
      .subscribe((status) => { if (status === "SUBSCRIBED") resolve(); });
    setTimeout(resolve, 5000); // don't hang if the socket never subscribes
  });
  return { got: () => received, channel };
}

async function main() {
  console.log(`\n=== validate:realtime — probing ${BASE_URL} ===\n`);

  const admin = await prepProbe("p0b_admin");
  const customer = await prepProbe("p0b_customer");
  if (!admin || !customer) { skipped("realtime two-client", "probe accounts p0b_admin/p0b_customer not found"); finish(); return; }

  const adminJar = await signIn(admin.username, admin.password);
  const custJar = await signIn(customer.username, customer.password);
  ok("admin + customer sign in", !!adminJar && !!custJar);
  if (!adminJar || !custJar) { finish(); return; }

  const createdChannelIds: string[] = [];
  const rt = createClient(SUPA_URL!, ANON_KEY!, { auth: { persistSession: false } });

  try {
    /* Channel A: admin + customer are both members. */
    const mk = await api(adminJar, "/api/discuss/mutate", {
      method: "POST",
      body: JSON.stringify({ action: "createChannel", payload: { kind: "group", name: `rt-probe-${Date.now()}`, memberIds: [customer.id] } }),
    });
    const channelId = (mk.json?.data as { id?: string } | undefined)?.id;
    ok("admin creates a shared probe channel", !!channelId, `status ${mk.status}`);
    if (!channelId) { finish(); return; }
    createdChannelIds.push(channelId);

    /* The 2nd "client": anon realtime sockets on the channel + account topics. */
    const chanSub = await listen(rt, `discuss:channel:${channelId}`);
    const acctSub = await listen(rt, `discuss:account:${customer.id}`);

    /* Persona A sends a message -> server emits Broadcast pings. */
    const marker = `rt-verify-${randomBytes(4).toString("hex")}`;
    const send = await api(adminJar, "/api/discuss/mutate", {
      method: "POST",
      body: JSON.stringify({ action: "sendMessage", payload: { channelId, body: marker, metadata: {} } }),
    });
    ok("admin sends a message via the gated route", send.json?.ok === true, `status ${send.status}`);

    await sleep(2500); // allow the broadcast to round-trip

    ok("2nd client receives the channel-topic ping (realtime delivery)", chanSub.got());
    ok("2nd client receives the account-topic ping (sidebar/bell)", acctSub.got());

    /* A channel MEMBER reads the new message through the gated endpoint. */
    const custRead = await api(custJar, `/api/discuss/read?resource=channelMessages&channelId=${channelId}`);
    const custMsgs = (custRead.json?.data as Array<{ body?: string }> | undefined) ?? [];
    ok("member reads the message via the gated endpoint", custRead.status === 200 && custMsgs.some((m) => m.body === marker));

    /* Channel B: admin only — customer must NOT be able to read it. */
    const mk2 = await api(adminJar, "/api/discuss/mutate", {
      method: "POST",
      body: JSON.stringify({ action: "createChannel", payload: { kind: "group", name: `rt-private-${Date.now()}`, memberIds: [] } }),
    });
    const privateId = (mk2.json?.data as { id?: string } | undefined)?.id;
    if (privateId) {
      createdChannelIds.push(privateId);
      await api(adminJar, "/api/discuss/mutate", { method: "POST", body: JSON.stringify({ action: "sendMessage", payload: { channelId: privateId, body: "secret", metadata: {} } }) });
      const leak = await api(custJar, `/api/discuss/read?resource=channelMessages&channelId=${privateId}`);
      const leakMsgs = (leak.json?.data as unknown[] | undefined) ?? [];
      ok("non-member gated read returns empty (membership gate)", leakMsgs.length === 0, `got ${leakMsgs.length} rows`);
    } else skipped("membership gate", "couldn't create private channel");

    /* The table itself is locked to the anon key. */
    const anonRead = await fetch(`${SUPA_URL}/rest/v1/discuss_messages?select=id&limit=1`, {
      headers: { apikey: ANON_KEY!, Authorization: `Bearer ${ANON_KEY}` },
    });
    const anonRows = (await anonRead.json().catch(() => [])) as unknown[];
    ok("anon key cannot read discuss_messages (locked)", Array.isArray(anonRows) && anonRows.length === 0);

    chanSub.channel.unsubscribe();
    acctSub.channel.unsubscribe();
  } finally {
    /* Clean up probe channels + their rows. */
    for (const id of createdChannelIds) {
      await db.from("discuss_reactions").delete().in("message_id", (await db.from("discuss_messages").select("id").eq("channel_id", id)).data?.map((r) => (r as { id: string }).id) ?? []);
      await db.from("discuss_messages").delete().eq("channel_id", id);
      await db.from("discuss_members").delete().eq("channel_id", id);
      await db.from("discuss_channels").delete().eq("id", id);
    }
    await rt.removeAllChannels();
  }
  finish();
}

function finish() {
  console.log(`\n=== validate:realtime — ${pass} passed, ${fail} failed, ${skip} skipped ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
