import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET /api/notes/shared-unread — how many notes shared with the caller they
   have not opened yet (note_shares.last_opened_at IS NULL, note live).
   Sharing already notifies via notifyLite; this is the sidebar badge. Opening
   the note (GET /api/notes/[id]) marks its share read.
   { count: 0, available: false } until migration 20260926 adds the column. */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("note_shares")
    .select("note_id")
    .eq("shared_with_account_id", auth.account_id)
    .is("last_opened_at", null)
    .limit(500);
  if (error) return NextResponse.json({ count: 0, available: false });
  const ids = ((data ?? []) as Array<{ note_id: string }>).map((r) => r.note_id);
  if (ids.length === 0) return NextResponse.json({ count: 0, available: true, ids: [] });
  // Trashed notes are invisible to sharees — they must not count.
  const { data: live } = await supabaseServer.from("notes").select("id").in("id", ids).is("deleted_at", null);
  const liveIds = ((live ?? []) as Array<{ id: string }>).map((r) => r.id);
  return NextResponse.json(
    { count: liveIds.length, available: true, ids: liveIds },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
