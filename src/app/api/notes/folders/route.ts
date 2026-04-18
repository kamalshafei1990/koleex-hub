import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET  /api/notes/folders — list all folders owned by the caller.
   POST /api/notes/folders — create a folder.

   Notes is a Type C (personal) module — every user owns their own
   folders. Super Admin can view others' only via a dedicated debug
   path (not exposed in the UI). */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("notes_folders")
    .select("*")
    .eq("account_id", auth.account_id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[api/notes/folders GET]", error.message);
    return NextResponse.json({ error: "Failed to load folders" }, { status: 500 });
  }
  return NextResponse.json({ folders: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  const body = (await req.json()) as {
    name: string;
    parent_id?: string | null;
    icon?: string | null;
    sort_order?: number;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const row = {
    tenant_id: auth.tenant_id,
    account_id: auth.account_id,
    name: body.name.trim(),
    parent_id: body.parent_id ?? null,
    icon: body.icon ?? null,
    sort_order: body.sort_order ?? 0,
  };

  const { data, error } = await supabaseServer
    .from("notes_folders")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    console.error("[api/notes/folders POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ folder: data });
}
