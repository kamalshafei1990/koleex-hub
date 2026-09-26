import "server-only";

/* DELETE /api/me/hr/leave/[id] — withdraw MY OWN request while it is still
   pending. The row is kept and marked `cancelled` (history, not erasure);
   anything already reviewed is HR's to change. The employee filter on the
   UPDATE is what stops one employee cancelling another's — the id in the URL
   is never trusted alone. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { resolveMyEmployee } from "@/lib/server/me-hr";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const me = await resolveMyEmployee(auth);
  if (!me) return NextResponse.json({ error: "not_employee" }, { status: 404 });

  const { id } = await ctx.params;
  const { data, error } = await supabaseServer.from("hr_leave_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id).eq("employee_id", me.id).eq("status", "pending")
    .select("id").maybeSingle();
  if (error) {
    console.error("[api/me/hr/leave DELETE]", error.message);
    return NextResponse.json({ error: "Could not cancel." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "not_pending" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
