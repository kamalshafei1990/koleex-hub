import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET  /api/todo-labels     — list label catalogue (tenant-scoped)
   POST /api/todo-labels     — create a new label */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "To-do");
  if (deny) return deny;

  let query = supabaseServer
    .from("koleex_todo_labels")
    .select("*")
    .order("name");
  if (auth.tenant_id) query = query.eq("tenant_id", auth.tenant_id);

  const { data, error } = await query;
  if (error) {
    console.error("[api/todo-labels GET]", error.message);
    return NextResponse.json({ error: "Failed to load labels" }, { status: 500 });
  }
  return NextResponse.json({ labels: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "To-do");
  if (deny) return deny;

  const body = (await req.json()) as { name: string; color?: string | null };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("koleex_todo_labels")
    .insert({
      name: body.name,
      color: body.color ?? null,
      tenant_id: auth.tenant_id,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[api/todo-labels POST]", error.message);
    return NextResponse.json({ error: "Failed to create label" }, { status: 500 });
  }
  return NextResponse.json({ label: data });
}
