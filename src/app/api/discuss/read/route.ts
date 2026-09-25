import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/discuss/read — RLS realtime-lockdown P3 (broadcast-ping model).

   Gated READ path for the four realtime-backed Discuss tables
   (discuss_channels / members / messages / reactions) so their public SELECT
   policies can be dropped (service_role only). Every read is executed with the
   service-role client and scoped by the signed-in session:

     · myChannels                  → the caller's sidebar (memberships-scoped)
     · channelMessages&channelId   → a channel's messages (membership-gated)
     · thread&parentId             → a thread (membership-gated via parent)
     · members&channelId           → a channel's members (membership-gated)
     · search&q=…[&channelId]      → full-text over the caller's channels only

   Identity is ALWAYS the session account — never client-supplied. Freshness is
   driven by server Broadcast pings (see /api/discuss/mutate), not anon
   postgres_changes, so these tables need no anon SELECT.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { stageTimer } from "@/lib/server/perf";
import {
  serializeDiscussMessageForClient,
  flattenDiscussAuthor as flattenAuthor,
  buildDiscussReactionMap as buildReactionMap,
  DISCUSS_AUTHOR_SELECT as AUTHOR_SELECT,
  type DiscussAuthorJoin as AuthorJoin,
} from "@/lib/server/discuss-serialize";

const CHANNELS = "discuss_channels";
const MEMBERS = "discuss_members";
const MESSAGES = "discuss_messages";
const REACTIONS = "discuss_reactions";
const CONTACTS = "contacts";

type LastMessage = {
  id: string;
  body: string | null;
  kind: string;
  author_username: string | null;
  created_at: string;
};

/* Whether the discuss_last_messages RPC (20260925_discuss_audit.sql) exists
   in this database. Unknown until the first call; a "function does not
   exist" answer flips it off for the life of the instance so the fallback
   is not preceded by a doomed round trip on every sidebar load. */
let lastMessagesRpc: boolean | null = null;

/** The newest non-deleted message of EACH channel. The old sidebar read the
 *  newest max(50, 2n) messages across ALL channels and kept the first per
 *  channel, so one busy channel pushed every quieter one out of the window
 *  and their rows rendered a blank preview. */
async function lastMessagePerChannel(
  channelIds: string[],
  lastAt: Map<string, string | null>,
): Promise<Map<string, LastMessage>> {
  const out = new Map<string, LastMessage>();
  if (channelIds.length === 0) return out;

  if (lastMessagesRpc !== false) {
    const { data, error } = await supabaseServer.rpc("discuss_last_messages", { p_channel_ids: channelIds });
    if (!error) {
      lastMessagesRpc = true;
      for (const r of (data ?? []) as Array<LastMessage & { channel_id: string }>) {
        out.set(r.channel_id, {
          id: r.id, body: r.body, kind: r.kind, author_username: r.author_username ?? null, created_at: r.created_at,
        });
      }
      return out;
    }
    if (/does not exist|could not find the function|PGRST202/i.test(`${error.code ?? ""} ${error.message}`)) {
      lastMessagesRpc = false;
    }
  }

  /* Fallback without DDL: one batched window catches the busy channels,
     then an indexed `limit 1` per channel that is still missing a preview
     (and has had a message at all). Bounded so a huge sidebar cannot fan
     out unboundedly; channels past the cap keep last_message_at ordering. */
  const addRow = (row: {
    id: string; channel_id: string; body: string | null; kind: string; created_at: string;
    author: { username: string } | Array<{ username: string }> | null;
  }) => {
    if (out.has(row.channel_id)) return;
    const a = Array.isArray(row.author) ? row.author[0] ?? null : row.author;
    out.set(row.channel_id, {
      id: row.id, body: row.body, kind: row.kind, author_username: a?.username ?? null, created_at: row.created_at,
    });
  };
  const SELECT = `id, channel_id, body, kind, created_at, author:accounts!discuss_messages_author_account_id_fkey ( username )`;
  const { data: recent } = await supabaseServer
    .from(MESSAGES)
    .select(SELECT)
    .in("channel_id", channelIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(Math.max(50, channelIds.length * 2));
  for (const row of (recent ?? []) as Array<Parameters<typeof addRow>[0]>) addRow(row);

  const missing = channelIds.filter((id) => !out.has(id) && lastAt.get(id)).slice(0, 60);
  await Promise.all(
    missing.map(async (id) => {
      const { data } = await supabaseServer
        .from(MESSAGES)
        .select(SELECT)
        .eq("channel_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1);
      const row = ((data ?? []) as Array<Parameters<typeof addRow>[0]>)[0];
      if (row) addRow(row);
    }),
  );
  return out;
}

/* Time ONE enrichment query without altering its result or its failure mode.
   A null query (guard unmet) reports 0 and is never awaited — the distinction
   between "ran in 0ms" and "never ran" is carried by the companion count tag,
   not by the duration. */
async function timedQuery<T>(q: PromiseLike<T> | null): Promise<{ res: T | null; ms: number }> {
  if (!q) return { res: null, ms: 0 };
  const t = performance.now();
  const res = await q;
  return { res, ms: Math.round((performance.now() - t) * 10) / 10 };
}

/** The caller's active channel ids (single source of truth for gating). */
async function myChannelIds(me: string): Promise<string[]> {
  const { data } = await supabaseServer
    .from(MEMBERS)
    .select("channel_id")
    .eq("account_id", me)
    .is("left_at", null);
  return ((data ?? []) as Array<{ channel_id: string }>).map((r) => r.channel_id);
}

export async function GET(req: Request) {
  const timing = stageTimer("discuss.read"); /* kx-perf */
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  /* Discuss is a permissioned module like every other Hub app: a role
     without Discuss (e.g. Customer) reads nothing here. */
  const denied = await requireModuleAccess(auth, "Discuss");
  if (denied) return denied;
  timing.mark("auth");
  const me = auth.account_id;

  const url = new URL(req.url);
  const resource = url.searchParams.get("resource");
  const channelId = url.searchParams.get("channelId");

  try {
    switch (resource) {
      /* ---- sidebar: every channel the caller is in, enriched ---------- */
      case "myChannels": {
        const { data: memberships } = await supabaseServer
          .from(MEMBERS)
          .select(
            "channel_id, last_read_at, muted, notification_pref, joined_at, pinned_at, hidden_at, marked_unread",
          )
          .eq("account_id", me)
          .is("left_at", null);
        const memRows = (memberships ?? []) as Array<{
          channel_id: string;
          last_read_at: string | null;
          muted: boolean;
          notification_pref: string;
          joined_at: string | null;
          pinned_at: string | null;
          hidden_at: string | null;
          marked_unread: boolean | null;
        }>;
        if (memRows.length === 0) return NextResponse.json({ ok: true, data: [] });

        const channelIds = memRows.map((m) => m.channel_id);
        const readState = new Map(
          memRows.map((m) => [
            m.channel_id,
            {
              /* Unread cursor: where the user last read. If they've never
                 opened the channel, fall back to when they joined — so a
                 channel full of messages they've never seen counts as unread
                 (previously it showed 0, hiding the badge). */
              last_read_at: m.last_read_at ?? m.joined_at,
              muted: m.muted,
              notification_pref: m.notification_pref ?? "all",
              /* WeChat-style per-user conversation state. */
              pinned_at: m.pinned_at,
              hidden_at: m.hidden_at,
              marked_unread: m.marked_unread === true,
            },
          ]),
        );

        /* Round trip 2 — everything that needs only the channel ids, in
           parallel: the channel rows, my drafts. (Was 7 sequential queries.) */
        const [{ data: channels }, { data: drafts }] = await Promise.all([
          supabaseServer
            .from(CHANNELS)
            .select("*")
            .in("id", channelIds)
            .is("archived_at", null)
            .order("last_message_at", { ascending: false }),
          supabaseServer
            .from("discuss_drafts")
            .select("channel_id, body, metadata")
            .eq("account_id", me)
            .in("channel_id", channelIds),
        ]);
        const chanRows = (channels ?? []) as Array<Record<string, unknown> & { id: string; kind: string; linked_contact_id: string | null; last_message_at: string | null }>;
        if (chanRows.length === 0) return NextResponse.json({ ok: true, data: [] });
        const liveIds = chanRows.map((c) => c.id);
        const lastAt = new Map(chanRows.map((c) => [c.id, c.last_message_at]));

        const draftChannelIds = new Set<string>();
        for (const d of (drafts ?? []) as Array<{ channel_id: string; body: string | null; metadata: { attachments?: unknown[] } | null }>) {
          if ((d.body && d.body.trim()) || d.metadata?.attachments?.length) draftChannelIds.add(d.channel_id);
        }

        /* Round trip 3 — the enrichments that depend on the channel rows,
           all independent of each other, in parallel. */
        const directIds = chanRows.filter((c) => c.kind === "direct").map((c) => c.id);
        const customerRows = chanRows.filter((c) => c.kind === "customer" && c.linked_contact_id);
        const contactIds = Array.from(new Set(customerRows.map((c) => c.linked_contact_id as string)));

        const othersQ = directIds.length > 0
          ? supabaseServer
              .from(MEMBERS)
              .select(
                `channel_id, account:accounts!discuss_members_account_id_fkey ( id, username, avatar_url, person:people ( full_name, name_alt ) )`,
              )
              .in("channel_id", directIds)
              .neq("account_id", me)
          : null;
        let contactsQ = contactIds.length > 0
          ? supabaseServer
              .from(CONTACTS)
              .select("id, display_name, full_name, first_name, last_name, company, email, phone, photo_url, contact_type")
              .in("id", contactIds)
          : null;
        /* A linked contact is shown only if it belongs to the caller's
           tenant — the channel link alone is not proof of that. */
        if (contactsQ) contactsQ = auth.tenant_id ? contactsQ.eq("tenant_id", auth.tenant_id) : contactsQ.is("tenant_id", null);

        const unreadP = Promise.all(
          chanRows.map(async (ch) => {
            const cursor = readState.get(ch.id)?.last_read_at;
            if (!cursor) return [ch.id, 0] as const;
            const lastMs = ch.last_message_at ? new Date(ch.last_message_at).getTime() : NaN;
            const curMs = new Date(cursor).getTime();
            /* Provably-zero shortcut, else exact head count. */
            if (Number.isFinite(lastMs) && Number.isFinite(curMs) && lastMs <= curMs) {
              return [ch.id, 0] as const;
            }
            const { count } = await supabaseServer
              .from(MESSAGES)
              .select("id", { count: "exact", head: true })
              .eq("channel_id", ch.id)
              .is("deleted_at", null)
              .neq("author_account_id", me)
              .gt("created_at", cursor);
            return [ch.id, count ?? 0] as const;
          }),
        );

        const [othersRes, contactsRes, unread, lastByChannel] = await Promise.all([
          othersQ ?? Promise.resolve({ data: [] as unknown[] }),
          contactsQ ?? Promise.resolve({ data: [] as unknown[] }),
          unreadP,
          lastMessagePerChannel(liveIds, lastAt),
        ]);

        const otherByChannel = new Map<string, ReturnType<typeof flattenAuthor>>();
        for (const row of (othersRes.data ?? []) as Array<{ channel_id: string; account: AuthorJoin }>) {
          const a = flattenAuthor(row.account);
          if (a) otherByChannel.set(row.channel_id, a);
        }
        const unreadMap = new Map(unread);

        const contactByChannel = new Map<string, unknown>();
        if (customerRows.length > 0) {
          const byId = new Map<string, unknown>();
          for (const row of (contactsRes.data ?? []) as Array<Record<string, string | null> & { id: string }>) {
            const displayName =
              row.display_name || row.full_name ||
              [row.first_name, row.last_name].filter(Boolean).join(" ") || "";
            byId.set(row.id, {
              id: row.id, display_name: displayName || "—", full_name: row.full_name,
              company: row.company, email: row.email, phone: row.phone,
              avatar_url: row.photo_url, contact_type: row.contact_type,
            });
          }
          for (const c of customerRows) {
            const linked = byId.get(c.linked_contact_id as string);
            if (linked) contactByChannel.set(c.id, linked);
          }
        }

        const out = chanRows
          /* Hidden ("removed from list"): drop the conversation UNLESS a newer
             message arrived after it was hidden — then it resurfaces, exactly
             like WeChat. Without this filter the sidebar menu's Hide action
             wrote hidden_at but the list kept showing the chat. */
          .filter((ch) => {
            const hiddenAt = readState.get(ch.id)?.hidden_at;
            if (!hiddenAt) return true;
            const lastMs = ch.last_message_at ? new Date(ch.last_message_at).getTime() : 0;
            const hidMs = new Date(hiddenAt).getTime();
            return Number.isFinite(lastMs) && lastMs > hidMs;
          })
          .map((ch) => {
            const st = readState.get(ch.id);
            const unreadN = unreadMap.get(ch.id) ?? 0;
            return {
              ...ch,
              /* Muted conversations do not count toward any badge (bell, home
                 tile, floating panel — they all sum unread_count), exactly
                 like WeChat. Their count still travels, separately, as
                 muted_unread_count so Discuss can show it on the row. */
              unread_count: st?.muted ? 0 : unreadN,
              muted_unread_count: st?.muted ? unreadN : 0,
              last_read_at: st?.last_read_at ?? null,
              muted: st?.muted ?? false,
              notification_pref: st?.notification_pref ?? "all",
              pinned: !!st?.pinned_at,
              pinned_at: st?.pinned_at ?? null,
              marked_unread: st?.marked_unread ?? false,
              other: otherByChannel.get(ch.id) ?? null,
              linked_contact: contactByChannel.get(ch.id) ?? null,
              last_message: lastByChannel.get(ch.id) ?? null,
              has_draft: draftChannelIds.has(ch.id),
            };
          });
        /* Pinned conversations float to the top of their group (most-recently
           pinned first); everything else keeps last-message order. */
        out.sort((a, b) => {
          if (a.pinned && b.pinned) {
            return new Date(b.pinned_at ?? 0).getTime() - new Date(a.pinned_at ?? 0).getTime();
          }
          if (a.pinned) return -1;
          if (b.pinned) return 1;
          return 0; // chanRows already ordered by last_message_at desc
        });
        timing.mark("db");
        const { header } = timing.done({ resource: "myChannels", channels: out.length });
        return NextResponse.json({ ok: true, data: out }, { headers: { "Server-Timing": header } });
      }

      /* ---- a channel's messages (membership-gated) -------------------- */
      case "channelMessages": {
        if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });
        const scope = await myChannelIds(me);
        timing.mark("scope");
        if (!scope.includes(channelId)) return NextResponse.json({ ok: true, data: [] });

        /* Fast incremental path — used by the realtime refresh to fetch ONLY
           messages newer than `after` (chronological). A single query, no
           reactions/reply/thread assembly, so a just-arrived message reaches
           the receiver almost as fast as the notification ping. The regular
           full fetch (below) and the 5s poll reconcile reactions/edits. */
        const after = url.searchParams.get("after");
        if (after) {
          const { data: incr } = await supabaseServer
            .from(MESSAGES)
            .select(AUTHOR_SELECT)
            .eq("channel_id", channelId)
            .gt("created_at", after)
            .order("created_at", { ascending: true })
            .limit(60);
          const fresh = ((incr ?? []) as Array<
            Record<string, unknown> & { id: string; author: AuthorJoin; reply_to_message_id: string | null }
          >).map((row) => serializeDiscussMessageForClient({
            ...row,
            author: flattenAuthor(row.author),
            reactions: [],
            reply_preview: null,
            thread: null,
          }));
          timing.mark("db");
          const { header } = timing.done({ resource: "channelMessages", mode: "incremental", rows: fresh.length });
          return NextResponse.json({ ok: true, data: fresh }, { headers: { "Server-Timing": header } });
        }

        const limit = Math.min(Number(url.searchParams.get("limit")) || 80, 200);
        const before = url.searchParams.get("before");
        let q = supabaseServer
          .from(MESSAGES).select(AUTHOR_SELECT)
          .eq("channel_id", channelId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (before) q = q.lt("created_at", before);
        const { data } = await q;
        timing.mark("base");
        const rows = ((data ?? []) as Array<Record<string, unknown> & { id: string; author: AuthorJoin; reply_to_message_id: string | null }>).map(
          (row) => ({ ...row, author: flattenAuthor(row.author) }),
        );
        const messageIds = rows.map((r) => r.id);

        /* ── enrichment: three INDEPENDENT queries, run concurrently ──────
           reactions, reply previews and thread aggregation each depend only on
           ids already derived from `rows`. None depends on another's result and
           none mutates state, so awaiting them in sequence spent three round
           trips to do one round trip's work. Traced from the code, not inferred
           from elapsed time.

           This reduces WALL-CLOCK only. The database still executes the same
           three queries and does the same total work — the requests simply
           overlap instead of queueing.

           Failure semantics are UNCHANGED and deliberately so: each call already
           destructured `data` and ignored `error`, so a failed enrichment
           yielded `undefined` → `?? []` → an empty map, i.e. the page rendered
           without reactions rather than 500ing. supabase-js resolves (never
           rejects) on a query error, so Promise.all cannot introduce a new
           rejection path. Silent partial enrichment is pre-existing behaviour;
           changing it is a separate decision, not a side effect of this one. */
        const replyTargetIds = Array.from(new Set(rows.map((r) => r.reply_to_message_id).filter(Boolean) as string[]));

        const reactionsQuery = messageIds.length > 0
          ? supabaseServer.from(REACTIONS).select("*").in("message_id", messageIds)
          : null;

        /* Preserved: no reply targets → no query issued at all. */
        const replyPreviewQuery = replyTargetIds.length > 0
          ? supabaseServer
              .from(MESSAGES)
              .select(`id, body, kind, deleted_at, author:accounts!discuss_messages_author_account_id_fkey ( username, person:people ( full_name ) )`)
              .in("id", replyTargetIds)
              /* Scoped to THIS channel: a reply id is client-influenced, so
                 an unscoped lookup could preview a message from elsewhere. */
              .eq("channel_id", channelId)
          : null;

        const threadQuery = messageIds.length > 0
          ? supabaseServer
              .from(MESSAGES).select("reply_to_message_id, author_account_id, created_at")
              .in("reply_to_message_id", messageIds).is("deleted_at", null)
              .eq("channel_id", channelId)
          : null;

        /* Each query is timed individually INSIDE the same Promise.all, so the
           three still overlap; timedQuery only brackets an await that already
           happened. `enrichMs` is the wall-clock of the overlapped set and
           `enrichSumMs` the sum of the individual durations — reporting both is
           the whole point: the gap between them is the only thing this change
           buys. Total database WORK is unchanged. */
        const enrichStart = performance.now();
        const [rx, parent, child] = await Promise.all([
          timedQuery(reactionsQuery),
          timedQuery(replyPreviewQuery),
          timedQuery(threadQuery),
        ]);
        const enrichMs = Math.round((performance.now() - enrichStart) * 10) / 10;
        const enrichSumMs = Math.round((rx.ms + parent.ms + child.ms) * 10) / 10;
        const rxRes = rx.res, parentRes = parent.res, childRes = child.res;

        let reactionMap = new Map<string, unknown>();
        if (rxRes) {
          reactionMap = buildReactionMap((rxRes.data ?? []) as Array<{ message_id: string; emoji: string; account_id: string }>, me);
        }

        const replyPreviewById = new Map<string, unknown>();
        for (const p of ((parentRes?.data ?? []) as Array<{ id: string; body: string | null; kind: string; deleted_at: string | null; author: AuthorJoin }>)) {
          const a = Array.isArray(p.author) ? p.author[0] ?? null : p.author;
          const person = a && (Array.isArray(a.person) ? a.person[0] ?? null : a.person);
          replyPreviewById.set(p.id, {
            /* A deleted parent previews as a tombstone — never its text. */
            id: p.id, body: p.deleted_at ? null : p.body, kind: p.kind, deleted_at: p.deleted_at,
            author_username: a?.username ?? null, author_full_name: person?.full_name ?? null,
          });
        }

        const threadByParent = new Map<string, { reply_count: number; last_reply_at: string | null; participant_ids: string[] }>();
        for (const row of ((childRes?.data ?? []) as Array<{ reply_to_message_id: string; author_account_id: string | null; created_at: string }>)) {
          const entry = threadByParent.get(row.reply_to_message_id) ?? { reply_count: 0, last_reply_at: null as string | null, participant_ids: [] as string[] };
          entry.reply_count += 1;
          if (!entry.last_reply_at || row.created_at > entry.last_reply_at) entry.last_reply_at = row.created_at;
          if (row.author_account_id && !entry.participant_ids.includes(row.author_account_id)) entry.participant_ids.push(row.author_account_id);
          threadByParent.set(row.reply_to_message_id, entry);
        }

        timing.mark("enrich");
        const out = rows
          .map((row) =>
            serializeDiscussMessageForClient({
              ...row,
              reactions: reactionMap.get(row.id) ?? [],
              reply_preview: row.reply_to_message_id ? replyPreviewById.get(row.reply_to_message_id) ?? null : null,
              thread: threadByParent.get(row.id) ?? null,
            }),
          )
          .reverse();
        timing.mark("serialize");
        const { header } = timing.done({
          resource: "channelMessages", mode: "full", rows: out.length,
          /* db_* = individual query durations. Their SUM is what the sequential
             version paid; enrich_ms is what the parallel version actually costs. */
          db_reactions_ms: rx.ms, db_reply_preview_ms: parent.ms, db_thread_ms: child.ms,
          enrich_sum_ms: enrichSumMs, enrich_ms: enrichMs,
          /* Counts disambiguate a 0ms duration: skipped vs instant. */
          reply_targets: replyTargetIds.length,
          queries_issued: [reactionsQuery, replyPreviewQuery, threadQuery].filter(Boolean).length,
        });
        return NextResponse.json({ ok: true, data: out }, { headers: { "Server-Timing": header } });
      }

      /* ---- a thread (parent + children), membership-gated ------------- */
      case "thread": {
        const parentId = url.searchParams.get("parentId");
        if (!parentId) return NextResponse.json({ error: "parentId required" }, { status: 400 });
        const { data: parentRow } = await supabaseServer
          .from(MESSAGES).select(AUTHOR_SELECT).eq("id", parentId).maybeSingle();
        if (!parentRow) return NextResponse.json({ ok: true, data: [] });
        const scope = await myChannelIds(me);
        if (!scope.includes((parentRow as { channel_id: string }).channel_id)) {
          return NextResponse.json({ ok: true, data: [] });
        }
        /* Children must live in the parent's channel: reply_to_message_id is
           set by the sender, so without this a member of ANOTHER channel
           could inject rows into this thread view. */
        const { data: childRows } = await supabaseServer
          .from(MESSAGES).select(AUTHOR_SELECT)
          .eq("reply_to_message_id", parentId)
          .eq("channel_id", (parentRow as { channel_id: string }).channel_id)
          .order("created_at", { ascending: true })
          .limit(500);
        const all = [parentRow, ...((childRows ?? []) as unknown[])];
        const ids = [parentId, ...((childRows ?? []) as Array<{ id: string }>).map((r) => r.id)];
        let reactionMap = new Map<string, unknown>();
        if (ids.length > 0) {
          const { data: rxRows } = await supabaseServer.from(REACTIONS).select("*").in("message_id", ids);
          reactionMap = buildReactionMap((rxRows ?? []) as Array<{ message_id: string; emoji: string; account_id: string }>, me);
        }
        const out = (all as Array<Record<string, unknown> & { id: string; author: AuthorJoin }>).map((row) =>
          serializeDiscussMessageForClient({
            ...row, author: flattenAuthor(row.author),
            reactions: reactionMap.get(row.id) ?? [], reply_preview: null, thread: null,
          }));
        return NextResponse.json({ ok: true, data: out });
      }

      /* ---- a channel's members (membership-gated) --------------------- */
      case "members": {
        if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });
        const scope = await myChannelIds(me);
        if (!scope.includes(channelId)) return NextResponse.json({ ok: true, data: [] });
        const { data } = await supabaseServer
          .from(MEMBERS)
          .select(`*, account:accounts!discuss_members_account_id_fkey ( id, username, avatar_url, person:people ( full_name, name_alt ) )`)
          .eq("channel_id", channelId)
          .is("left_at", null);
        const out = ((data ?? []) as Array<Record<string, unknown> & { account: AuthorJoin }>).map((row) => ({
          ...row,
          author: flattenAuthor(row.account) ?? { id: "", username: "unknown", avatar_url: null, full_name: null },
        }));
        return NextResponse.json({ ok: true, data: out });
      }

      /* ---- full-text search over the caller's channels only ----------- */
      case "search": {
        const query = (url.searchParams.get("q") ?? "").trim();
        if (query.length < 2) return NextResponse.json({ ok: true, data: [] });
        const limit = Math.min(Number(url.searchParams.get("limit")) || 40, 100);
        let scope = await myChannelIds(me);
        if (channelId) scope = scope.filter((id) => id === channelId);
        if (scope.length === 0) return NextResponse.json({ ok: true, data: [] });
        const escaped = query.replace(/[%_]/g, (c) => `\\${c}`);
        const { data } = await supabaseServer
          .from(MESSAGES)
          .select(
            `id, channel_id, body, created_at,
             author:accounts!discuss_messages_author_account_id_fkey ( username, avatar_url, person:people ( full_name, name_alt ) ),
             channel:discuss_channels!discuss_messages_channel_id_fkey ( id, name, kind )`,
          )
          .in("channel_id", scope)
          .is("deleted_at", null)
          .ilike("body", `%${escaped}%`)
          .order("created_at", { ascending: false })
          .limit(limit);
        return NextResponse.json({ ok: true, data: data ?? [], raw: true });
      }

      default:
        return NextResponse.json({ error: "Unknown resource" }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Discuss read failed";
    console.error("[api/discuss/read]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
