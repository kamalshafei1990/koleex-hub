import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import {
  canRead,
  canWrite,
  getNoteAccess,
  ownsFolder,
  validateNoteInput,
} from "@/lib/notes-server";

/* GET    /api/notes/[id] — full note including body_json. Owner OR anyone the
                            note is shared with (view/edit) may read; a trashed
                            note is owner-only.
   PATCH  /api/notes/[id] — owner: whitelisted fields. Shared editor: content
                            only. Optimistic concurrency: when the body carries
                            `base_updated_at`, the write only lands if the row
                            still has that updated_at; otherwise 409 + the
                            fresh note so the client can reload it.
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

  // One parallel round-trip: the full row + its shares → role.
  const access = await getNoteAccess(id, auth.account_id, "*");
  if (!access.note || !canRead(access.role)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    note: { ...access.note, is_shared: access.shares.length > 0 },
    role: access.role,
  });
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

  const access = await getNoteAccess(id, auth.account_id, "updated_at");
  if (!access.note || !canWrite(access.role)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let incoming: unknown;
  try { incoming = await req.json(); } catch { incoming = null; }
  const v = validateNoteInput(incoming, access.role === "owner" ? "owner" : "editor");
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const patch: Record<string, unknown> = { ...v.value };
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, updated_at: (access.note as { updated_at?: string }).updated_at ?? null });
  }

  if (typeof patch.folder_id === "string" && !(await ownsFolder(patch.folder_id, auth.account_id))) {
    return NextResponse.json({ error: "Folder not found" }, { status: 400 });
  }

  const base =
    incoming && typeof incoming === "object" && typeof (incoming as { base_updated_at?: unknown }).base_updated_at === "string"
      ? ((incoming as { base_updated_at: string }).base_updated_at)
      : null;

  /* Only a CONTENT change moves updated_at (the concurrency token and the
     list's recency sort). Organising a note — pin, move to a folder — must
     not make a collaborator's next save look like a conflict. */
  const isContent = ["title", "body_json", "color", "tags"].some((k) => k in patch);
  if (isContent) patch.updated_at = new Date().toISOString();

  let q = supabaseServer.from("notes").update(patch).eq("id", id);
  if (base && isContent) q = q.eq("updated_at", base);
  const { data, error } = await q.select("id, updated_at");
  if (error) {
    console.error("[api/notes/[id] PATCH]", error.message);
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }
  const row = (data ?? [])[0] as { updated_at: string } | undefined;
  if (!row) {
    // The row moved on since the client's base: hand back the fresh copy.
    const fresh = await getNoteAccess(id, auth.account_id, "*");
    if (!fresh.note || !canRead(fresh.role)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: "conflict",
        note: { ...fresh.note, is_shared: fresh.shares.length > 0 },
        role: fresh.role,
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, updated_at: row.updated_at });
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

  const access = await getNoteAccess(id, auth.account_id);
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
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
