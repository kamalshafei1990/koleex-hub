import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { purgeNotes } from "@/lib/notes-server";

/* DELETE /api/notes/purge-all — Empty Trash. Permanently removes every
   soft-deleted note owned by the caller (with shares + private images). */
export async function DELETE() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Notes", "delete");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("notes")
    .select("id, tenant_id")
    .eq("account_id", auth.account_id)
    .not("deleted_at", "is", null);
  if (error) {
    console.error("[api/notes/purge-all]", error.message);
    return NextResponse.json({ error: "Failed to empty trash" }, { status: 500 });
  }
  const res = await purgeNotes((data ?? []) as Array<{ id: string; tenant_id: string }>);
  if (!res.ok) return NextResponse.json({ error: "Failed to empty trash" }, { status: 500 });
  return NextResponse.json({ ok: true, purged: (data ?? []).length });
}
