import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* POST /api/accounts/[id]/force-password-change
   Body: { force: boolean }
   Requires Accounts permission. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Accounts");
  if (deny) return deny;

  const { force } = (await req.json()) as { force: boolean };

  const { error } = await supabaseServer
    .from("accounts")
    .update({ force_password_change: force })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    console.error("[api/accounts/[id]/force-password-change]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  void supabaseServer.from("account_login_history").insert({
    account_id: id,
    event_type: force ? "force_reset_enabled" : "force_reset_cleared",
    metadata: {},
  });

  return NextResponse.json({ ok: true });
}
