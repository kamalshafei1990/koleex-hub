import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;
  const { id } = await params;

  const { data, error } = await supabaseServer
    .from("project_time_entries")
    .select(`*, account:account_id ( id, username )`)
    .eq("task_id", id)
    .eq("tenant_id", auth.tenant_id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id } = await params;

  const body = (await req.json()) as { minutes?: number; entry_date?: string; note?: string };
  const minutes = Math.max(0, Math.round(Number(body.minutes) || 0));
  if (!minutes) return NextResponse.json({ error: "Minutes required" }, { status: 400 });

  // Resolve the task's project so the entry is also project-scoped.
  const { data: task } = await supabaseServer
    .from("project_tasks")
    .select("project_id")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const { data, error } = await supabaseServer
    .from("project_time_entries")
    .insert({
      tenant_id: auth.tenant_id,
      project_id: task.project_id,
      task_id: id,
      account_id: auth.account_id,
      minutes,
      entry_date: body.entry_date || new Date().toISOString().slice(0, 10),
      note: body.note?.trim()?.slice(0, 500) || null,
    })
    .select(`*, account:account_id ( id, username )`)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Keep the task's logged_hours total in sync (best-effort).
  const { data: agg } = await supabaseServer
    .from("project_time_entries")
    .select("minutes")
    .eq("task_id", id)
    .eq("tenant_id", auth.tenant_id);
  const totalHours = (agg ?? []).reduce((s, r) => s + (r.minutes as number), 0) / 60;
  void supabaseServer.from("project_tasks").update({ logged_hours: Math.round(totalHours * 100) / 100 }).eq("id", id).eq("tenant_id", auth.tenant_id);

  return NextResponse.json({ entry: data });
}
