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
      person: { full_name: string; name_alt: string | null } | Array<{ full_name: string; name_alt: string | null }> | null;
    }
  | Array<{
      id: string;
      username: string;
      avatar_url: string | null;
      person: { full_name: string; name_alt: string | null } | Array<{ full_name: string; name_alt: string | null }> | null;
    }>
  | null;

function flattenSender(raw: SenderJoin) {
  const s = Array.isArray(raw) ? raw[0] ?? null : raw;
  if (!s) return null;
  const person = Array.isArray(s.person) ? s.person[0] ?? null : s.person;
  return { id: s.id, username: s.username, avatar_url: s.avatar_url, full_name: person?.full_name ?? null, name_alt: person?.name_alt ?? null };
}

/* ── Self-healing: a notification for work that is already finished ─────────
   The fixes in /api/todos only help NEW activity. Every assignment written
   before them is still sitting unread for a task that was completed — or
   deleted — long ago, which is exactly what the owner sees: "I already mark
   all of tasks as done, nothing left, but it still have notifications."

   A one-off SQL backfill would clear today's pile and leave the next one, and
   it needs someone to run it against production. Reconciling here instead
   means the count corrects itself the moment anyone loads the Hub, for every
   user, with no migration.

   Cost is one extra query, and only when unread assignments actually exist:
   read their todo ids, ask which of those are still open, mark the rest read.
   Missing ids (deleted tasks) are stale by definition. Marked READ, never
   deleted — the message stays in the inbox history where it belongs. */
/* ── RETENTION — the inbox must not become an archive ──────────────────────
   2,010 rows had accumulated by the day the owner called the system broken;
   they were wiped once (scripts/reset-notifications.mts), and this keeps the
   table from growing back. A notification is a PROMPT, not a record — the
   audit log and each module's own history hold the records. Read messages
   older than 60 days and archived ones older than 30 are deleted whenever
   this account loads its full inbox. Scoped to the caller's own rows,
   fire-and-forget, and on the messages branch only — badge polls (the hot
   path, every account each minute) never pay for it. */
function pruneOldMessages(me: string): void {
  const readCutoff = new Date(Date.now() - 60 * 86400_000).toISOString();
  const archCutoff = new Date(Date.now() - 30 * 86400_000).toISOString();
  void supabaseServer.from(INBOX).delete()
    .eq("recipient_account_id", me).not("read_at", "is", null).lt("created_at", readCutoff)
    .then(({ error }) => { if (error) console.error("[inbox prune read]", error.message); });
  void supabaseServer.from(INBOX).delete()
    .eq("recipient_account_id", me).not("archived_at", "is", null).lt("archived_at", archCutoff)
    .then(({ error }) => { if (error) console.error("[inbox prune archived]", error.message); });
}

async function reconcileFinishedTaskNotifications(me: string): Promise<void> {
  try {
    const { data: pending } = await supabaseServer
      .from(INBOX)
      .select("id, metadata")
      .eq("recipient_account_id", me)
      .eq("category", "task")
      /* ⚠️ NO type filter — deliberately. This used to say
         `metadata->>type = todo_assignment`, and that one line was the
         owner's "the bell still doesn't work": his daily tasks are all
         RECURRING, whose rows carry type=todo_recurring, so finishing every
         task cleared nothing and the bell never went quiet on its own.
         Approval-decision rows had the same hole. Every task notification
         that names a todo_id reconciles against that todo, whatever its
         type. */
      .is("read_at", null)
      .is("archived_at", null)
      .limit(500);
    if (!pending?.length) return;

    const rows = pending as Array<{ id: string; metadata: { todo_id?: string } | null }>;
    const todoIds = [...new Set(rows.map((r) => r.metadata?.todo_id).filter(Boolean))] as string[];
    if (!todoIds.length) return;

    const { data: live } = await supabaseServer
      .from("koleex_todos")
      .select("id, status")
      .in("id", todoIds);
    const stillOpen = new Set(
      ((live ?? []) as Array<{ id: string; status: string | null }>)
        .filter((t) => t.status !== "done")
        .map((t) => t.id),
    );

    /* Only rows that NAME a todo can be verified against one; a task row
       without todo_id is left alone rather than guessed at. */
    const staleIds = rows
      .filter((r) => r.metadata?.todo_id && !stillOpen.has(r.metadata.todo_id))
      .map((r) => r.id);
    if (!staleIds.length) return;

    await supabaseServer
      .from(INBOX)
      .update({ read_at: new Date().toISOString() })
      .in("id", staleIds);
  } catch (e) {
    /* Never fail a badge read over housekeeping. */
    console.error("[api/inbox/feed] reconcile finished tasks:", e instanceof Error ? e.message : e);
  }
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
        /* Reconcile here too, so opening the list shows finished work as read
           rather than leaving the user to clear rows by hand. */
        await reconcileFinishedTaskNotifications(me);
        pruneOldMessages(me);
        const includeArchived = url.searchParams.get("archived") === "1";
        /* 300 cap serves the bell's "Show all" view — slim rows are ~200B
           each, so the worst case stays ~60KB. */
        const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 300);
        /* slim=1 — the badge/bell projection. The full shape ships the sender's
           avatar_url, and several accounts store base64 data-URIs there (25 KB
           for one user), repeated per row through the join: a limit=30 refresh
           measured 137 KB where the underlying rows average 364 BYTES. The
           bell never renders the avatar, and its subscription refetches this
           list on every broadcast ping × every subscriber (bell + home task
           badge). Slim drops avatar_url and trims metadata to the one key the
           sound classifier reads. The /inbox page keeps the full shape. */
        const slim = url.searchParams.get("slim") === "1";
        /* Widened to `string` on purpose: supabase-js parses literal select
           strings at the type level and rejects the slim projection. */
        const projection: string = slim
          ? `id, sender_account_id, category, subject, body, link, read_at, archived_at, created_at, metadata, sender:accounts!inbox_messages_sender_account_id_fkey ( id, username, person:people ( full_name, name_alt ) )`
          : `*, sender:accounts!inbox_messages_sender_account_id_fkey ( id, username, avatar_url, person:people ( full_name, name_alt ) )`;
        let q = supabaseServer
          .from(INBOX)
          .select(projection)
          .eq("recipient_account_id", me)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (!includeArchived) q = q.is("archived_at", null);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        const rows = ((data ?? []) as unknown as Array<Record<string, unknown> & { sender: SenderJoin }>).map((row) => {
          const { sender: _s, ...base } = row;
          void _s;
          if (slim) {
            const meta = base.metadata as { type?: unknown } | null;
            base.metadata = meta && typeof meta === "object" && meta.type != null ? { type: meta.type } : {};
          }
          const sender = flattenSender(row.sender);
          return { ...base, sender: sender ? { ...sender, avatar_url: sender.avatar_url ?? null } : null };
        });
        return NextResponse.json({ ok: true, data: rows });
      }

      case "unread": {
        await reconcileFinishedTaskNotifications(me);
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
        await reconcileFinishedTaskNotifications(me);
        const { count, error } = await supabaseServer
          .from(INBOX)
          .select("*", { count: "exact", head: true })
          .eq("recipient_account_id", me)
          .eq("category", "task")
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

      /* Both badge counts in ONE round trip.

         `unread` and `unreadTasks` are polled once a minute each, by every
         signed-in user, on every screen — together they were the two most
         called functional routes in production. They read the same table
         with the same scope, so asking twice bought nothing but a second
         border crossing for users in China. The two counts still exist
         separately above for callers that need only one. */
      case "badges": {
        await reconcileFinishedTaskNotifications(me);
        const base = () => supabaseServer
          .from(INBOX)
          .select("*", { count: "exact", head: true })
          .eq("recipient_account_id", me)
          .is("read_at", null)
          .is("archived_at", null);
        const [unreadRes, tasksRes] = await Promise.all([
          base(),
          /* All task categories — the type filter here undercounted for the
             same reason the reconcile under-cleared (recurring + approval
             rows are tasks too). */
          base().eq("category", "task"),
        ]);
        if (unreadRes.error) throw new Error(unreadRes.error.message);
        if (tasksRes.error) throw new Error(tasksRes.error.message);
        return NextResponse.json(
          { ok: true, data: { unread: unreadRes.count ?? 0, unreadTasks: tasksRes.count ?? 0 } },
          { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" } },
        );
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
