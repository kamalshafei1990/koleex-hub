import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/discuss/stream — first-party SSE message delivery.

   WHY THIS EXISTS (production evidence, 2026-07): kx-metric telemetry showed
   ZERO successful Supabase Realtime joins across every production session —
   333 CHANNEL_ERROR + 331 CLOSED and not one SUBSCRIBED in 6h. The team works
   from mainland China where wss://*.supabase.co is blocked/unreliable (the
   same reachability problem that forced first-party image delivery, China
   remediation R3). With the websocket dead, every message was delivered by
   the 5–10s fallback poll — the "not received immediately" lag.

   This endpoint streams new messages over Server-Sent Events on OUR origin
   (hub.koleexgroup.com → Vercel edge → hnd1), which is proven ~99% reachable
   from mainland China. Because the stream is authenticated per-user (session
   cookie) and scoped to the caller's channel memberships, it can safely carry
   FULL message content — unlike the world-subscribable Supabase broadcast
   topics, which by design carry no row data. The receiver renders the message
   straight from the stream frame: no follow-up fetch, no extra China RTT.

   Mechanics:
     · auth via session cookie (requireAuth) — identity is never client-supplied
     · resolve the caller's active channel ids (same gate as /api/discuss/read)
     · every ~900ms: one indexed query for rows newer than the cursor across
       those channels → emit each as an SSE `msg` event (incremental-fetch
       serialization: reactions/reply enrichment reconciles via the existing
       30s dirty pass)
     · membership set refreshes every ~30s; heartbeat comment keeps proxies open
     · the stream self-terminates before maxDuration; EventSource reconnects
       with ?since=<newest seen> so the gap is replayed (bounded, deduped)
     · every ~3s an `chg` event names channels touched by an edit / delete /
       reaction / pin, so those reach open clients without a broadcast ping;
       `meta: true` on it marks a sidebar-level change (rename, archive, the
       caller joining or being removed) so the client refetches its list;
       `members: true` marks a membership change (someone added / removed /
       left, a role change) so the client reloads the member list only then —
       never after a plain reaction or edit

   Delivery latency: poll cadence /2 (~0.5s median) + SSE push ≈ WeChat-feel,
   independent of Supabase websocket reachability. The Supabase broadcast path
   stays as a supplement where it works; the client dedupes by message id.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import {
  serializeDiscussMessageForClient,
  flattenDiscussAuthor as flattenAuthor,
  DISCUSS_AUTHOR_SELECT as AUTHOR_SELECT,
  type DiscussAuthorJoin as AuthorJoin,
} from "@/lib/server/discuss-serialize";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MEMBERS = "discuss_members";
const MESSAGES = "discuss_messages";
const CHANNELS = "discuss_channels";

/** Sidebar-level identity of a channel: a change here is a rename,
 *  re-description or archive (reported to the client as `meta`). */
function sigOf(ch: { name: string | null; description: string | null; archived_at: string | null }): string {
  return `${ch.name ?? ""}\u0000${ch.description ?? ""}\u0000${ch.archived_at ?? ""}`;
}

/** Active membership of each channel (account + role), keyed by channel id —
 *  compared between change passes to flag `members` changes. */
async function memberSigs(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data } = await supabaseServer
    .from(MEMBERS)
    .select("channel_id, account_id, role")
    .in("channel_id", ids)
    .is("left_at", null)
    .limit(10_000);
  const by = new Map<string, string[]>();
  for (const r of (data ?? []) as Array<{ channel_id: string; account_id: string; role: string | null }>) {
    const list = by.get(r.channel_id) ?? [];
    list.push(`${r.account_id}:${r.role ?? ""}`);
    by.set(r.channel_id, list);
  }
  for (const id of ids) out.set(id, (by.get(id) ?? []).sort().join(","));
  return out;
}

async function myChannelIds(me: string): Promise<string[]> {
  const { data } = await supabaseServer
    .from(MEMBERS)
    .select("channel_id")
    .eq("account_id", me)
    .is("left_at", null);
  return ((data ?? []) as Array<{ channel_id: string }>).map((r) => r.channel_id);
}

const POLL_MS = 900;          // hot cursor-poll cadence (median delivery ≈ 450ms)
const IDLE_POLL_MS = 2500;    // relaxed cadence after 60s without a delivered row
const HEARTBEAT_EVERY = 22;   // ≈20s — keep proxies/CDN from timing the stream out
const MEMBERSHIP_EVERY = 33;  // ≈30s — pick up newly joined/left channels
const CHANGE_EVERY = 3;       // ≈3s  — edits / deletes / reactions / pins
const LIFETIME_MS = 280_000;  // self-terminate under maxDuration; client reconnects
/* Rows commit with created_at = the INSERT's now(), but become visible only
   at COMMIT — a slow transaction can surface a row older than the cursor we
   already advanced past, and it was silently skipped forever. Re-read a small
   window behind the cursor on every tick and drop what was already sent. */
const OVERLAP_MS = 2_000;
/* How far back a reconnecting client may ask us to replay (?since=). Bounded
   so a stale tab cannot turn one reconnect into a history dump. */
const MAX_REPLAY_MS = 5 * 60_000;
/* An update counts as an edit-type change (not the insert trigger's own
   touch) when updated_at is this far past last_message_at. */
const CHANGE_SLACK_MS = 1_000;

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const denied = await requireModuleAccess(auth, "Discuss");
  if (denied) return denied;
  const me = auth.account_id;

  /* Reconnect catch-up: the client sends the newest created_at it has seen;
     start there (bounded) instead of "now", so a network gap on the China
     link does not lose the messages sent while it was down. */
  const sinceRaw = new URL(req.url).searchParams.get("since");
  const sinceMs = sinceRaw ? Date.parse(sinceRaw) : NaN;
  const nowMs = Date.now();
  const startMs = Number.isFinite(sinceMs) ? Math.max(sinceMs, nowMs - MAX_REPLAY_MS) : nowMs;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(chunk)); } catch { closed = true; }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      };
      req.signal.addEventListener("abort", close);

      /* Reconnect hint + hello so the client can mark the stream healthy. */
      send("retry: 2000\n\n");
      send(`event: hello\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);

      let channelIds = await myChannelIds(me);
      let cursor = new Date(Math.min(startMs, nowMs)).toISOString();
      /* Ids already delivered on this connection (overlap dedupe). Bounded:
         only ids inside the overlap window can ever be re-read. */
      const sent = new Map<string, number>();
      let changeCursor = new Date(nowMs - 5_000).toISOString();
      /* name / description / archived_at per channel, to tell a rename or an
         archive (sidebar-level, `meta`) from an edit / reaction / pin. */
      const metaSig = new Map<string, string>();
      /* Active member set per channel, to tell a membership change from an
         edit / reaction (both only touch updated_at). */
      const memberSig = new Map<string, string>();
      const seedSigs = async (ids: string[]) => {
        if (ids.length === 0) return;
        try {
          for (const [id, sig] of await memberSigs(ids)) if (!memberSig.has(id)) memberSig.set(id, sig);
        } catch { /* unseeded channels report their first membership change as a plain chg */ }
        try {
          const { data: rows } = await supabaseServer
            .from(CHANNELS)
            .select("id, name, description, archived_at")
            .in("id", ids);
          for (const r of (rows ?? []) as Array<{ id: string; name: string | null; description: string | null; archived_at: string | null }>) {
            if (!metaSig.has(r.id)) metaSig.set(r.id, sigOf(r));
          }
        } catch { /* unseeded channels just report their first change as a plain chg */ }
      };
      await seedSigs(channelIds);
      const started = Date.now();
      let iter = 0;

      /* Adaptive cadence: poll fast while the conversation is live, back
         off when quiet. Cuts steady-state DB polling ~65% per connected
         user. */
      let lastActivity = Date.now();
      while (!closed && Date.now() - started < LIFETIME_MS) {
        const quiet = Date.now() - lastActivity > 60_000;
        await new Promise((r) => setTimeout(r, quiet ? IDLE_POLL_MS : POLL_MS));
        if (closed) break;
        iter += 1;

        if (iter % MEMBERSHIP_EVERY === 0) {
          try {
            const next = await myChannelIds(me);
            /* Joined / removed / left elsewhere: tell the client its channel
               LIST changed (meta) so the sidebar refetches — the Supabase
               account ping that normally carries this never reaches the
               mainland. */
            const before = new Set(channelIds);
            const after = new Set(next);
            for (const id of next) if (!before.has(id)) send(`event: chg\ndata: ${JSON.stringify({ channelId: id, at: new Date().toISOString(), meta: true, members: true })}\n\n`);
            for (const id of channelIds) if (!after.has(id)) send(`event: chg\ndata: ${JSON.stringify({ channelId: id, at: new Date().toISOString(), meta: true, members: true })}\n\n`);
            const added = next.filter((id) => !before.has(id));
            channelIds = next;
            await seedSigs(added);
          } catch { /* keep old set */ }
        }
        if (iter % HEARTBEAT_EVERY === 0) send(`: hb ${Date.now()}\n\n`);
        if (channelIds.length === 0) continue;

        try {
          const from = new Date(Date.parse(cursor) - OVERLAP_MS).toISOString();
          const { data } = await supabaseServer
            .from(MESSAGES)
            .select(AUTHOR_SELECT)
            .in("channel_id", channelIds)
            .gt("created_at", from)
            .order("created_at", { ascending: true })
            .limit(100);
          const rows = (data ?? []) as Array<
            Record<string, unknown> & { id: string; created_at: string; author: AuthorJoin }
          >;
          let delivered = 0;
          for (const row of rows) {
            if (row.created_at > cursor) cursor = row.created_at;
            if (sent.has(row.id)) continue;
            sent.set(row.id, Date.parse(row.created_at));
            const serialized = serializeDiscussMessageForClient({
              ...row,
              author: flattenAuthor(row.author),
              reactions: [],
              reply_preview: null,
              thread: null,
            });
            send(`event: msg\ndata: ${JSON.stringify(serialized)}\n\n`);
            delivered += 1;
          }
          if (delivered > 0) lastActivity = Date.now();
          /* Forget ids that fell out of the overlap window. */
          const floor = Date.parse(cursor) - OVERLAP_MS * 2;
          for (const [id, at] of sent) if (at < floor) sent.delete(id);
        } catch { /* transient query failure — next tick retries */ }

        /* Edits, deletions, reactions and pins do not create rows, so the
           cursor above cannot see them. Every such write touches the
           channel (discuss_channels.updated_at via its BEFORE UPDATE
           trigger); report touched channels so open clients reconcile. The
           insert trigger also touches the channel, so rows whose updated_at
           merely matches last_message_at (a new message) are skipped. */
        if (iter % CHANGE_EVERY === 0) {
          try {
            const { data: touched } = await supabaseServer
              .from(CHANNELS)
              .select("id, updated_at, last_message_at, name, description, archived_at")
              .in("id", channelIds)
              .gt("updated_at", changeCursor)
              .limit(100);
            const touchedRows = (touched ?? []) as Array<{ id: string; updated_at: string; last_message_at: string | null; name: string | null; description: string | null; archived_at: string | null }>;
            /* Membership of the channels touched by something other than a
               new message (membership writes touch the channel too), so a
               reaction burst costs one small read here instead of a member
               reload on every open client. */
            const edited = touchedRows.filter((ch) => {
              const last = ch.last_message_at ? Date.parse(ch.last_message_at) : 0;
              return Date.parse(ch.updated_at) - last > CHANGE_SLACK_MS;
            });
            let members = new Map<string, string>();
            if (edited.length > 0) {
              try { members = await memberSigs(edited.map((ch) => ch.id)); } catch { /* flag nothing this pass */ }
            }
            for (const ch of touchedRows) {
              if (ch.updated_at > changeCursor) changeCursor = ch.updated_at;
              const upd = Date.parse(ch.updated_at);
              const last = ch.last_message_at ? Date.parse(ch.last_message_at) : 0;
              /* Rename / re-describe / archive: a sidebar-level change. The
                 first sighting of a channel only records its signature. */
              const sig = sigOf(ch);
              const prevSig = metaSig.get(ch.id);
              metaSig.set(ch.id, sig);
              const meta = prevSig !== undefined && prevSig !== sig;
              const mSig = members.get(ch.id);
              const prevMSig = memberSig.get(ch.id);
              if (mSig !== undefined) memberSig.set(ch.id, mSig);
              const membersChanged = mSig !== undefined && prevMSig !== undefined && prevMSig !== mSig;
              if (upd - last > CHANGE_SLACK_MS || meta || membersChanged) {
                send(`event: chg\ndata: ${JSON.stringify({ channelId: ch.id, at: ch.updated_at, ...(meta ? { meta: true } : {}), ...(membersChanged ? { members: true } : {}) })}\n\n`);
                lastActivity = Date.now();
              }
            }
          } catch { /* next tick retries */ }
        }
      }

      send(`event: bye\ndata: {}\n\n`);
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      /* Disable buffering on any intermediary that honours it. */
      "X-Accel-Buffering": "no",
    },
  });
}
