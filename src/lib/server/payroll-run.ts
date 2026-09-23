import "server-only";

/* ---------------------------------------------------------------------------
   payroll-run — "run the month's payroll" (HR plan Phase D).

   For every active employee (of one country, or all): the salary record in
   force for the period, the month's attendance sheet, the approved leave,
   and the country's statutory rules — combined into ONE payslip whose
   breakdown explains every number:

     basic            = salary record base (monthly)
     allowances       = Σ salary record allowances
     overtime pay     = overtime hours × hourly × OVERTIME_MULTIPLIER
     absence          = absent workdays × daily rate           (deducted)
     unpaid leave     = unpaid-leave days × daily rate         (deducted)
     gross            = basic + allowances + overtime − absence − unpaid leave
     fixed deductions = Σ salary record deductions (loans, advances …)
     statutory        = rules of kind employee_deduction (rate × min(base, cap))
     tax              = progressive tax_bracket rules over taxable
                        (gross − statutory employee deductions)
     net              = gross − fixed − statutory − tax
     employer side    = rules of kind employer_contribution (shown, not deducted)

   daily rate = basic ÷ workdays of the month (the sheet's count, so a
   country with more holidays has a higher daily rate — the month still pays
   the full basic when fully worked); hourly = daily ÷ policy full-day hours.

   Rules are DATA (hr_payroll_rules): China's 五险一金 percentages and caps,
   Egypt's social insurance and tax brackets are rows HR maintains, not code.

   A slip already approved or paid is never overwritten by a re-run; it is
   reported as skipped. Everything else is upserted on (employee, period).
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { buildAttendanceSheet } from "@/lib/server/attendance-sheet";
import { resolveEmployeeCountry } from "@/lib/server/work-calendar";

export const OVERTIME_MULTIPLIER = 1.5;

export interface PayrollRule {
  id: string; country: string | null; name: string;
  kind: "employee_deduction" | "employer_contribution" | "tax_bracket";
  base: "gross" | "basic" | "taxable"; rate: number; cap: number | null;
  bracket_from: number | null; bracket_to: number | null; sort_order: number; is_active: boolean;
}

export interface PayslipBreakdown {
  basic: number; allowances: Record<string, number>; allowancesTotal: number;
  workdays: number; absentDays: number; unpaidLeaveDays: number; overtimeHours: number;
  dailyRate: number; hourlyRate: number; overtimePay: number; absenceDeduction: number; unpaidLeaveDeduction: number;
  gross: number; fixedDeductions: Record<string, number>; fixedTotal: number;
  statutory: Array<{ name: string; base: number; rate: number; amount: number }>; statutoryTotal: number;
  taxable: number; tax: Array<{ name: string; from: number; to: number | null; rate: number; amount: number }>; taxTotal: number;
  net: number; employer: Array<{ name: string; base: number; rate: number; amount: number }>; employerTotal: number;
  currency: string; country: string | null; policy: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const sum = (o: Record<string, number> | null | undefined) => Object.values(o ?? {}).reduce((a, b) => a + (Number(b) || 0), 0);

export async function loadPayrollRules(country: string | null): Promise<PayrollRule[]> {
  const { data } = await supabaseServer.from("hr_payroll_rules").select("*").eq("is_active", true).order("sort_order");
  const rows = (data ?? []) as PayrollRule[];
  const forCountry = country ? rows.filter((r) => r.country?.toUpperCase() === country.toUpperCase()) : [];
  /* A country with its own rules uses ONLY those; otherwise the NULL-country defaults. */
  return forCountry.length ? forCountry : rows.filter((r) => !r.country);
}

/** Pure: the arithmetic of one slip, given everything already loaded. */
export function computePayslip(input: {
  basic: number; allowances: Record<string, number>; deductions: Record<string, number>; currency: string; country: string | null; policyName: string;
  workdays: number; absentDays: number; unpaidLeaveDays: number; overtimeHours: number; minHours: number; rules: PayrollRule[];
}): PayslipBreakdown {
  const basic = r2(Number(input.basic) || 0);
  const allowancesTotal = r2(sum(input.allowances));
  const dailyRate = input.workdays > 0 ? basic / input.workdays : 0;
  const hourlyRate = input.minHours > 0 ? dailyRate / input.minHours : 0;
  const overtimePay = r2(input.overtimeHours * hourlyRate * OVERTIME_MULTIPLIER);
  const absenceDeduction = r2(input.absentDays * dailyRate);
  const unpaidLeaveDeduction = r2(input.unpaidLeaveDays * dailyRate);
  const gross = r2(basic + allowancesTotal + overtimePay - absenceDeduction - unpaidLeaveDeduction);
  const fixedTotal = r2(sum(input.deductions));

  const baseOf = (b: PayrollRule["base"], taxable: number) => (b === "basic" ? basic : b === "taxable" ? taxable : gross);
  const statutory = input.rules.filter((r) => r.kind === "employee_deduction").map((r) => {
    const base = Math.min(baseOf(r.base, gross), r.cap ?? Infinity);
    return { name: r.name, base: r2(base), rate: Number(r.rate), amount: r2(base * Number(r.rate)) };
  });
  const statutoryTotal = r2(statutory.reduce((a, l) => a + l.amount, 0));
  const taxable = r2(Math.max(0, gross - statutoryTotal));
  const tax = input.rules.filter((r) => r.kind === "tax_bracket")
    .sort((a, b) => Number(a.bracket_from ?? 0) - Number(b.bracket_from ?? 0))
    .map((r) => {
      const from = Number(r.bracket_from ?? 0), to = r.bracket_to === null ? null : Number(r.bracket_to);
      const slice = Math.max(0, Math.min(taxable, to ?? Infinity) - from);
      return { name: r.name, from, to, rate: Number(r.rate), amount: r2(slice * Number(r.rate)) };
    }).filter((l) => l.amount > 0);
  const taxTotal = r2(tax.reduce((a, l) => a + l.amount, 0));
  const employer = input.rules.filter((r) => r.kind === "employer_contribution").map((r) => {
    const base = Math.min(baseOf(r.base, taxable), r.cap ?? Infinity);
    return { name: r.name, base: r2(base), rate: Number(r.rate), amount: r2(base * Number(r.rate)) };
  });
  const employerTotal = r2(employer.reduce((a, l) => a + l.amount, 0));
  const net = r2(gross - fixedTotal - statutoryTotal - taxTotal);
  return {
    basic, allowances: input.allowances ?? {}, allowancesTotal, workdays: input.workdays, absentDays: input.absentDays,
    unpaidLeaveDays: input.unpaidLeaveDays, overtimeHours: r2(input.overtimeHours), dailyRate: r2(dailyRate), hourlyRate: r2(hourlyRate),
    overtimePay, absenceDeduction, unpaidLeaveDeduction, gross, fixedDeductions: input.deductions ?? {}, fixedTotal,
    statutory, statutoryTotal, taxable, tax, taxTotal, net, employer, employerTotal,
    currency: input.currency, country: input.country, policy: input.policyName,
  };
}

export interface RunResult {
  runId: string; period: string; country: string | null; created: number; updated: number;
  skipped: Array<{ employeeId: string; reason: "no_salary" | "locked" }>;
  totals: { gross: number; net: number; employer: number; employees: number };
}

export async function runPayroll(opts: { tenantId: string | null; period: string; country: string | null; createdBy: string | null; today: string;
  /** false = attendance is not tracked for this run: absent days are NOT deducted (overtime and unpaid leave still count). */
  deductAbsence?: boolean }): Promise<RunResult> {
  const [y, m] = opts.period.split("-").map(Number);
  const periodStart = `${opts.period}-01`;
  const periodEnd = `${opts.period}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  /* Days after the period are not "future" for the sheet — an already-past
     month is judged in full; the current month only up to today. */
  const sheetToday = opts.today > periodEnd ? `${periodEnd}T` : opts.today;

  /* Employees are single-tenant in practice and most rows carry no
     tenant_id (see /api/employees, which never filters on it) — match the
     tenant OR null, never silently drop the unlabelled majority. */
  const { data: emps } = await supabaseServer.from("koleex_employees").select("id").eq("employment_status", "active")
    .or(opts.tenantId ? `tenant_id.eq.${opts.tenantId},tenant_id.is.null` : "tenant_id.is.null");
  const employeeIds = ((emps ?? []) as { id: string }[]).map((e) => e.id);

  /* Existing run row for (tenant, period, country) — reused so a re-run
     replaces drafts. Runs are tenant-scoped: payroll is a ledger source. */
  let runQ = supabaseServer.from("hr_payroll_runs").select("id, status").eq("period", opts.period);
  runQ = opts.tenantId ? runQ.eq("tenant_id", opts.tenantId) : runQ.is("tenant_id", null);
  runQ = opts.country ? runQ.eq("country", opts.country) : runQ.is("country", null);
  const { data: existingRun } = await runQ.limit(1).maybeSingle();
  let runId = (existingRun as { id: string; status: string } | null)?.id ?? null;
  if (!runId) {
    const { data: created, error } = await supabaseServer.from("hr_payroll_runs")
      .insert({ tenant_id: opts.tenantId, period: opts.period, country: opts.country, status: "draft", created_by: opts.createdBy }).select("id").single();
    if (error || !created) throw new Error(error?.message ?? "run insert failed");
    runId = (created as { id: string }).id;
  }

  const result: RunResult = { runId, period: opts.period, country: opts.country, created: 0, updated: 0, skipped: [], totals: { gross: 0, net: 0, employer: 0, employees: 0 } };
  let currency: string | null = null;

  for (const employeeId of employeeIds) {
    const country = await resolveEmployeeCountry(employeeId);
    if (opts.country && country !== opts.country.toUpperCase()) continue;

    const { data: sal } = await supabaseServer.from("hr_salary_records").select("*")
      .eq("employee_id", employeeId).lte("effective_from", periodEnd).or(`effective_to.is.null,effective_to.gte.${periodStart}`)
      .order("effective_from", { ascending: false }).limit(1).maybeSingle();
    const salary = sal as { id: string; base_salary: number; currency: string; allowances: Record<string, number> | null; deductions: Record<string, number> | null } | null;
    if (!salary) { result.skipped.push({ employeeId, reason: "no_salary" }); continue; }

    const { data: existing } = await supabaseServer.from("hr_payslips").select("id, status").eq("employee_id", employeeId).eq("period_start", periodStart).maybeSingle();
    const prior = existing as { id: string; status: string } | null;
    if (prior && prior.status !== "draft") { result.skipped.push({ employeeId, reason: "locked" }); continue; }

    const sheet = await buildAttendanceSheet({ employeeId, tenantId: opts.tenantId, year: y, month: m, today: sheetToday });
    const unpaidLeaveDays = sheet.days.filter((d) => d.status === "leave" && d.leavePaid === false).length;
    const rules = await loadPayrollRules(country);
    const breakdown = computePayslip({
      basic: salary.base_salary, allowances: salary.allowances ?? {}, deductions: salary.deductions ?? {},
      currency: salary.currency || "USD", country, policyName: sheet.policy.name,
      workdays: sheet.summary.workdays, absentDays: opts.deductAbsence === false ? 0 : sheet.summary.absent, unpaidLeaveDays,
      /* Only APPROVED overtime is paid (owner rule, 23 Sep 2026): the sheet's
         overtimeH is what the punches say; overtimeApprovedH is what HR or the
         owner accepted. */
      overtimeHours: sheet.summary.overtimeApprovedH, minHours: sheet.policy.minHours, rules,
    });
    const deductionsJson: Record<string, number> = { ...(salary.deductions ?? {}) };
    for (const l of breakdown.statutory) deductionsJson[l.name] = l.amount;
    if (breakdown.taxTotal > 0) deductionsJson["Income tax"] = breakdown.taxTotal;
    if (breakdown.absenceDeduction > 0) deductionsJson["Absence"] = breakdown.absenceDeduction;
    if (breakdown.unpaidLeaveDeduction > 0) deductionsJson["Unpaid leave"] = breakdown.unpaidLeaveDeduction;

    const row = {
      employee_id: employeeId, salary_record_id: salary.id, period_start: periodStart, period_end: periodEnd,
      gross_amount: breakdown.gross, deductions: deductionsJson, net_amount: breakdown.net, status: "draft",
      paid_at: null, notes: null, payroll_run_id: runId, currency: breakdown.currency,
      breakdown, employer_contributions: Object.fromEntries(breakdown.employer.map((l) => [l.name, l.amount])),
    };
    const { error } = prior
      ? await supabaseServer.from("hr_payslips").update(row).eq("id", prior.id)
      : await supabaseServer.from("hr_payslips").insert(row);
    if (error) { console.error("[payroll-run] slip:", employeeId, error.message); continue; }
    if (prior) result.updated++; else result.created++;
    result.totals.gross = r2(result.totals.gross + breakdown.gross);
    result.totals.net = r2(result.totals.net + breakdown.net);
    result.totals.employer = r2(result.totals.employer + breakdown.employerTotal);
    result.totals.employees++;
    currency = currency ?? breakdown.currency;
  }

  await supabaseServer.from("hr_payroll_runs").update({
    employees: result.totals.employees, total_gross: result.totals.gross, total_net: result.totals.net, total_employer: result.totals.employer,
    currency, updated_at: new Date().toISOString(),
  }).eq("id", runId);
  return result;
}

/** draft → approved → paid (and approved → draft to reopen). Moves the run
 *  and every slip in it together. */
export async function transitionRun(runId: string, action: "approve" | "pay" | "reopen", actor: string | null, tenantId?: string | null): Promise<{ ok: boolean; status?: string; error?: string }> {
  let q = supabaseServer.from("hr_payroll_runs").select("id, status").eq("id", runId);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q.maybeSingle();
  const run = data as { id: string; status: string } | null;
  if (!run) return { ok: false, error: "not_found" };
  const now = new Date().toISOString();
  const next = action === "approve" ? "approved" : action === "pay" ? "paid" : "draft";
  const allowed = (action === "approve" && run.status === "draft") || (action === "pay" && run.status === "approved") || (action === "reopen" && run.status === "approved");
  if (!allowed) return { ok: false, error: "bad_transition" };
  const runPatch: Record<string, unknown> = { status: next, updated_at: now };
  if (action === "approve") { runPatch.approved_by = actor; runPatch.approved_at = now; }
  if (action === "pay") runPatch.paid_at = now.slice(0, 10);
  if (action === "reopen") { runPatch.approved_by = null; runPatch.approved_at = null; }
  const { error } = await supabaseServer.from("hr_payroll_runs").update(runPatch).eq("id", runId).eq("status", run.status);
  if (error) return { ok: false, error: error.message };
  const slipPatch = action === "pay" ? { status: "paid", paid_at: now.slice(0, 10) } : { status: next, paid_at: null };
  await supabaseServer.from("hr_payslips").update(slipPatch).eq("payroll_run_id", runId);
  return { ok: true, status: next };
}
