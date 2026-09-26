import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { assertTaskWrite, canModerate } from "@/lib/server/project-access";
import { recomputeLoggedHours } from "@/lib/server/project-time";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string; tid: string }> };

/* DELETE — only the entry's author, the project manager or a super admin,
   and never an entry that has already been billed (invoiced_invoice_id set):
   deleting it would silently change an issued invoice's backing time. */
export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id, tid } = await params;
  const gate = await assertTaskWrite(auth, id);
  if (gate instanceof NextResponse) return gate;

  const { data: entry } = await supabaseServer
    .from("project_time_entries")
    .select("id, account_id, invoiced_invoice_id")
    .eq("id", tid)
    .eq("task_id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (entry.account_id !== auth.account_id && !canModerate(auth, gate.project)) {
    return NextResponse.json({ error: "Only the author or the project manager can delete this entry" }, { status: 403 });
  }
  if (entry.invoiced_invoice_id) {
    return NextResponse.json({ error: "This time has already been invoiced and cannot be deleted" }, { status: 409 });
  }

  const { error } = await supabaseServer
    .from("project_time_entries")
    .delete()
    .eq("id", tid)
    .eq("task_id", id)
    .eq("tenant_id", auth.tenant_id)
    .is("invoiced_invoice_id", null);
  if (error) {
    console.error("[api/projects/tasks/:id/time/:tid DELETE]", error.message);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }

  const logged_hours = await recomputeLoggedHours(auth.tenant_id, id);
  return NextResponse.json({ ok: true, logged_hours });
}
