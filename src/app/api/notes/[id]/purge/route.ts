import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* DELETE /api/notes/[id]/purge — permanently remove the note. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  const { error } = await supabaseServer
    .from("notes")
    .delete()
    .eq("id", id)
    .eq("account_id", auth.account_id);
  if (error) {
    console.error("[api/notes/[id]/purge]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
