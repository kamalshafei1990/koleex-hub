import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET    /api/notes/[id] — full note including body_json
   PATCH  /api/notes/[id] — update any fields
   DELETE /api/notes/[id] — SOFT delete (move to Recently Deleted).
                            Use /purge to permanently remove. */

async function ownsNote(id: string, accountId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("notes")
    .select("id")
    .eq("id", id)
    .eq("account_id", accountId)
    .maybeSingle();
  return data !== null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("notes")
    .select("*")
    .eq("id", id)
    .eq("account_id", auth.account_id)
    .maybeSingle();

  if (error) {
    console.error("[api/notes/[id] GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ note: data });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  if (!(await ownsNote(id, auth.account_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patch = (await req.json()) as Record<string, unknown>;
  delete patch.id;
  delete patch.account_id;
  delete patch.tenant_id;
  delete patch.created_at;

  const { data, error } = await supabaseServer
    .from("notes")
    .update(patch)
    .eq("id", id)
    .select("id, updated_at")
    .single();
  if (error) {
    console.error("[api/notes/[id] PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, updated_at: data.updated_at });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  if (!(await ownsNote(id, auth.account_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Soft delete — sets deleted_at. Use /purge to permanently remove.
  const { error } = await supabaseServer
    .from("notes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[api/notes/[id] DELETE]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
