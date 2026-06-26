import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string; tid: string }> };

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id, tid } = await params;

  const { error } = await supabaseServer
    .from("project_time_entries")
    .delete()
    .eq("id", tid)
    .eq("task_id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Re-sync logged_hours total after removal.
  const { data: agg } = await supabaseServer
    .from("project_time_entries")
    .select("minutes")
    .eq("task_id", id)
    .eq("tenant_id", auth.tenant_id);
  const totalHours = (agg ?? []).reduce((s, r) => s + (r.minutes as number), 0) / 60;
  void supabaseServer.from("project_tasks").update({ logged_hours: Math.round(totalHours * 100) / 100 }).eq("id", id).eq("tenant_id", auth.tenant_id);

  return NextResponse.json({ ok: true });
}
