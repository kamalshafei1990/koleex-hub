import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { isUuid } from "@/lib/notes-server";

/* POST /api/notes/[id]/restore — un-delete a note from Recently Deleted.
   404 when the caller owns no trashed note with that id. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Notes", "edit");
  if (deny) return deny;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabaseServer
    .from("notes")
    .update({ deleted_at: null })
    .eq("id", id)
    .eq("account_id", auth.account_id)
    .not("deleted_at", "is", null)
    .select("id");
  if (error) {
    console.error("[api/notes/[id]/restore]", error.message);
    return NextResponse.json({ error: "Failed to restore note" }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
