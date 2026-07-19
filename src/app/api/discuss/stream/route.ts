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
     · the stream self-terminates before maxDuration; EventSource reconnects.

   Delivery latency: poll cadence /2 (~0.5s median) + SSE push ≈ WeChat-feel,
   independent of Supabase websocket reachability. The Supabase broadcast path
   stays as a supplement where it works; the client dedupes by message id.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { serializeDiscussMessageForClient } from "@/lib/server/discuss-serialize";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MEMBERS = "discuss_members";
const MESSAGES = "discuss_messages";

/* Keep in lockstep with /api/discuss/read AUTHOR_SELECT. */
const AUTHOR_SELECT = `
  *,
  author:accounts!discuss_messages_author_account_id_fkey (
    id, username, avatar_url, person:people ( full_name, name_alt )
  )
`;

type AuthorJoin =
  | { id: string; username: string; avatar_url: string | null; person: { full_name: string } | Array<{ full_name: string }> | null }
  | Array<{ id: string; username: string; avatar_url: string | null; person: { full_name: string } | Array<{ full_name: string }> | null }>
  | null;

function flattenAuthor(raw: AuthorJoin) {
  const acc = Array.isArray(raw) ? raw[0] ?? null : raw;
  if (!acc) return null;
  const person = Array.isArray(acc.person) ? acc.person[0] ?? null : acc.person;
  return { id: acc.id, username: acc.username, avatar_url: acc.avatar_url, full_name: person?.full_name ?? null, name_alt: (person as { name_alt?: string | null } | null)?.name_alt ?? null };
}

async function myChannelIds(me: string): Promise<string[]> {
  const { data } = await supabaseServer
    .from(MEMBERS)
    .select("channel_id")
    .eq("account_id", me)
    .is("left_at", null);
  return ((data ?? []) as Array<{ channel_id: string }>).map((r) => r.channel_id);
}

const POLL_MS = 900;          // cursor-poll cadence (median delivery ≈ 450ms)
const HEARTBEAT_EVERY = 22;   // ≈20s — keep proxies/CDN from timing the stream out
const MEMBERSHIP_EVERY = 33;  // ≈30s — pick up newly joined/left channels
const LIFETIME_MS = 280_000;  // self-terminate under maxDuration; client reconnects

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const me = auth.account_id;

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
      /* Cursor starts NOW — history is the read endpoint's job; the stream
         only carries what happens while it is open. Client dedupes by id. */
      let cursor = new Date().toISOString();
      const started = Date.now();
      let iter = 0;

      while (!closed && Date.now() - started < LIFETIME_MS) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (closed) break;
        iter += 1;

        if (iter % MEMBERSHIP_EVERY === 0) {
          try { channelIds = await myChannelIds(me); } catch { /* keep old set */ }
        }
        if (iter % HEARTBEAT_EVERY === 0) send(`: hb ${Date.now()}\n\n`);
        if (channelIds.length === 0) continue;

        try {
          const { data } = await supabaseServer
            .from(MESSAGES)
            .select(AUTHOR_SELECT)
            .in("channel_id", channelIds)
            .gt("created_at", cursor)
            .order("created_at", { ascending: true })
            .limit(60);
          const rows = (data ?? []) as Array<
            Record<string, unknown> & { id: string; created_at: string; author: AuthorJoin }
          >;
          for (const row of rows) {
            const serialized = serializeDiscussMessageForClient({
              ...row,
              author: flattenAuthor(row.author),
              reactions: [],
              reply_preview: null,
              thread: null,
            });
            send(`event: msg\ndata: ${JSON.stringify(serialized)}\n\n`);
            if (row.created_at > cursor) cursor = row.created_at;
          }
        } catch { /* transient query failure — next tick retries */ }
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
