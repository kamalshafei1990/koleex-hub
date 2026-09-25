import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/inbox/mutate — RLS realtime-lockdown P2.

   Gates every WRITE to inbox_messages so the table's public policy can be
   downgraded from `FOR ALL` to `SELECT`-only (closing the hole where the anon
   key could forge / delete / mark-read anyone's notifications cross-tenant).

   Identity is ALWAYS the signed-in session account — never client-supplied:
   read-state changes (markRead / markUnread / archive, one row or several)
   only ever touch rows where recipient_account_id = the caller.

   Nothing here SENDS. The send / broadcastToRole / notify actions served the
   Koleex Mail composer, retired 26/09/2026 with the mail itself — and
   `notify` let any signed-in account write a notification into ANY account,
   no tenant check. Notifications are written server-side by the Hub's own
   writers (lib/notification-types lists every one).

   Reads stay on the (still public) SELECT path for the notification bell's
   realtime until P3; those are recipient-filtered client-side already.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

const INBOX = "inbox_messages";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Body = { action: "markRead" | "markUnread" | "archive"; id?: string; ids?: string[] };

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
        /* One row (`id`) or several (`ids`: a folded group, a tab's "mark all
           read") — one request either way, never one per row. */
        const ids = Array.from(new Set(body.ids ?? (body.id ? [body.id] : [])));
        if (ids.length === 0) return NextResponse.json({ error: "id required" }, { status: 400 });
        if (ids.length > 500 || !ids.every((x) => typeof x === "string" && UUID.test(x))) {
          return NextResponse.json({ error: "invalid id" }, { status: 400 });
        }
        const patch =
          body.action === "markRead" ? { read_at: new Date().toISOString() }
          : body.action === "markUnread" ? { read_at: null }
          : { archived_at: new Date().toISOString() };
        /* Recipient-scoped: you can only change the state of YOUR OWN inbox.
           Chunked, so a long list never outgrows the request URL. */
        for (let i = 0; i < ids.length; i += 100) {
          const { error } = await supabaseServer
            .from(INBOX).update(patch)
            .in("id", ids.slice(i, i + 100))
            .eq("recipient_account_id", me);
          if (error) throw new Error(error.message);
        }
        return NextResponse.json({ ok: true });
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
