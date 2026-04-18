import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* POST /api/notes/[id]/restore — un-delete a note from Recently Deleted. */
export async function POST(
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
    .update({ deleted_at: null })
    .eq("id", id)
    .eq("account_id", auth.account_id);
  if (error) {
    console.error("[api/notes/[id]/restore]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
