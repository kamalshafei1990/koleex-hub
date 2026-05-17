import "server-only";

/* ===========================================================================
   GET /api/accounting/trial-balance?from=…&to=…
   Returns a tenant-scoped trial balance built from posted journal
   lines. `from` / `to` are inclusive ISO dates; omit either to leave
   the period unbounded on that side.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { buildTrialBalance } from "@/lib/accounting/queries";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  /* Ensure COA exists so even a brand-new tenant gets an empty-but-
     valid trial balance instead of a 500. */
  await supabaseServer.rpc("fn_accounting_ensure_coa", { p_tenant_id: auth.tenant_id });

  const url = new URL(req.url);
  const tb = await buildTrialBalance(auth.tenant_id, {
    from: url.searchParams.get("from") ?? undefined,
    to:   url.searchParams.get("to")   ?? undefined,
  });
  return NextResponse.json({ trial_balance: tb });
}
