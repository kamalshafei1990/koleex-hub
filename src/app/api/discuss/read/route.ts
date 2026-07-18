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
import { requireAuth } from "@/lib/server/auth";
import { stageTimer } from "@/lib/server/perf";
import { serializeDiscussMessageForClient } from "@/lib/server/discuss-serialize";

const CHANNELS = "discuss_channels";
const MEMBERS = "discuss_members";
const MESSAGES = "discuss_messages";
const REACTIONS = "discuss_reactions";
const CONTACTS = "contacts";

type AuthorJoin =
  | {
      id: string;
      username: string;
      avatar_url: string | null;
      person: { full_name: string } | Array<{ full_name: string }> | null;
    }
  | Array<{
      id: string;
      username: string;
      avatar_url: string | null;
      person: { full_name: string } | Array<{ full_name: string }> | null;
    }>
  | null;

function flattenAuthor(raw: AuthorJoin) {
  const acc = Array.isArray(raw) ? raw[0] ?? null : raw;
  if (!acc) return null;
  const person = Array.isArray(acc.person) ? acc.person[0] ?? null : acc.person;
  return {
    id: acc.id,
    username: acc.username,
    avatar_url: acc.avatar_url,
    full_name: person?.full_name ?? null,
  };
}

const AUTHOR_SELECT = `
  *,
  author:accounts!discuss_messages_author_account_id_fkey (
    id, username, avatar_url, person:people ( full_name )
  )
`;

/** Aggregate reaction rows into the per-message summary the UI renders. */
function buildReactionMap(
  rxRows: Array<{ message_id: string; emoji: string; account_id: string }>,
  me: string,
) {
  const map = new Map<
    string,
    Array<{ emoji: string; count: number; account_ids: string[]; reacted_by_me: boolean }>
  >();
  for (const rx of rxRows) {
    const bucket = map.get(rx.message_id) ?? [];
    const existing = bucket.find((b) => b.emoji === rx.emoji);
    if (existing) {
      existing.count += 1;
      existing.account_ids.push(rx.account_id);
      if (rx.account_id === me) existing.reacted_by_me = true;
    } else {
      bucket.push({
        emoji: rx.emoji,
        count: 1,
        account_ids: [rx.account_id],
        reacted_by_me: rx.account_id === me,
      });
    }
    map.set(rx.message_id, bucket);
  }
  return map;
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

        const { data: channels } = await supabaseServer
          .from(CHANNELS)
          .select("*")
          .in("id", channelIds)
          .is("archived_at", null)
          .order("last_message_at", { ascending: false });
        const chanRows = (channels ?? []) as Array<Record<string, unknown> & { id: string; kind: string; linked_contact_id: string | null; last_message_at: string | null }>;
        if (chanRows.length === 0) return NextResponse.json({ ok: true, data: [] });

        /* DM peers — service_role resolves the accounts→people join directly. */
        const directIds = chanRows.filter((c) => c.kind === "direct").map((c) => c.id);
        const otherByChannel = new Map<string, ReturnType<typeof flattenAuthor>>();
        if (directIds.length > 0) {
          const { data: others } = await supabaseServer
            .from(MEMBERS)
            .select(
              `channel_id, account:accounts!discuss_members_account_id_fkey ( id, username, avatar_url, person:people ( full_name ) )`,
            )
            .in("channel_id", directIds)
            .neq("account_id", me);
          for (const row of (others ?? []) as Array<{ channel_id: string; account: AuthorJoin }>) {
            const a = flattenAuthor(row.account);
            if (a) otherByChannel.set(row.channel_id, a);
          }
        }

        /* Last-message preview per channel (newest first, pick first seen). */
        const { data: recentMsgs } = await supabaseServer
          .from(MESSAGES)
          .select(
            `id, channel_id, body, kind, author_account_id, created_at, author:accounts!discuss_messages_author_account_id_fkey ( username )`,
          )
          .in("channel_id", channelIds)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(Math.max(50, channelIds.length * 2));
        const lastByChannel = new Map<string, unknown>();
        for (const row of (recentMsgs ?? []) as Array<{
          id: string; channel_id: string; body: string | null; kind: string; created_at: string;
          author: { username: string } | Array<{ username: string }> | null;
        }>) {
          if (lastByChannel.has(row.channel_id)) continue;
          const a = Array.isArray(row.author) ? row.author[0] ?? null : row.author;
          lastByChannel.set(row.channel_id, {
            id: row.id, body: row.body, kind: row.kind,
            author_username: a?.username ?? null, created_at: row.created_at,
          });
        }

        /* Unread counts — provably-zero shortcut, else exact head count. */
        const unread = await Promise.all(
          chanRows.map(async (ch) => {
            const cursor = readState.get(ch.id)?.last_read_at;
            if (!cursor) return [ch.id, 0] as const;
            const lastMs = ch.last_message_at ? new Date(ch.last_message_at).getTime() : NaN;
            const curMs = new Date(cursor).getTime();
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
        const unreadMap = new Map(unread);

        /* Linked CRM contacts for customer channels. */
        const customerRows = chanRows.filter((c) => c.kind === "customer" && c.linked_contact_id);
        const contactByChannel = new Map<string, unknown>();
        if (customerRows.length > 0) {
          const contactIds = Array.from(new Set(customerRows.map((c) => c.linked_contact_id as string)));
          const { data: contacts } = await supabaseServer
            .from(CONTACTS)
            .select("id, display_name, full_name, first_name, last_name, company, email, phone, photo_url, contact_type")
            .in("id", contactIds);
          const byId = new Map<string, unknown>();
          for (const row of (contacts ?? []) as Array<Record<string, string | null> & { id: string }>) {
            const displayName =
              row.display_name ?? row.full_name ??
              [row.first_name, row.last_name].filter(Boolean).join(" ") ?? "Unnamed contact";
            byId.set(row.id, {
              id: row.id, display_name: displayName || "Unnamed contact", full_name: row.full_name,
              company: row.company, email: row.email, phone: row.phone,
              avatar_url: row.photo_url, contact_type: row.contact_type,
            });
          }
          for (const c of customerRows) {
            const linked = byId.get(c.linked_contact_id as string);
            if (linked) contactByChannel.set(c.id, linked);
          }
        }

        /* Draft flags. */
        const draftChannelIds = new Set<string>();
        {
          const { data: drafts } = await supabaseServer
            .from("discuss_drafts")
            .select("channel_id, body, metadata")
            .eq("account_id", me)
            .in("channel_id", channelIds);
          for (const d of (drafts ?? []) as Array<{ channel_id: string; body: string | null; metadata: { attachments?: unknown[] } | null }>) {
            if ((d.body && d.body.trim()) || d.metadata?.attachments?.length) draftChannelIds.add(d.channel_id);
          }
        }

        const out = chanRows.map((ch) => ({
          ...ch,
          unread_count: unreadMap.get(ch.id) ?? 0,
          last_read_at: readState.get(ch.id)?.last_read_at ?? null,
          muted: readState.get(ch.id)?.muted ?? false,
          notification_pref: readState.get(ch.id)?.notification_pref ?? "all",
          other: otherByChannel.get(ch.id) ?? null,
          linked_contact: contactByChannel.get(ch.id) ?? null,
          last_message: lastByChannel.get(ch.id) ?? null,
          has_draft: draftChannelIds.has(ch.id),
        }));
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
          : null;

        const threadQuery = messageIds.length > 0
          ? supabaseServer
              .from(MESSAGES).select("reply_to_message_id, author_account_id, created_at")
              .in("reply_to_message_id", messageIds).is("deleted_at", null)
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
            id: p.id, body: p.body, kind: p.kind, deleted_at: p.deleted_at,
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
        const { data: childRows } = await supabaseServer
          .from(MESSAGES).select(AUTHOR_SELECT)
          .eq("reply_to_message_id", parentId)
          .order("created_at", { ascending: true });
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
          .select(`*, account:accounts!discuss_members_account_id_fkey ( id, username, avatar_url, person:people ( full_name ) )`)
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
             author:accounts!discuss_messages_author_account_id_fkey ( username, avatar_url, person:people ( full_name ) ),
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
