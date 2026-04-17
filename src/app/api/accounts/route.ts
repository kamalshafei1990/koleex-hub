import "server-only";

/* GET /api/accounts — list accounts in the caller's tenant.
   Requires the "Accounts" module permission. Super Admin sees every account
   in whichever tenant ctx.tenant_id points to (via TenantPicker). */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Accounts");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("accounts")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[api/accounts]", error.message);
    return NextResponse.json({ error: "Failed to load accounts" }, { status: 500 });
  }
  return NextResponse.json({ accounts: data ?? [] });
}
