import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — the executive numbers (Phase 5D, owner's picks 26 Sep
   2026): the company's week or month for the CEO. Each block checks its own
   right for the writer (a reader's is checked again as they open the report
   — gateForReader in ./report-data.ts):

     exec_reports      «Management Reports» — the reports each department
                       sent (how many people, how many wrote, how many)
     exec_sales        the Invoices app — quotations sent, new orders,
                       invoices issued, each currency apart
     exec_collections  the Finance app's door — money in, and what customers
                       still owe (of it, past due)
     exec_stock        Inventory — items low now (Inventory's one rule),
                       movements in and out, write-offs
     exec_attendance   HR · view — the attendance days of each department
     dept_kpis         «Management Reports» — each department side by side

   The company is everyone on the org tree (what a super admin's team is).
   Counts only — never a report's text, never who wrote what. Nothing here
   writes.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { requireModuleAccess, requireModuleAction, type ServerAuthContext } from "@/lib/server/auth";
import { requireFinanceNumbers } from "@/lib/experience";
import { lowStockItemIds } from "@/lib/inventory/queries";
import { listPeople, loadOrgTree } from "@/lib/server/reports/core";
import { loadOwners } from "@/lib/server/reports/obligations";
import { loadTeamFacts, type TeamFactsResult, type TeamScope } from "@/lib/server/reports/team";
import { departmentsWithIds } from "@/lib/server/reports/office";
import { MGMT_MODULE, type ExecSource } from "@/lib/reports/report-data";
import type { ReportDataRow } from "@/lib/reports/templates";
import { attendanceByDept, deptKpiRows, moneyRows, reportsByDept, salesRows, stockRows, type DeptPerson, type SaleDoc } from "@/lib/reports/numbers-5d";

export interface ExecCtx { auth: ServerAuthContext; start: string; end: string; today: string }
type Answer = { rows: ReportDataRow[] } | "denied";

const nextDay = (ymd: string) => new Date(Date.parse(`${ymd}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const chunks = <T,>(list: T[], size = 100): T[][] => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));
function listOf<T>(res: { data: unknown; error: { message: string } | null }, what: string): T[] {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return (res.data ?? []) as T[];
}
const memo = <T,>(f: () => Promise<T>): (() => Promise<T>) => { let p: Promise<T> | null = null; return () => (p ??= f()); };

/** What the executive blocks of one report share — each read once. */
export interface ExecShared {
  mgmt: () => Promise<boolean>;
  company: () => Promise<TeamScope>;
  depts: () => Promise<Map<string, { id: string; name: string }>>;
  facts: () => Promise<TeamFactsResult>;
  sent: () => Promise<Map<string, number>>;
}

export function execShared(auth: ServerAuthContext, x: { start: string; end: string }, need: { workload: boolean }): ExecShared {
  const company = memo(async (): Promise<TeamScope> => {
    const [tree, people] = await Promise.all([loadOrgTree(auth.tenant_id), listPeople(auth.tenant_id)]);
    return { owners: await loadOwners(tree), names: new Map(people.map((p) => [p.id, p])) };
  });
  return {
    mgmt: memo(async () => auth.is_super_admin || (await requireModuleAccess(auth, MGMT_MODULE)) === null),
    company,
    depts: memo(async () => departmentsWithIds((await company()).owners.map((o) => o.accountId))),
    facts: memo(async () => loadTeamFacts(auth, await company(), x.start, x.end, { attendance: true, workload: need.workload, reports: false })),
    /* The reports each person SENT in the days — the latest version of
       each, confidential ones counted too (a count shows nothing of them). */
    sent: memo(async () => {
      const ids = (await company()).owners.map((o) => o.accountId);
      const out = new Map<string, number>();
      for (const part of chunks(ids)) {
        let q = supabaseServer.from("work_reports").select("author_account_id")
          .in("author_account_id", part).neq("status", "draft").eq("superseded", false)
          .gte("submitted_at", `${x.start}T00:00:00Z`).lt("submitted_at", `${nextDay(x.end)}T00:00:00Z`).limit(5000);
        if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
        for (const r of listOf<{ author_account_id: string }>(await q, "reports sent")) out.set(r.author_account_id, (out.get(r.author_account_id) ?? 0) + 1);
      }
      return out;
    }),
  };
}

/** One person per line of the company, with their department. */
async function deptPeople(sh: ExecShared, withFacts: boolean, withSent: boolean): Promise<DeptPerson[]> {
  const [scope, depts, facts, sent] = await Promise.all([
    sh.company(), sh.depts(), withFacts ? sh.facts() : Promise.resolve(null), withSent ? sh.sent() : Promise.resolve(null),
  ]);
  const byAccount = new Map((facts?.people ?? []).map((p) => [p.accountId, p]));
  return scope.owners.map((o) => {
    const d = depts.get(o.accountId);
    const f = byAccount.get(o.accountId);
    return { deptId: d?.id ?? null, dept: d?.name ?? null, attendance: f?.attendance ?? null, workload: f?.workload, sent: sent?.get(o.accountId) ?? 0 };
  });
}

export async function execData(src: ExecSource, x: ExecCtx, sh: ExecShared, noDept: string): Promise<Answer> {
  const { auth, start: from, end: to, today } = x;
  const tenant = auth.tenant_id;
  switch (src) {
    case "exec_reports":
      if (!(await sh.mgmt())) return "denied";
      return { rows: reportsByDept(await deptPeople(sh, false, true), noDept) };
    case "dept_kpis":
      if (!(await sh.mgmt())) return "denied";
      return { rows: deptKpiRows(await deptPeople(sh, true, true), noDept) };
    case "exec_attendance":
      if ((await requireModuleAction(auth, "HR", "view")) !== null) return "denied";
      return { rows: attendanceByDept(await deptPeople(sh, true, false), noDept) };
    case "exec_sales": {
      if ((await requireModuleAccess(auth, "Invoices")) !== null) return "denied";
      /* ⚠️ quotations.status and invoices.status are ENUMS: only real values. */
      let qq = supabaseServer.from("quotations").select("currency, total").not("status", "in", "(draft,cancelled)").gte("issue_date", from).lte("issue_date", to).limit(5000);
      let oq = supabaseServer.from("orders").select("currency, total").neq("status", "cancelled").gte("created_at", `${from}T00:00:00Z`).lt("created_at", `${nextDay(to)}T00:00:00Z`).limit(5000);
      let iq = supabaseServer.from("invoices").select("currency, total").not("status", "in", "(draft,void,cancelled)").is("cancelled_at", null).gte("issue_date", from).lte("issue_date", to).limit(5000);
      if (tenant) { qq = qq.eq("tenant_id", tenant); oq = oq.eq("tenant_id", tenant); iq = iq.eq("tenant_id", tenant); }
      const [qs, os, is] = await Promise.all([qq, oq, iq]);
      type D = { currency: string | null; total: unknown };
      const docs: SaleDoc[] = [
        ...listOf<D>(qs, "quotations").map((d) => ({ metric: "quotations_sent" as const, currency: d.currency, amount: d.total as number })),
        ...listOf<D>(os, "orders").map((d) => ({ metric: "orders_new" as const, currency: d.currency, amount: d.total as number })),
        ...listOf<D>(is, "invoices").map((d) => ({ metric: "invoices_issued" as const, currency: d.currency, amount: d.total as number })),
      ];
      return { rows: salesRows(docs) };
    }
    case "exec_collections": {
      if ((await requireFinanceNumbers(auth)) !== null) return "denied";
      let pq = supabaseServer.from("invoice_payments").select("currency, amount").gte("received_at", from).lte("received_at", to).limit(5000);
      let oq = supabaseServer.from("invoices").select("currency, balance, due_date").not("status", "in", "(draft,void,cancelled)").is("cancelled_at", null).gt("balance", 0).limit(5000);
      if (tenant) { pq = pq.eq("tenant_id", tenant); oq = oq.eq("tenant_id", tenant); }
      const [ps, os] = await Promise.all([pq, oq]);
      const open = listOf<{ currency: string | null; balance: unknown; due_date: string | null }>(os, "invoices owed");
      return { rows: moneyRows(listOf<{ currency: string | null; amount: unknown }>(ps, "payments").map((p) => ({ currency: p.currency, amount: p.amount as number })),
        open.map((i) => ({ currency: i.currency, balance: i.balance as number, due: i.due_date ? i.due_date.slice(0, 10) : null })), today) };
    }
    case "exec_stock": {
      if ((await requireModuleAccess(auth, "Inventory")) !== null) return "denied";
      let mq = supabaseServer.from("inventory_stock_movements").select("direction, movement_type")
        .neq("status", "voided").is("deleted_at", null).gte("movement_date", from).lte("movement_date", to).limit(10000);
      if (tenant) mq = mq.eq("tenant_id", tenant);
      const [low, moves] = await Promise.all([tenant ? lowStockItemIds(tenant) : Promise.resolve([] as string[]), mq]);
      const list = listOf<{ direction: string | null; movement_type: string | null }>(moves, "stock movements");
      return { rows: stockRows({
        low: low.length,
        movesIn: list.filter((m) => m.direction === "in").length,
        movesOut: list.filter((m) => m.direction === "out").length,
        writeoffs: list.filter((m) => m.movement_type === "adjustment_out").length,
      }) };
    }
  }
}
