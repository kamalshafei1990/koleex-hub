import "server-only";

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { canRead, getNoteAccess } from "@/lib/notes-server";
import { collabKeysFor, loadOrSeedState, notesCollabAvailable } from "@/lib/notes-yjs-server";

/* GET /api/notes/[id]/collab — join a shared note's live session.
   Answers { available: false } when collaboration is off (migration not yet
   applied, no secret, note not shared, or trashed) — the editor then keeps
   the single-editor path. Otherwise:
     { available: true, role, state: <base64 Yjs state>, keys: { k, w, e } }
   `state` is seeded server-side on first use; `w` (the write key) is only
   given to the owner and editors. Never cached. */

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
  const headers = { "Cache-Control": "private, no-store" };
  if (access.note.deleted_at || access.shares.length === 0 || !(await notesCollabAvailable())) {
    return NextResponse.json({ available: false }, { headers });
  }

  const keys = collabKeysFor(id, access.note.account_id, access.shares, access.role);
  const state = await loadOrSeedState(id);
  if (!keys || !state) return NextResponse.json({ available: false }, { headers });

  return NextResponse.json({ available: true, role: access.role, state, keys }, { headers });
}
