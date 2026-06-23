import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { getNoteRole, canRead, canWrite, SHARED_EDITOR_FIELDS } from "@/lib/server/note-access";

/* GET    /api/notes/[id] — full note including body_json. Owner OR anyone the
                            note is shared with (view/edit) may read.
   PATCH  /api/notes/[id] — owner: any field. Shared editor: content only.
   DELETE /api/notes/[id] — owner only. Soft delete (Recently Deleted). */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  const access = await getNoteRole(id, auth.account_id);
  if (!canRead(access.role)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabaseServer
    .from("notes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[api/notes/[id] GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ note: data, role: access.role });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Notes", "edit");
  if (deny) return deny;

  const access = await getNoteRole(id, auth.account_id);
  if (!canWrite(access.role)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const incoming = (await req.json()) as Record<string, unknown>;
  delete incoming.id;
  delete incoming.account_id;
  delete incoming.tenant_id;
  delete incoming.created_at;
  delete incoming.deleted_at;

  // A shared editor may only change CONTENT — never the owner's folder /
  // pin / lock state. The owner keeps full control.
  let patch = incoming;
  if (access.role !== "owner") {
    patch = {};
    for (const k of SHARED_EDITOR_FIELDS) {
      if (k in incoming) patch[k] = incoming[k];
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: true });
    }
  }

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
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Notes", "delete");
  if (deny) return deny;

  const access = await getNoteRole(id, auth.account_id);
  if (access.role !== "owner") {
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
