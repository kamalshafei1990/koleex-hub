import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* PATCH /api/accounts/[id]/avatar
   Body: { avatar_url: string | null }
   Users can edit their own avatar; SA can edit anyone's. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  if (id !== auth.account_id && !auth.is_super_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { avatar_url } = (await req.json()) as { avatar_url: string | null };

  const { error } = await supabaseServer
    .from("accounts")
    .update({ avatar_url })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    console.error("[api/accounts/[id]/avatar]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
