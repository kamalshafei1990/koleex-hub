import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { assertTaskAccess } from "@/lib/server/project-access";
import { recomputeLoggedHours } from "@/lib/server/project-time";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertTaskAccess(auth, id);
  if (gate instanceof NextResponse) return gate;

  const { data, error } = await supabaseServer
    .from("project_time_entries")
    .select(`*, account:account_id ( id, username )`)
    .eq("task_id", id)
    .eq("tenant_id", auth.tenant_id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[api/projects/tasks/:id/time GET]", error.message);
    return NextResponse.json({ error: "Failed to load time entries" }, { status: 500 });
  }
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertTaskAccess(auth, id);
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => ({}))) as { minutes?: number; entry_date?: string; note?: string };
  const minutes = Math.max(0, Math.round(Number(body.minutes) || 0));
  if (!minutes || minutes > 24 * 60) return NextResponse.json({ error: "Minutes required (max 24h)" }, { status: 400 });
  const entryDate = typeof body.entry_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.entry_date)
    ? body.entry_date
    : new Date().toISOString().slice(0, 10); // client sends its LOCAL date; this is only a fallback

  const { data, error } = await supabaseServer
    .from("project_time_entries")
    .insert({
      tenant_id: auth.tenant_id,
      project_id: gate.task.project_id,
      task_id: id,
      account_id: auth.account_id,
      minutes,
      entry_date: entryDate,
      note: typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null,
    })
    .select(`*, account:account_id ( id, username )`)
    .single();
  if (error) {
    console.error("[api/projects/tasks/:id/time POST]", error.message);
    return NextResponse.json({ error: "Failed to log time" }, { status: 500 });
  }

  /* logged_hours = Σ minutes / 60 over this task's entries. Awaited — the
     old `void builder` never ran (query builders are lazy). */
  const logged_hours = await recomputeLoggedHours(auth.tenant_id, id);
  return NextResponse.json({ entry: data, logged_hours });
}
