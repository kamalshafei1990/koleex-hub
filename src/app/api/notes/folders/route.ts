import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { NOTE_LIMITS } from "@/lib/notes-policy";
import { isUuid, ownsFolder } from "@/lib/notes-server";

/* GET  /api/notes/folders — list all folders owned by the caller, plus the
                             number of live notes in each (`counts`), so the
                             sidebar shows real totals rather than counting
                             whatever list happens to be on screen.
   POST /api/notes/folders — create a folder.

   Notes is a Type C (personal) module — every user owns their own
   folders. */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  const [foldersRes, notesRes] = await Promise.all([
    supabaseServer
      .from("notes_folders")
      .select("*")
      .eq("account_id", auth.account_id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabaseServer
      .from("notes")
      .select("folder_id")
      .eq("account_id", auth.account_id)
      .is("deleted_at", null)
      .not("folder_id", "is", null),
  ]);

  if (foldersRes.error) {
    console.error("[api/notes/folders GET]", foldersRes.error.message);
    return NextResponse.json({ error: "Failed to load folders" }, { status: 500 });
  }
  const counts: Record<string, number> = {};
  for (const n of (notesRes.data ?? []) as Array<{ folder_id: string | null }>) {
    if (n.folder_id) counts[n.folder_id] = (counts[n.folder_id] ?? 0) + 1;
  }
  return NextResponse.json({ folders: foldersRes.data ?? [], counts });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Notes", "create");
  if (deny) return deny;

  let body: Record<string, unknown> = {};
  try { body = ((await req.json()) ?? {}) as Record<string, unknown>; } catch { /* empty */ }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (name.length > NOTE_LIMITS.folderName) {
    return NextResponse.json({ error: "Name is too long" }, { status: 400 });
  }
  const parentId = body.parent_id ?? null;
  if (parentId !== null && (!isUuid(parentId) || !(await ownsFolder(parentId, auth.account_id)))) {
    return NextResponse.json({ error: "Parent folder not found" }, { status: 400 });
  }
  const icon = body.icon ?? null;
  if (icon !== null && (typeof icon !== "string" || icon.length > NOTE_LIMITS.folderIcon)) {
    return NextResponse.json({ error: "Invalid icon" }, { status: 400 });
  }
  const sortOrder = Number.isInteger(body.sort_order) ? (body.sort_order as number) : 0;

  const row = {
    tenant_id: auth.tenant_id,
    account_id: auth.account_id,
    name,
    parent_id: parentId as string | null,
    icon: icon as string | null,
    sort_order: sortOrder,
  };

  const { data, error } = await supabaseServer
    .from("notes_folders")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    console.error("[api/notes/folders POST]", error.message);
    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 });
  }
  return NextResponse.json({ folder: data });
}
