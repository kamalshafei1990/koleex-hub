import "server-only";

/* POST /api/support/requests/[id]/resolve — "handled" on a sign-in help request.

   The "Having trouble?" form (api/support/sign-in-help) files a row in
   support_requests and sends every admin a copy in their bell. Nothing in
   the Hub could say the request had been dealt with, so the copies stayed
   unread in every admin's bell for good — the last notification type with no
   end (owner, 26/09/2026). This is that end: whoever handles it marks it
   here (the notification's own button), the row records who and when, and
   every admin's unread copy goes away at once.

   Who may: exactly who receives it — isReviewer is the same predicate as the
   fan-out (lib/server/admin-recipients). Idempotent: a request already
   handled answers 409, and any copy still unread is cleared anyway. */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { isReviewer } from "@/lib/server/admin-recipients";
import { clearUnreadByMeta } from "@/lib/server/inbox-lifecycle";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Unknown request." }, { status: 404 });
  if (!(await isReviewer(auth.account_id))) {
    return NextResponse.json({ error: "Only the admins who receive sign-in help requests can close them." }, { status: 403 });
  }

  /* Claim, then apply: only an open request moves, so two admins pressing at
     once cannot both "handle" it. */
  const { data, error } = await supabaseServer
    .from("support_requests")
    .update({ status: "resolved", handled_by: auth.account_id, handled_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["open", "in_progress"])
    .select("id, ref");
  if (error) {
    console.error("[api/support/requests/resolve]", error.message);
    return NextResponse.json({ error: "Could not update the request." }, { status: 500 });
  }

  /* Handled now or before: no admin should still see it as waiting. */
  await clearUnreadByMeta({ type: "support_request", support_request_id: id });

  if (!data || data.length === 0) {
    const { data: row } = await supabaseServer.from("support_requests").select("id").eq("id", id).maybeSingle();
    return row
      ? NextResponse.json({ error: "already_decided" }, { status: 409 })
      : NextResponse.json({ error: "Unknown request." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ref: (data[0] as { ref: string }).ref });
}
