import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/inbox/mutate — RLS realtime-lockdown P2.

   Gates every WRITE to inbox_messages so the table's public policy can be
   downgraded from `FOR ALL` to `SELECT`-only (closing the hole where the anon
   key could forge / delete / mark-read anyone's notifications cross-tenant).

   Identity is ALWAYS the signed-in session account — never client-supplied:
     · read-state changes (markRead/markUnread/archive/markAllRead) only ever
       touch rows where recipient_account_id = the caller.
     · send / broadcast / notify stamp sender_account_id = the caller.

   Reads stay on the (still public) SELECT path for the notification bell's
   realtime until P3; those are recipient-filtered client-side already.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

const INBOX = "inbox_messages";

type Body =
  | { action: "markRead" | "markUnread" | "archive"; id: string }
  | { action: "markAllRead" }
  | { action: "send"; recipientId: string; subject: string; body: string; link?: string | null; metadata?: Record<string, unknown> }
  | { action: "broadcastToRole"; roleName: string; subject: string; body: string; link?: string | null; excludeSelf?: boolean; metadata?: Record<string, unknown> }
  | { action: "notify"; recipientIds: string[]; subject: string; body: string; link?: string | null; category?: string; metadata?: Record<string, unknown> };

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const me = auth.account_id;

  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    switch (body.action) {
      case "markRead":
      case "markUnread":
      case "archive": {
        if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const patch =
          body.action === "markRead" ? { read_at: new Date().toISOString() }
          : body.action === "markUnread" ? { read_at: null }
          : { archived_at: new Date().toISOString() };
        /* Recipient-scoped: you can only change the state of YOUR OWN inbox. */
        const { error } = await supabaseServer
          .from(INBOX).update(patch)
          .eq("id", body.id)
          .eq("recipient_account_id", me);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }

      case "markAllRead": {
        const { error } = await supabaseServer
          .from(INBOX)
          .update({ read_at: new Date().toISOString() })
          .eq("recipient_account_id", me)
          .is("read_at", null);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }

      case "send": {
        if (!body.recipientId || !body.subject) return NextResponse.json({ error: "recipientId + subject required" }, { status: 400 });
        const { data, error } = await supabaseServer
          .from(INBOX)
          .insert({
            recipient_account_id: body.recipientId,
            sender_account_id: me,
            category: "message",
            subject: body.subject,
            body: body.body,
            link: body.link ?? null,
            metadata: body.metadata ?? {},
          })
          .select("*")
          .single();
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true, message: data });
      }

      case "broadcastToRole": {
        if (!body.roleName || !body.subject) return NextResponse.json({ error: "roleName + subject required" }, { status: 400 });
        /* Resolve recipients server-side (tenant-scoped) — the client never
           supplies the recipient list. */
        const { data: recipients, error: recErr } = await supabaseServer
          .from("accounts")
          .select("id, role:roles(id,name)")
          .eq("status", "active")
          .eq("tenant_id", auth.tenant_id);
        if (recErr) throw new Error(recErr.message);
        const target = (recipients ?? []).filter((row) => {
          const r = row as { id: string; role: { name?: string } | Array<{ name?: string }> | null };
          const role = Array.isArray(r.role) ? r.role[0] : r.role;
          if (!role?.name) return false;
          if (body.excludeSelf && r.id === me) return false;
          return role.name.toLowerCase() === body.roleName.toLowerCase();
        });
        if (target.length === 0) return NextResponse.json({ ok: true, count: 0 });
        const rows = target.map((row) => ({
          recipient_account_id: (row as { id: string }).id,
          sender_account_id: me,
          category: "message" as const,
          subject: body.subject,
          body: body.body,
          link: body.link ?? null,
          metadata: body.metadata ?? {},
        }));
        const { error: insErr } = await supabaseServer.from(INBOX).insert(rows);
        if (insErr) throw new Error(insErr.message);
        return NextResponse.json({ ok: true, count: rows.length });
      }

      case "notify": {
        /* Fan-out used by todo assignment etc. Sender = caller; recipients as
           given (dedup, drop self). */
        const ids = Array.from(new Set((body.recipientIds ?? []).filter(Boolean))).filter((id) => id !== me);
        if (ids.length === 0) return NextResponse.json({ ok: true, count: 0 });
        const rows = ids.map((rid) => ({
          recipient_account_id: rid,
          sender_account_id: me,
          category: body.category ?? "task",
          subject: body.subject,
          body: body.body,
          link: body.link ?? null,
          metadata: body.metadata ?? {},
        }));
        const { error } = await supabaseServer.from(INBOX).insert(rows);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true, count: rows.length });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Inbox mutation failed";
    console.error("[api/inbox/mutate]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
