import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/inbox/feed — RLS realtime-lockdown P3-D.

   Gated READ path for inbox_messages so its last public policy (SELECT) can be
   dropped (service_role only). Every read is recipient-scoped to the signed-in
   session account — never a client-supplied id:

     · messages[&archived=1][&limit=]  → the caller's inbox (+ sender join)
     · badges                          → { unread, unreadTasks } in one trip

   Freshness is driven by server Broadcast pings on inbox:account:<id> (see
   /api/inbox/mutate + realtime-broadcast.ts), not anon postgres_changes.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { notificationTypeDef } from "@/lib/notification-types";

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
            /* Keep `kind` as well as `type`. The trim exists to drop fat
               payloads, not classification: classifyInboxActivity types a row
               from EITHER key, because person-targeted notifications write
               metadata.type while notifySuperAdmins writes metadata.kind
               ("new_device", audit actions…). Keeping only `type` stripped
               every super-admin alert down to {} before it reached the
               client — measured on the live inbox, 101 of 106 messages — so
               the bell could not type them: its filter row showed nothing but
               "All", the Security chip never appeared, and those rows took
               the default chime. Two keys, both short strings. */
            /* …and `tpl`: the template the bell renders in the reader's
               language (lib/notification-templates) — a key and a few short
               values, never a payload. */
            const meta = base.metadata as { type?: unknown; kind?: unknown; tpl?: unknown } | null;
            if (meta && typeof meta === "object") {
              const trimmed: Record<string, unknown> = {};
              if (meta.type != null) trimmed.type = meta.type;
              if (meta.kind != null) trimmed.kind = meta.kind;
              if (meta.tpl != null) trimmed.tpl = meta.tpl;
              base.metadata = trimmed;
            } else {
              base.metadata = {};
            }
          }
          const sender = flattenSender(row.sender);
          return { ...base, sender: sender ? { ...sender, avatar_url: sender.avatar_url ?? null } : null };
        });
        return NextResponse.json({ ok: true, data: rows });
      }

      /* Both badge counts in ONE round trip.

         They used to be two resources (`unread`, `unreadTasks`), polled once
         a minute each by every signed-in user on every screen — together the
         two most called functional routes in production, reading the same
         table with the same scope. Every caller moved to this one; the
         separate resources were retired once nothing asked for them. */
      case "badges": {
        await reconcileFinishedTaskNotifications(me);
        const base = () => supabaseServer
          .from(INBOX)
          .select("*", { count: "exact", head: true })
          .eq("recipient_account_id", me)
          .is("read_at", null)
          .is("archived_at", null);
        const [unreadRes, tasksRes, typesRes] = await Promise.all([
          base(),
          /* All task categories — the type filter here undercounted for the
             same reason the reconcile under-cleared (recurring + approval
             rows are tasks too). */
          base().eq("category", "task"),
          /* Each unread row's type only (two short strings), for the Home
             tiles' per-app numbers below. */
          supabaseServer
            .from(INBOX)
            .select("type:metadata->>type, kind:metadata->>kind")
            .eq("recipient_account_id", me)
            .is("read_at", null)
            .is("archived_at", null)
            .limit(1000),
        ]);
        if (unreadRes.error) throw new Error(unreadRes.error.message);
        if (tasksRes.error) throw new Error(tasksRes.error.message);
        /* Unread notifications per app — the number on each Home tile. The
           app is the registry's (lib/notification-types); security alerts
           are left out as the bell's All tab leaves them out: they have
           their own tab, and they are not work in an app. A failed read
           only loses the tiles' numbers, never the counts above. */
        const byApp: Record<string, number> = {};
        for (const r of (typesRes.data ?? []) as Array<{ type: string | null; kind: string | null }>) {
          const app = notificationTypeDef(r.type ?? r.kind)?.app;
          if (!app || app === "activity-monitor") continue;
          byApp[app] = (byApp[app] ?? 0) + 1;
        }
        return NextResponse.json(
          { ok: true, data: { unread: unreadRes.count ?? 0, unreadTasks: tasksRes.count ?? 0, byApp } },
          // Badge counts feed the home/header; a short SWR cache collapses the
          // repeated (realtime-triggered) refetches to one round-trip. Realtime
          // pings still refresh them; the count can lag a few seconds at most.
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
