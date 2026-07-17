import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/discuss/state — RLS realtime-lockdown P1.

   Gated READ path for the three Discuss tables that are NOT in the realtime
   publication (so they never needed anon SELECT for postgres_changes):
     · discuss_drafts   — a user's own unsent draft text
     · discuss_pinned   — pinned message ids per channel
     · discuss_starred  — a user's global bookmarks

   Moving these reads server-side lets the companion migration drop their
   public SELECT policies (service_role only), closing 3 of the 8 remaining
   anon-open tables with zero realtime rework. Writes already go through
   /api/discuss/mutate.

   Identity is ALWAYS the signed-in session account — never client-supplied.
   `?resource=` selects the read:
     · draft&channelId=…   → the caller's draft for one channel
     · allDrafts           → all of the caller's non-empty drafts (+channel)
     · pinned&channelId=…  → the channel's pinned messages (author + reactions)
     · starred             → the caller's starred messages (author)
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import {
  serializeDiscussMessageForClient,
  serializeDiscussDraftForClient,
  serializeDiscussDraftsForClient,
} from "@/lib/server/discuss-serialize";
import { requireAuth } from "@/lib/server/auth";

const CHANNELS = "discuss_channels";
const MESSAGES = "discuss_messages";
const REACTIONS = "discuss_reactions";
const PINNED = "discuss_pinned";
const STARRED = "discuss_starred";
const DRAFTS = "discuss_drafts";

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

/** Normalise the accounts→people author join into the flat DiscussAuthor
 *  shape the client renders (identical to discuss.ts). */
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
    id,
    username,
    avatar_url,
    person:people ( full_name )
  )
`;

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const me = auth.account_id;

  const url = new URL(req.url);
  const resource = url.searchParams.get("resource");
  const channelId = url.searchParams.get("channelId");

  try {
    switch (resource) {
      /* ---- a single channel's draft for the caller --------------------- */
      case "draft": {
        if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });
        const { data, error } = await supabaseServer
          .from(DRAFTS)
          .select("*")
          .eq("account_id", me)
          .eq("channel_id", channelId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        /* Never ship the raw row: `select("*")` includes `metadata`, which is
           where a storage path would live if a draft ever carried media. */
        return NextResponse.json({
          ok: true,
          data: data ? serializeDiscussDraftForClient(data) : null,
        });
      }

      /* ---- every non-empty draft the caller owns (+channel) ------------- */
      case "allDrafts": {
        const { data, error } = await supabaseServer
          .from(DRAFTS)
          .select(`*, channel:${CHANNELS}!discuss_drafts_channel_id_fkey ( * )`)
          .eq("account_id", me)
          .order("updated_at", { ascending: false });
        if (error) throw new Error(error.message);
        const rows = ((data ?? []) as Array<
          Record<string, unknown> & {
            body?: string | null;
            metadata?: { attachments?: unknown[] } | null;
            channel?: unknown;
          }
        >)
          .map((row) => {
            const ch = Array.isArray(row.channel) ? row.channel[0] ?? null : row.channel ?? null;
            return { ...row, channel: ch };
          })
          .filter(
            (row) =>
              (typeof row.body === "string" && row.body.trim().length > 0) ||
              !!row.metadata?.attachments?.length,
          );
        /* The filter above reads metadata SERVER-SIDE only (to decide whether a
           draft is non-empty); the serializer then drops it before the response. */
        return NextResponse.json({ ok: true, data: serializeDiscussDraftsForClient(rows) });
      }

      /* ---- channel ids where the caller has a non-empty draft --------- */
      case "draftChannels": {
        const { data, error } = await supabaseServer
          .from(DRAFTS)
          .select("channel_id, body, metadata")
          .eq("account_id", me);
        if (error) throw new Error(error.message);
        const ids = ((data ?? []) as Array<{
          channel_id: string;
          body: string | null;
          metadata: { attachments?: unknown[] } | null;
        }>)
          .filter(
            (d) =>
              !!(d.body && d.body.trim()) ||
              !!(d.metadata?.attachments && d.metadata.attachments.length > 0),
          )
          .map((d) => d.channel_id);
        return NextResponse.json({ ok: true, data: ids });
      }

      /* ---- a channel's pinned messages (author + reactions) ------------ */
      case "pinned": {
        if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });
        const { data: pinnedRows, error } = await supabaseServer
          .from(PINNED)
          .select("message_id")
          .eq("channel_id", channelId)
          .order("pinned_at", { ascending: false });
        if (error) throw new Error(error.message);
        const ids = ((pinnedRows ?? []) as Array<{ message_id: string }>).map((r) => r.message_id);
        if (ids.length === 0) return NextResponse.json({ ok: true, data: [] });

        const { data: msgs } = await supabaseServer
          .from(MESSAGES)
          .select(AUTHOR_SELECT)
          .in("id", ids)
          .is("deleted_at", null);

        const { data: rxRows } = await supabaseServer
          .from(REACTIONS)
          .select("*")
          .in("message_id", ids);
        const reactionsByMessage = new Map<
          string,
          Array<{ emoji: string; count: number; account_ids: string[]; reacted_by_me: boolean }>
        >();
        for (const rx of (rxRows ?? []) as Array<{ message_id: string; emoji: string; account_id: string }>) {
          const bucket = reactionsByMessage.get(rx.message_id) ?? [];
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
          reactionsByMessage.set(rx.message_id, bucket);
        }

        const out = ((msgs ?? []) as Array<Record<string, unknown> & { id: string; author: AuthorJoin }>).map(
          (row) =>
            serializeDiscussMessageForClient({
              ...row,
              author: flattenAuthor(row.author),
              reactions: reactionsByMessage.get(row.id) ?? [],
              reply_preview: null,
              thread: null,
            }),
        );
        return NextResponse.json({ ok: true, data: out });
      }

      /* ---- the caller's starred messages (author) --------------------- */
      case "starred": {
        const { data: starRows, error } = await supabaseServer
          .from(STARRED)
          .select("message_id, starred_at")
          .eq("account_id", me)
          .order("starred_at", { ascending: false })
          .limit(200);
        if (error) throw new Error(error.message);
        const ids = ((starRows ?? []) as Array<{ message_id: string }>).map((r) => r.message_id);
        if (ids.length === 0) return NextResponse.json({ ok: true, data: [] });

        const { data: msgs } = await supabaseServer
          .from(MESSAGES)
          .select(AUTHOR_SELECT)
          .in("id", ids)
          .is("deleted_at", null);

        const out = ((msgs ?? []) as Array<Record<string, unknown> & { author: AuthorJoin }>).map((row) =>
          serializeDiscussMessageForClient({
            ...row,
            author: flattenAuthor(row.author),
            reactions: [],
            reply_preview: null,
            thread: null,
          }));
        return NextResponse.json({ ok: true, data: out });
      }

      default:
        return NextResponse.json({ error: "Unknown resource" }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Discuss state read failed";
    console.error("[api/discuss/state]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
