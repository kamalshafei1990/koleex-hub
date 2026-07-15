import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/inbox/feed — RLS realtime-lockdown P3-D.

   Gated READ path for inbox_messages so its last public policy (SELECT) can be
   dropped (service_role only). Every read is recipient-scoped to the signed-in
   session account — never a client-supplied id:

     · messages[&archived=1][&limit=]  → the caller's inbox (+ sender join)
     · unread                          → unread, non-archived count
     · unreadTasks                     → unread to-do assignment count

   Freshness is driven by server Broadcast pings on inbox:account:<id> (see
   /api/inbox/mutate + realtime-broadcast.ts), not anon postgres_changes.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

const INBOX = "inbox_messages";

type SenderJoin =
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

function flattenSender(raw: SenderJoin) {
  const s = Array.isArray(raw) ? raw[0] ?? null : raw;
  if (!s) return null;
  const person = Array.isArray(s.person) ? s.person[0] ?? null : s.person;
  return { id: s.id, username: s.username, avatar_url: s.avatar_url, full_name: person?.full_name ?? null };
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const me = auth.account_id;

  const url = new URL(req.url);
  const resource = url.searchParams.get("resource");

  try {
    switch (resource) {
      case "messages": {
        const includeArchived = url.searchParams.get("archived") === "1";
        const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 200);
        let q = supabaseServer
          .from(INBOX)
          .select(
            `*, sender:accounts!inbox_messages_sender_account_id_fkey ( id, username, avatar_url, person:people ( full_name ) )`,
          )
          .eq("recipient_account_id", me)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (!includeArchived) q = q.is("archived_at", null);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        const rows = ((data ?? []) as Array<Record<string, unknown> & { sender: SenderJoin }>).map((row) => {
          const { sender: _s, ...base } = row;
          void _s;
          return { ...base, sender: flattenSender(row.sender) };
        });
        return NextResponse.json({ ok: true, data: rows });
      }

      case "unread": {
        const { count, error } = await supabaseServer
          .from(INBOX)
          .select("*", { count: "exact", head: true })
          .eq("recipient_account_id", me)
          .is("read_at", null)
          .is("archived_at", null);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true, data: count ?? 0 }, {
          // Badge counts feed the home/header; a short SWR cache collapses the
          // repeated (realtime-triggered) refetches to one round-trip. Realtime
          // pings still refresh them; the count can lag a few seconds at most.
          headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" },
        });
      }

      case "unreadTasks": {
        const { count, error } = await supabaseServer
          .from(INBOX)
          .select("*", { count: "exact", head: true })
          .eq("recipient_account_id", me)
          .eq("category", "task")
          .eq("metadata->>type", "todo_assignment")
          .is("read_at", null)
          .is("archived_at", null);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true, data: count ?? 0 }, {
          // Badge counts feed the home/header; a short SWR cache collapses the
          // repeated (realtime-triggered) refetches to one round-trip. Realtime
          // pings still refresh them; the count can lag a few seconds at most.
          headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" },
        });
      }

      default:
        return NextResponse.json({ error: "Unknown resource" }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Inbox feed read failed";
    console.error("[api/inbox/feed]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
