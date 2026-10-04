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
  flattenDiscussAuthor as flattenAuthor,
  buildDiscussReactionMap,
  DISCUSS_AUTHOR_SELECT as AUTHOR_SELECT,
  type DiscussAuthorJoin as AuthorJoin,
} from "@/lib/server/discuss-serialize";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

const CHANNELS = "discuss_channels";
const MEMBERS = "discuss_members";
const MESSAGES = "discuss_messages";
const REACTIONS = "discuss_reactions";
const PINNED = "discuss_pinned";
const STARRED = "discuss_starred";
const DRAFTS = "discuss_drafts";

/** The caller's active channel ids — the gate for every message-bearing read. */
async function myChannelIds(me: string): Promise<string[]> {
  const { data } = await supabaseServer
    .from(MEMBERS)
    .select("channel_id")
    .eq("account_id", me)
    .is("left_at", null);
  return ((data ?? []) as Array<{ channel_id: string }>).map((r) => r.channel_id);
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = await requireModuleAccess(auth, "Discuss");
  if (denied) return denied;
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
        const scope = new Set(await myChannelIds(me));
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
          /* Only drafts for conversations I am still in — a draft must not
             keep a left channel's name/metadata reachable. */
          .filter((row) => scope.has(String((row as { channel_id?: unknown }).channel_id ?? "")))
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
        /* Membership-gated: pinned messages are channel content. */
        if (!auth.is_super_admin && !(await myChannelIds(me)).includes(channelId)) {
          return NextResponse.json({ ok: true, data: [] });
        }
        const { data: pinnedRows, error } = await supabaseServer
          .from(PINNED)
          .select("message_id")
          .eq("channel_id", channelId)
          .order("pinned_at", { ascending: false });
        if (error) throw new Error(error.message);
        const ids = ((pinnedRows ?? []) as Array<{ message_id: string }>).map((r) => r.message_id);
        if (ids.length === 0) return NextResponse.json({ ok: true, data: [] });

        const [{ data: msgs }, { data: rxRows }] = await Promise.all([
          supabaseServer
            .from(MESSAGES)
            .select(AUTHOR_SELECT)
            .in("id", ids)
            /* Defence in depth: a pin row whose message lives elsewhere
               (pre-fix data) is never returned. */
            .eq("channel_id", channelId)
            .is("deleted_at", null),
          supabaseServer.from(REACTIONS).select("*").in("message_id", ids),
        ]);
        const reactionsByMessage = buildDiscussReactionMap(
          (rxRows ?? []) as Array<{ message_id: string; emoji: string; account_id: string }>,
          me,
        );
        const order = new Map(ids.map((id, i) => [id, i]));
        const out = ((msgs ?? []) as Array<Record<string, unknown> & { id: string; author: AuthorJoin }>)
          .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
          .map((row) =>
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

        /* A bookmark is not an access grant: only messages in channels I am
           STILL a member of come back (optionally narrowed to one channel). */
        let scope = await myChannelIds(me);
        if (channelId) scope = scope.filter((id) => id === channelId);
        if (scope.length === 0) return NextResponse.json({ ok: true, data: [] });
        const { data: msgs } = await supabaseServer
          .from(MESSAGES)
          .select(AUTHOR_SELECT)
          .in("id", ids)
          .in("channel_id", scope)
          .is("deleted_at", null);

        const order = new Map(ids.map((id, i) => [id, i]));
        const out = ((msgs ?? []) as Array<Record<string, unknown> & { id: string; author: AuthorJoin }>)
          .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
          .map((row) =>
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
