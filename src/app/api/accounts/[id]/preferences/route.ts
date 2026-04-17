import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* PATCH /api/accounts/[id]/preferences
   Body: { preferences: object }

   Rule: you can always edit your OWN preferences without the Accounts
   permission. Editing someone else's preferences requires SA. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const editingSelf = id === auth.account_id;
  if (!editingSelf && !auth.is_super_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { preferences } = (await req.json()) as {
    preferences: Record<string, unknown>;
  };

  const { error } = await supabaseServer
    .from("accounts")
    .update({ preferences })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    console.error("[api/accounts/[id]/preferences]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
