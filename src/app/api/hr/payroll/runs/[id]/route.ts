import "server-only";

/* GET  /api/hr/payroll/runs/[id]  — the run and its payslips (HR·view)
   POST /api/hr/payroll/runs/[id] { action: "approve" | "pay" | "reopen" } (HR·edit) */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { transitionRun } from "@/lib/server/payroll-run";
import { ledgerDraft, ledgerVoid } from "@/lib/accounting/hooks";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "HR", "view");
  if (deny) return deny;
  const { id } = await ctx.params;
  const [{ data: run }, { data: slips }] = await Promise.all([
    supabaseServer.from("hr_payroll_runs").select("*").eq("id", id).or(`tenant_id.eq.${auth.tenant_id},tenant_id.is.null`).maybeSingle(),
    supabaseServer.from("hr_payslips").select("*, koleex_employees(employee_number, people(full_name, name_alt))").eq("payroll_run_id", id).order("created_at"),
  ]);
  if (!run) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ run, payslips: slips ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "HR", "edit");
  if (deny) return deny;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
  const action = body?.action;
  if (action !== "approve" && action !== "pay" && action !== "reopen") return NextResponse.json({ error: "action must be approve|pay|reopen" }, { status: 400 });
  /* Legacy runs carry no tenant: adopt them into the caller's tenant on
     the first transition so the ledger can own them. */
  await supabaseServer.from("hr_payroll_runs").update({ tenant_id: auth.tenant_id }).eq("id", id).is("tenant_id", null);
  const r = await transitionRun(id, action, auth.account_id, auth.tenant_id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "not_found" ? 404 : 409 });

  /* An approved run is a salary liability: draft Dr Salaries / Cr Payable.
     Reopening takes it back out of the books. */
  if (action === "approve") await ledgerDraft("payroll", id, auth.tenant_id, auth.account_id);
  else if (action === "reopen") await ledgerVoid("payroll", id, auth.tenant_id, auth.account_id, "Payroll run reopened");
  return NextResponse.json({ ok: true, status: r.status });
}
