import "server-only";

/* ===========================================================================
   POST /api/accounting/month-end
     { action: "depreciation", through: "YYYY-MM-DD" }
       posts every whole month's straight-line depreciation up to the date
       (Dr 5600 / Cr 1590 per asset, one entry per month, idempotent)
     { action: "revaluation", as_of: "YYYY-MM-DD" }
       revalues foreign-currency cash, bank, receivable, payable and loan
       balances at that date's rate against 4900 / 5900 (idempotent per date)

   Both also run inside the period close; this route is the on-demand
   button for an accountant who wants the month-end entries before closing,
   or a revaluation at an interim reporting date. Finance "edit".
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "edit");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as { action?: unknown; through?: unknown; as_of?: unknown } | null;
  const action = body?.action;
  const today = new Date().toISOString().slice(0, 10);

  if (action === "depreciation") {
    const through = typeof body?.through === "string" && DATE_RE.test(body.through) ? body.through : null;
    if (!through) return NextResponse.json({ error: "through must be YYYY-MM-DD" }, { status: 400 });
    if (through > today) return NextResponse.json({ error: "Depreciation cannot be posted for a month that has not ended" }, { status: 400 });
    const { data, error } = await supabaseServer.rpc("fn_accounting_depreciation_catch_up", { p_tenant_id: auth.tenant_id, p_through: through, p_by: auth.account_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const r = (data ?? {}) as { ok?: boolean; runs?: number; errors?: Array<{ month: string; error: string }> };
    return NextResponse.json(r, { status: r.ok ? 200 : 422 });
  }

  if (action === "revaluation") {
    const asOf = typeof body?.as_of === "string" && DATE_RE.test(body.as_of) ? body.as_of : null;
    if (!asOf) return NextResponse.json({ error: "as_of must be YYYY-MM-DD" }, { status: 400 });
    if (asOf > today) return NextResponse.json({ error: "A revaluation date cannot be in the future" }, { status: 400 });
    const { data, error } = await supabaseServer.rpc("fn_accounting_fx_revalue", { p_tenant_id: auth.tenant_id, p_as_of: asOf, p_by: auth.account_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const r = (data ?? {}) as { ok?: boolean; error?: string; code?: number };
    if (!r.ok) return NextResponse.json({ error: r.error ?? "Revaluation failed" }, { status: r.code ?? 500 });
    return NextResponse.json(r);
  }

  return NextResponse.json({ error: "action must be depreciation | revaluation" }, { status: 400 });
}
