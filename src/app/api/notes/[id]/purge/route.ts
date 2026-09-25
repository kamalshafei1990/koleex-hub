import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { isUuid, purgeNotes } from "@/lib/notes-server";

/* DELETE /api/notes/[id]/purge — permanently remove the note (with its shares
   and private images). 404 when the caller owns no note with that id. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Notes", "delete");
  if (deny) return deny;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: note } = await supabaseServer
    .from("notes")
    .select("id, tenant_id")
    .eq("id", id)
    .eq("account_id", auth.account_id)
    .maybeSingle();
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const res = await purgeNotes([note as { id: string; tenant_id: string }]);
  if (!res.ok) return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
