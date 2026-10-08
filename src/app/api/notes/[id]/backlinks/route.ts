import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { canRead, getNoteAccess } from "@/lib/notes-server";

/* GET /api/notes/[id]/backlinks — notes that link to this one ([[links]]).
   Only notes the CALLER may read are returned (their own live notes and
   live notes shared with them): a link from someone's private note must not
   reveal that note's existence or title. { available: false } until
   migration 20260926 creates note_links. */

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

  const { data: links, error } = await supabaseServer
    .from("note_links")
    .select("from_note_id")
    .eq("to_note_id", id)
    .limit(200);
  if (error) return NextResponse.json({ available: false, notes: [] });
  const fromIds = ((links ?? []) as Array<{ from_note_id: string }>).map((l) => l.from_note_id).filter((x) => x !== id);
  if (fromIds.length === 0) return NextResponse.json({ available: true, notes: [] });

  const [notesRes, sharesRes] = await Promise.all([
    supabaseServer
      .from("notes")
      .select("id, title, account_id, updated_at")
      .in("id", fromIds)
      .is("deleted_at", null),
    supabaseServer
      .from("note_shares")
      .select("note_id")
      .in("note_id", fromIds)
      .eq("shared_with_account_id", auth.account_id),
  ]);
  const sharedWithMe = new Set(((sharesRes.data ?? []) as Array<{ note_id: string }>).map((s) => s.note_id));
  const notes = ((notesRes.data ?? []) as Array<{ id: string; title: string; account_id: string; updated_at: string }>)
    .filter((n) => n.account_id === auth.account_id || sharedWithMe.has(n.id))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map((n) => ({ id: n.id, title: n.title, updated_at: n.updated_at }));
  return NextResponse.json({ available: true, notes });
}
