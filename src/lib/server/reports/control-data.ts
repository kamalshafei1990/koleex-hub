import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — the control numbers (Phase 5D, owner's picks 26 Sep
   2026). Each block checks its own right for the writer (a reader's is
   checked again as they open the report — gateForReader):

     access_review   «Management Reports» — every account of the company:
                     its role, the sensitive rights it holds (a super admin,
                     «Bank & Profit», «Payroll Reports», «CEO Office»,
                     «Management Reports», «Report Templates», «Finance
                     Approvals», the role's private records), how many apps
                     it opens, two-step sign-in, its last sign-in, its state
     system_usage    «Management Reports» — each active account's hours in
                     the Hub over the days, the days it was used, its
                     sign-ins, the last day used
     contract_dates  the Contracts app — each signed sales contract's
                     delivery due (its lead time from what it counts from:
                     the deposit, the order, the letter of credit) and its
                     warranty's end; what still waits, said as such

   A right is read the way requireModuleAction reads it — the role's row, an
   account's own row winning where it says yes or no. Nothing here writes.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { requireModuleAccess, type ServerAuthContext } from "@/lib/server/auth";
import { listPeople } from "@/lib/server/reports/core";
import { MGMT_MODULE, type ControlSource } from "@/lib/reports/report-data";
import type { ReportDataRow } from "@/lib/reports/templates";
import { accessRows, contractDateRows, usageRows, type AccountFacts, type LeadBasis, type SensitiveRight } from "@/lib/reports/numbers-5d";

export interface ControlCtx { auth: ServerAuthContext; start: string; end: string; today: string }
type Answer = { rows: ReportDataRow[] } | "denied";

const nextDay = (ymd: string) => new Date(Date.parse(`${ymd}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const chunks = <T,>(list: T[], size = 100): T[][] => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));
function listOf<T>(res: { data: unknown; error: { message: string } | null }, what: string): T[] {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return (res.data ?? []) as T[];
}

/** The Roles rows an access review names, and the tag each shows as. */
const CAPABILITY_TAGS: Array<[string, SensitiveRight]> = [
  ["bank & profit", "bank_profit"], ["payroll reports", "payroll_reports"], ["ceo office", "ceo_office"],
  ["management reports", "mgmt_reports"], ["report templates", "report_templates"], ["finance approvals", "finance_approvals"],
];

type Acct = { id: string; username: string | null; role_id: string | null; is_super_admin: boolean | null; status: string | null; two_factor_enabled: boolean | null; last_login_at: string | null };
type Perm = { can_view: boolean | null; can_create: boolean | null };

async function accountsOf(auth: ServerAuthContext, activeOnly: boolean): Promise<Acct[]> {
  let q = supabaseServer.from("accounts").select("id, username, role_id, is_super_admin, status, two_factor_enabled, last_login_at").limit(2000);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  if (activeOnly) q = q.eq("status", "active");
  return listOf<Acct>(await q, "accounts");
}

async function accessFacts(auth: ServerAuthContext): Promise<AccountFacts[]> {
  const [accts, people] = await Promise.all([accountsOf(auth, false), listPeople(auth.tenant_id)]);
  const names = new Map(people.map((p) => [p.id, p.name]));
  const roleIds = Array.from(new Set(accts.map((a) => a.role_id).filter((r): r is string => !!r)));
  const [roles, perms, overrides] = await Promise.all([
    roleIds.length ? supabaseServer.from("roles").select("id, name, is_super_admin, can_view_private").in("id", roleIds).then((r) => listOf<{ id: string; name: string | null; is_super_admin: boolean | null; can_view_private: boolean | null }>(r, "roles")) : Promise.resolve([]),
    roleIds.length ? supabaseServer.from("koleex_permissions").select("role_id, module_name, can_view, can_create").in("role_id", roleIds).limit(10000).then((r) => listOf<Perm & { role_id: string; module_name: string }>(r, "role rights")) : Promise.resolve([]),
    (async () => {
      const all: Array<Perm & { account_id: string; module_key: string }> = [];
      for (const part of chunks(accts.map((a) => a.id))) all.push(...listOf<Perm & { account_id: string; module_key: string }>(await supabaseServer.from("account_permission_overrides").select("account_id, module_key, can_view, can_create").in("account_id", part).limit(10000), "account rights"));
      return all;
    })(),
  ]);
  const roleOf = new Map(roles.map((r) => [r.id, r]));
  const roleRows = new Map<string, Map<string, Perm>>();
  for (const p of perms) { const m = roleRows.get(p.role_id) ?? new Map(); m.set(p.module_name.toLowerCase(), p); roleRows.set(p.role_id, m); }
  const ownRows = new Map<string, Map<string, Perm>>();
  for (const o of overrides) { const m = ownRows.get(o.account_id) ?? new Map(); m.set(o.module_key.toLowerCase(), o); ownRows.set(o.account_id, m); }
  return accts.map((a) => {
    const role = a.role_id ? roleOf.get(a.role_id) : undefined;
    const sa = !!a.is_super_admin || !!role?.is_super_admin;
    const mine = ownRows.get(a.id) ?? new Map<string, Perm>();
    const theirs = (a.role_id ? roleRows.get(a.role_id) : undefined) ?? new Map<string, Perm>();
    /* The account's own row wins where it says yes or no; a hidden module is none. */
    const holds = (module: string) => {
      const o = mine.get(module), r = theirs.get(module);
      if (o && o.can_view === false) return false;
      const view = typeof o?.can_view === "boolean" ? o.can_view : !!r?.can_view;
      const create = typeof o?.can_create === "boolean" ? o.can_create : !!r?.can_create;
      return view || create;
    };
    const modules = new Set([...theirs.keys(), ...mine.keys()]);
    const rights: SensitiveRight[] = sa ? ["super_admin"]
      : [...CAPABILITY_TAGS.filter(([m]) => holds(m)).map(([, tag]) => tag), ...(role?.can_view_private ? ["private_records" as const] : [])];
    return {
      id: a.id, name: names.get(a.id) || a.username || "—", role: role?.name ?? null, rights,
      apps: sa ? null : [...modules].filter((m) => holds(m)).length,
      twoFactor: !!a.two_factor_enabled, lastLogin: a.last_login_at, status: a.status ?? "active",
    };
  });
}

export async function controlData(src: ControlSource, x: ControlCtx): Promise<Answer> {
  const { auth, start: from, end: to, today } = x;
  const tenant = auth.tenant_id;
  switch (src) {
    case "access_review": {
      if (!auth.is_super_admin && (await requireModuleAccess(auth, MGMT_MODULE)) !== null) return "denied";
      return { rows: accessRows(await accessFacts(auth)) };
    }
    case "system_usage": {
      if (!auth.is_super_admin && (await requireModuleAccess(auth, MGMT_MODULE)) !== null) return "denied";
      const [accts, people] = await Promise.all([accountsOf(auth, true), listPeople(tenant)]);
      const names = new Map(people.map((p) => [p.id, p.name]));
      const ids = accts.map((a) => a.id);
      const usage = new Map<string, { seconds: number; days: number; last: string | null }>();
      const signIns = new Map<string, number>();
      for (const part of chunks(ids)) {
        let uq = supabaseServer.from("usage_daily").select("account_id, day, active_seconds").in("account_id", part).gte("day", from).lte("day", to).limit(10000);
        let lq = supabaseServer.from("activity_events").select("account_id").in("account_id", part).eq("event_type", "login")
          .gte("created_at", `${from}T00:00:00Z`).lt("created_at", `${nextDay(to)}T00:00:00Z`).limit(10000);
        if (tenant) { uq = uq.eq("tenant_id", tenant); lq = lq.eq("tenant_id", tenant); }
        const [us, ls] = await Promise.all([uq, lq]);
        for (const u of listOf<{ account_id: string; day: string; active_seconds: number | null }>(us, "usage")) {
          const e = usage.get(u.account_id) ?? { seconds: 0, days: 0, last: null };
          const secs = Number(u.active_seconds) || 0;
          e.seconds += secs;
          if (secs > 0) { e.days++; if (!e.last || u.day > e.last) e.last = u.day; }
          usage.set(u.account_id, e);
        }
        for (const l of listOf<{ account_id: string }>(ls, "sign-ins")) signIns.set(l.account_id, (signIns.get(l.account_id) ?? 0) + 1);
      }
      return { rows: usageRows(accts.map((a) => {
        const u = usage.get(a.id);
        return { id: a.id, name: names.get(a.id) || a.username || "—", seconds: u?.seconds ?? 0, days: u?.days ?? 0, signIns: signIns.get(a.id) ?? 0, last: u?.last ?? null };
      })) };
    }
    case "contract_dates": {
      if (!auth.is_super_admin && (await requireModuleAccess(auth, "Contracts")) !== null) return "denied";
      type C = { id: string; contract_no: string | null; order_id: string | null; invoice_id: string | null; basis: string | null; lead: string | null; warranty: string | null; company: string | null; buyer: string | null };
      let q = supabaseServer.from("sales_contracts")
        .select("id, contract_no, order_id, invoice_id, basis:terms->>leadTimeBasis, lead:terms->>leadTimeDays, warranty:terms->>warrantyMonths, company:terms->buyer->>company, buyer:terms->buyer->>name")
        .eq("status", "signed").limit(2000);
      if (tenant) q = q.eq("tenant_id", tenant);
      const list = listOf<C>(await q, "contracts");
      /* What each lead time counts from: the order's day, the invoice's first payment. */
      const orderIds = Array.from(new Set(list.map((c) => c.order_id).filter((v): v is string => !!v)));
      const invoiceIds = Array.from(new Set(list.map((c) => c.invoice_id).filter((v): v is string => !!v)));
      const orderDay = new Map<string, string>();
      const firstPaid = new Map<string, string>();
      for (const part of chunks(orderIds)) for (const o of listOf<{ id: string; created_at: string }>(await supabaseServer.from("orders").select("id, created_at").in("id", part), "orders")) orderDay.set(o.id, o.created_at.slice(0, 10));
      for (const part of chunks(invoiceIds)) {
        for (const p of listOf<{ invoice_id: string; received_at: string | null }>(await supabaseServer.from("invoice_payments").select("invoice_id, received_at").in("invoice_id", part).limit(5000), "payments")) {
          const d = p.received_at?.slice(0, 10);
          if (d && (!firstPaid.get(p.invoice_id) || d < firstPaid.get(p.invoice_id)!)) firstPaid.set(p.invoice_id, d);
        }
      }
      const BASES: LeadBasis[] = ["after_deposit", "after_order", "after_lc_opening"];
      const num = (v: string | null) => (v !== null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
      return { rows: contractDateRows(list.map((c) => {
        const basis = BASES.includes(c.basis as LeadBasis) ? (c.basis as LeadBasis) : null;
        const basisDate = basis === "after_order" ? (c.order_id ? orderDay.get(c.order_id) ?? null : null)
          : basis === "after_deposit" ? (c.invoice_id ? firstPaid.get(c.invoice_id) ?? null : null)
          : null;
        return { id: c.id, no: c.contract_no ?? "", customer: c.company || c.buyer || "", basis, basisDate, leadDays: num(c.lead), warrantyMonths: num(c.warranty) };
      }), today) };
    }
  }
}
