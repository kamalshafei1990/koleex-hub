import "server-only";

/* ===========================================================================
   GET  /api/accounting/accounts
   Returns the chart of accounts for the tenant, seeded on first read.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import type { AccountingAccount } from "@/lib/accounting/types";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  /* Lazy seed — idempotent ON CONFLICT DO NOTHING under the hood. */
  await supabaseServer.rpc("fn_accounting_ensure_coa", { p_tenant_id: auth.tenant_id });

  const { data, error } = await supabaseServer
    .from("accounting_accounts")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .order("code", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ accounts: (data ?? []) as AccountingAccount[] });
}
