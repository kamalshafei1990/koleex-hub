import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { NOTE_LIMITS } from "@/lib/notes-policy";
import { folderWouldCycle, isUuid, ownsFolder } from "@/lib/notes-server";

/* PATCH  /api/notes/folders/[id] — rename / move / reorder. Whitelisted
                                     fields only; a new parent must be the
                                     caller's own folder and must not create
                                     a cycle.
   DELETE /api/notes/folders/[id] — delete folder (notes inside get folder_id=null
                                     via the DB FK's ON DELETE SET NULL) */

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Notes", "edit");
  if (deny) return deny;

  if (!(await ownsFolder(id, auth.account_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try { body = ((await req.json()) ?? {}) as Record<string, unknown>; } catch { /* empty */ }

  const patch: Record<string, unknown> = {};
  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > NOTE_LIMITS.folderName) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    patch.name = name;
  }
  if ("icon" in body) {
    const icon = body.icon;
    if (icon !== null && (typeof icon !== "string" || icon.length > NOTE_LIMITS.folderIcon)) {
      return NextResponse.json({ error: "Invalid icon" }, { status: 400 });
    }
    patch.icon = icon;
  }
  if ("sort_order" in body) {
    if (!Number.isInteger(body.sort_order)) {
      return NextResponse.json({ error: "Invalid sort order" }, { status: 400 });
    }
    patch.sort_order = body.sort_order;
  }
  if ("parent_id" in body) {
    const parentId = body.parent_id;
    if (parentId !== null) {
      if (!isUuid(parentId) || !(await ownsFolder(parentId, auth.account_id))) {
        return NextResponse.json({ error: "Parent folder not found" }, { status: 400 });
      }
      if (await folderWouldCycle(auth.account_id, id, parentId)) {
        return NextResponse.json({ error: "A folder cannot be moved inside itself" }, { status: 400 });
      }
    }
    patch.parent_id = parentId;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  const { error } = await supabaseServer
    .from("notes_folders")
    .update(patch)
    .eq("id", id)
    .eq("account_id", auth.account_id);
  if (error) {
    console.error("[api/notes/folders/[id] PATCH]", error.message);
    return NextResponse.json({ error: "Failed to update folder" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Notes", "delete");
  if (deny) return deny;

  if (!(await ownsFolder(id, auth.account_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabaseServer
    .from("notes_folders")
    .delete()
    .eq("id", id)
    .eq("account_id", auth.account_id);
  if (error) {
    console.error("[api/notes/folders/[id] DELETE]", error.message);
    return NextResponse.json({ error: "Failed to delete folder" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
