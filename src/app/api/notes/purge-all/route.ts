import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* DELETE /api/notes/purge-all — Empty Trash. Permanently removes every
   soft-deleted note owned by the caller. */
export async function DELETE() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Notes");
  if (deny) return deny;

  const { error } = await supabaseServer
    .from("notes")
    .delete()
    .eq("account_id", auth.account_id)
    .not("deleted_at", "is", null);
  if (error) {
    console.error("[api/notes/purge-all]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
