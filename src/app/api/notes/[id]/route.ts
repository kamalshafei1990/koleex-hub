import "server-only";

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import {
  canRead,
  canWrite,
  getNoteAccess,
  ownsFolder,
  validateNoteInput,
} from "@/lib/notes-server";
import { extractPlainText } from "@/lib/notes-text";
import { NOTE_LIMITS } from "@/lib/notes-policy";
import { mergeState, notesCollabAvailable } from "@/lib/notes-yjs-server";
import { afterContentSaved } from "@/lib/notes-history-server";

/* GET    /api/notes/[id] — full note including body_json. Owner OR anyone the
                            note is shared with (view/edit) may read; a trashed
                            note is owner-only.
   PATCH  /api/notes/[id] — owner: whitelisted fields. Shared editor: content
                            only. Optimistic concurrency: when the body carries
                            `base_updated_at`, the write only lands if the row
                            still has that updated_at; otherwise 409 + the
                            fresh note so the client can reload it.
                            COLLABORATIVE save (shared note, Yjs): the body
                            carries `yjs_update` (the client's full Yjs
                            state, base64) instead of body_json. It is MERGED
                            into the stored state and body_json/body_plain
                            are derived from the merge — a merge cannot
                            conflict, so no base token and no 409.
                            Every landed content save then (after the
                            response) snapshots a version (≤ 1 / 10 min) and
                            refreshes the note's outgoing links.
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
  // The Yjs state is served only by /collab (it can be large).
  const { yjs_state: _yjs, ...note } = access.note as Record<string, unknown>;
  void _yjs;

  // "Shared with me" unread badge: a sharee opening the note marks it read.
  // Best-effort — the column arrives with migration 20260926.
  if (access.role === "viewer" || access.role === "editor") {
    after(async () => {
      await supabaseServer
        .from("note_shares")
        .update({ last_opened_at: new Date().toISOString() })
        .eq("note_id", id)
        .eq("shared_with_account_id", auth.account_id)
        .is("last_opened_at", null);
    });
  }

  return NextResponse.json({
    note: { ...note, is_shared: access.shares.length > 0 },
    role: access.role,
  });
}

/** Collaborative save: merge the client's Yjs state, derive the body. */
async function collabPatch(
  id: string,
  update: string,
  fields: Record<string, unknown>,
  ctx: { tenantId: string; accountId: string },
): Promise<NextResponse> {
  if (!(await notesCollabAvailable())) {
    return NextResponse.json({ error: "Collaboration unavailable" }, { status: 400 });
  }
  // Optimistic loop: read → merge → write only if nobody wrote in between.
  // A lost race just re-merges (merges commute), so nothing is ever lost.
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: cur, error: readErr } = await supabaseServer
      .from("notes")
      .select("yjs_state, updated_at, title")
      .eq("id", id)
      .maybeSingle();
    if (readErr || !cur) {
      console.error("[api/notes/[id] PATCH collab read]", readErr?.message);
      return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
    }
    const row = cur as { yjs_state: string | null; updated_at: string; title: string };
    const merged = mergeState(row.yjs_state, update);
    if (!merged.ok) return NextResponse.json({ error: merged.error }, { status: 400 });
    if (JSON.stringify(merged.bodyJson).length > NOTE_LIMITS.bodyJsonBytes) {
      return NextResponse.json({ error: "Note is too large" }, { status: 400 });
    }
    const body_plain = extractPlainText(merged.bodyJson);
    const patch = {
      ...fields,
      body_json: merged.bodyJson,
      body_plain,
      yjs_state: merged.state,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabaseServer
      .from("notes")
      .update(patch)
      .eq("id", id)
      .eq("updated_at", row.updated_at)
      .select("id, updated_at, title");
    if (error) {
      console.error("[api/notes/[id] PATCH collab]", error.message);
      return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
    }
    const saved = (data ?? [])[0] as { updated_at: string; title: string } | undefined;
    if (!saved) continue; // someone saved in between — merge again
    after(() => afterContentSaved({
      noteId: id,
      tenantId: ctx.tenantId,
      accountId: ctx.accountId,
      title: saved.title ?? "",
      bodyJson: merged.bodyJson,
      bodyChanged: true,
    }));
    return NextResponse.json({
      ok: true,
      updated_at: saved.updated_at,
      body_plain: body_plain.slice(0, NOTE_LIMITS.preview),
    });
  }
  return NextResponse.json({ error: "Busy — please retry" }, { status: 503 });
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

  const yjsUpdate =
    incoming && typeof incoming === "object" && typeof (incoming as { yjs_update?: unknown }).yjs_update === "string"
      ? (incoming as { yjs_update: string }).yjs_update
      : null;
  if (yjsUpdate !== null) {
    // The body comes from the merge, never from the client's copy.
    const { body_json: _b, yjs_update: _y, base_updated_at: _t, ...rest } = incoming as Record<string, unknown>;
    void _b; void _y; void _t;
    const cv = validateNoteInput(rest, access.role === "owner" ? "owner" : "editor");
    if (!cv.ok) return NextResponse.json({ error: cv.error }, { status: 400 });
    const fields: Record<string, unknown> = { ...cv.value };
    if (typeof fields.folder_id === "string" && !(await ownsFolder(fields.folder_id, auth.account_id))) {
      return NextResponse.json({ error: "Folder not found" }, { status: 400 });
    }
    return collabPatch(id, yjsUpdate, fields, { tenantId: access.note.tenant_id, accountId: auth.account_id });
  }

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
  /* A single-editor body save makes any stored Yjs state stale: drop it so
     the next collaborative session re-seeds from this body. */
  const bodyChanged = "body_json" in patch;
  if (bodyChanged && (await notesCollabAvailable())) patch.yjs_state = null;

  let q = supabaseServer.from("notes").update(patch).eq("id", id);
  if (base && isContent) q = q.eq("updated_at", base);
  const { data, error } = await q.select("id, updated_at, title, body_json");
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
    const { yjs_state: _ys, ...freshNote } = fresh.note as Record<string, unknown>;
    void _ys;
    return NextResponse.json(
      {
        error: "conflict",
        note: { ...freshNote, is_shared: fresh.shares.length > 0 },
        role: fresh.role,
      },
      { status: 409 },
    );
  }
  if (isContent) {
    const saved = row as unknown as { title: string; body_json: unknown };
    after(() => afterContentSaved({
      noteId: id,
      tenantId: access.note!.tenant_id,
      accountId: auth.account_id,
      title: saved.title ?? "",
      bodyJson: saved.body_json,
      bodyChanged,
    }));
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
