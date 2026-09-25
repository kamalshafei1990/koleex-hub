import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { canRead, canWrite, getNoteAccess } from "@/lib/notes-server";
import { snapshotVersion } from "@/lib/notes-history-server";
import { NOTE_LIMITS } from "@/lib/notes-policy";

/* GET  /api/notes/[id]/versions — version history (newest first, no bodies).
                                   Anyone who can read the note.
   POST /api/notes/[id]/versions — "Save version": snapshot the note as it is
                                   stored now (no 10-minute throttle). Anyone
                                   who can edit. Also used before a restore.
   Answers { available: false } until migration 20260926 creates the table. */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  const access = await getNoteAccess(id, auth.account_id);
  if (!access.note || !canRead(access.role)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabaseServer
    .from("note_versions")
    .select("id, title, account_id, created_at")
    .eq("note_id", id)
    .order("created_at", { ascending: false })
    .limit(NOTE_LIMITS.versions);
  if (error) return NextResponse.json({ available: false, versions: [] });

  const rows = (data ?? []) as Array<{ id: string; title: string; account_id: string | null; created_at: string }>;
  const ids = Array.from(new Set(rows.map((r) => r.account_id).filter(Boolean))) as string[];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: accts } = await supabaseServer.from("accounts").select("id, username").in("id", ids);
    for (const a of (accts ?? []) as Array<{ id: string; username: string | null }>) {
      if (a.username) names.set(a.id, a.username);
    }
  }
  return NextResponse.json({
    available: true,
    versions: rows.map((r) => ({ ...r, author_name: r.account_id ? names.get(r.account_id) ?? null : null })),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Notes", "edit");
  if (deny) return deny;

  const access = await getNoteAccess<{ title: string; body_json: unknown }>(id, auth.account_id, "title, body_json");
  if (!access.note || !canWrite(access.role) || access.note.deleted_at) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const res = await snapshotVersion({
    noteId: id,
    tenantId: access.note.tenant_id,
    accountId: auth.account_id,
    title: access.note.title ?? "",
    bodyJson: access.note.body_json,
    force: true,
  });
  if (!res.ok) return NextResponse.json({ error: "Version history is unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true, id: res.id ?? null });
}
