import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";

/* GET  /api/todo-labels     — list label catalogue (tenant-scoped)
   POST /api/todo-labels     — create a new label
     Body: { name (1–60 chars), color? ("#rgb" / "#rrggbb") }
     409 when the name is already taken (the catalogue's name is unique). */

const LABEL_COLS = "id, name, color, tenant_id, created_at";
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "To-do");
  if (deny) return deny;

  let query = supabaseServer
    .from("koleex_todo_labels")
    .select(LABEL_COLS)
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
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "To-do", "create");
  if (deny) return deny;

  let body: { name?: unknown; color?: unknown };
  try {
    body = ((await req.json()) ?? {}) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (name.length > 60) return NextResponse.json({ error: "Name is too long" }, { status: 400 });
  const color = body.color == null || body.color === "" ? null : body.color;
  if (color !== null && (typeof color !== "string" || !HEX_COLOR.test(color))) {
    return NextResponse.json({ error: "Invalid color" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("koleex_todo_labels")
    .insert({ name, color, tenant_id: auth.tenant_id })
    .select(LABEL_COLS)
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A label with this name already exists" }, { status: 409 });
    }
    console.error("[api/todo-labels POST]", error.message);
    return NextResponse.json({ error: "Failed to create label" }, { status: 500 });
  }
  return NextResponse.json({ label: data });
}
