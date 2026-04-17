import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* POST /api/accounts/[id]/status
   Body: { status: "active" | "suspended" | "archived" }
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

  const { status } = (await req.json()) as { status: string };

  const { error } = await supabaseServer
    .from("accounts")
    .update({ status })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    console.error("[api/accounts/[id]/status]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mirror the status change into the login-history audit log.
  void supabaseServer.from("account_login_history").insert({
    account_id: id,
    event_type: "logout",
    metadata: { reason: "status_change", status },
  });

  return NextResponse.json({ ok: true });
}
