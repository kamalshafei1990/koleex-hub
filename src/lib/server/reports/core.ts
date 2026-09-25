import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — the facts every /api/work-reports route needs:
   who may use the app, who manages whom, who a report goes to by default,
   and whether THIS viewer may read THIS report. The rule itself is the pure
   `reportAccess` in src/lib/reports/access.ts; this file only gathers the
   facts it takes.

   Tables: work_reports, work_report_recipients, work_report_comments
   (RLS on, no policies — the service role here is the only way in).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireModuleAccess, requireModuleAction, type ServerAuthContext } from "@/lib/server/auth";
import { listAssignableEmployees, type AssignableEmployee } from "@/lib/server/assignable-employees";
import { hrReviewerAccountIds } from "@/lib/server/leave-review";
import { reportAccess, type ReportAccess } from "@/lib/reports/access";
import type { ReportTemplateDef, ReportSectionValue } from "@/lib/reports/templates";
import { MGMT_MODULE, OFFICE_MODULE, PAYROLL_MODULE } from "@/lib/reports/report-data";

export const REPORT_COLS =
  "id, tenant_id, template_key, author_account_id, title, period_start, period_end, period_key, sections, status, confidential, review_required, version, previous_id, superseded, submitted_at, decided_at, decided_by, created_at, updated_at, template_snapshot";
/** Lists never carry `sections` — that is the report's whole text. A report
 *  of a builder type (4E) brings only its type's name, icon and period
 *  (`tpl_head`, from its snapshot — the name it was written under). */
export const REPORT_LIST_COLS =
  "id, template_key, author_account_id, title, period_start, period_end, period_key, status, confidential, review_required, version, superseded, submitted_at, updated_at, tpl_head:template_snapshot->head";

export type ReportStatus = "draft" | "submitted" | "approved" | "returned";

export interface ReportRow {
  id: string;
  tenant_id: string | null;
  template_key: string;
  author_account_id: string;
  title: string;
  period_start: string | null;
  period_end: string | null;
  period_key: string | null;
  sections: ReportSectionValue[];
  status: ReportStatus;
  confidential: boolean;
  review_required: boolean;
  version: number;
  previous_id: string | null;
  superseded: boolean;
  submitted_at: string | null;
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
  updated_at: string;
  /** A builder type's copy, as the report was started with it (4E); null for a built-in. */
  template_snapshot: unknown;
}

export interface RecipientRow {
  account_id: string;
  role: "to" | "cc";
  read_at: string | null;
  acknowledged_at: string | null;
}

/** Reports are for Koleex staff: a customer or portal login shares the
 *  accounts table but must never reach this app. */
export function requireReportsUser(auth: ServerAuthContext): NextResponse | null {
  if (auth.user_type === "internal") return null;
  return NextResponse.json({ error: "not_internal" }, { status: 403 });
}

/** May this person START a report of this type? HR-only types (a warning,
 *  an exit interview) need HR·create; a team type (5A: the team summary, a
 *  1-on-1, a recommendation) needs a team — anyone under them — or a super
 *  admin; a CEO-office type (5B) needs «CEO Office» in Roles, or a super
 *  admin; every other type is open to staff. */
export async function canStartTemplate(tpl: ReportTemplateDef, auth: ServerAuthContext): Promise<boolean> {
  if (tpl.hrOnly && (await requireModuleAction(auth, "HR", "create")) !== null) return false;
  if (tpl.teamOnly && !auth.is_super_admin && !(await loadOrgTree(auth.tenant_id)).descendantsOf(auth.account_id).length) return false;
  if (tpl.officeOnly && !auth.is_super_admin && (await requireModuleAction(auth, OFFICE_MODULE, "create")) !== null) return false;
  /* 5C: salaries need «Payroll Reports»; an HR, Projects, Inventory or
     Finance type its app (HR: HR · view) — or, `orTeam`, a team. */
  if (tpl.payrollOnly && !auth.is_super_admin && (await requireModuleAction(auth, PAYROLL_MODULE, "create")) !== null) return false;
  /* 5D: the executive and control types need «Management Reports». */
  if (tpl.mgmtOnly && !auth.is_super_admin && (await requireModuleAction(auth, MGMT_MODULE, "create")) !== null) return false;
  if (tpl.app && !(await hasApp(auth, tpl.app))) {
    if (!tpl.orTeam || !(await loadOrgTree(auth.tenant_id)).descendantsOf(auth.account_id).length) return false;
  }
  return true;
}

/** A type's app (5C): HR is HR · view; the others their module. */
export async function hasApp(auth: ServerAuthContext, app: NonNullable<ReportTemplateDef["app"]>): Promise<boolean> {
  if (auth.is_super_admin) return true;
  return (app === "HR" ? await requireModuleAction(auth, "HR", "view") : await requireModuleAccess(auth, app)) === null;
}

type EmpLite = { id: string; account_id: string | null; person_id: string | null; manager_id: string | null };

/** Every employee of the tenant, once — the org tree is small (the scale
 *  target is dozens of staff, not thousands), so walking it in memory is
 *  cheaper than a query per level. */
async function employeesOf(tenantId: string | null): Promise<EmpLite[]> {
  let q = supabaseServer.from("koleex_employees").select("id, account_id, person_id, manager_id").limit(2000);
  if (tenantId) q = q.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
  const { data, error } = await q;
  if (error) { console.error("[reports] employees:", error.message); return []; }
  return (data ?? []) as EmpLite[];
}

/** employee id → account id, resolving the person link where the direct
 *  one is missing (the two drift; see leave-review.ts's employeeAccountId).
 *  ONE query for all the missing links — never one per employee. */
async function accountMap(emps: EmpLite[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const viaPerson = new Map<string, string[]>();
  for (const e of emps) {
    if (e.account_id) out.set(e.id, e.account_id);
    else if (e.person_id) viaPerson.set(e.person_id, [...(viaPerson.get(e.person_id) ?? []), e.id]);
  }
  if (viaPerson.size) {
    const { data, error } = await supabaseServer.from("accounts").select("id, person_id")
      .in("person_id", Array.from(viaPerson.keys())).eq("status", "active").limit(2000);
    if (error) console.error("[reports] accounts by person:", error.message);
    for (const a of (data ?? []) as { id: string; person_id: string }[]) {
      for (const empId of viaPerson.get(a.person_id) ?? []) if (!out.has(empId)) out.set(empId, a.id);
    }
  }
  return out;
}

/* Per-tenant memo for the org tree and the people list — both small, both
   read by nearly every Reports request, both change a few times a month.
   The taxonomy-cache shape: on globalThis (the server bundle can hold two
   copies of a module), 60 s TTL, an in-flight load shared by concurrent
   requests, a failed or empty load never kept. Callers authenticate first;
   what is shared is the tenant's staff list, which every internal user of
   that tenant may already read. */
type Memo = { at: number; value: Promise<unknown> };
const memoStore = globalThis as typeof globalThis & { __kxReportsMemo?: Map<string, Memo> };
const MEMO_TTL_MS = 60_000;
function memo<T>(key: string, load: () => Promise<T>, keep: (v: T) => boolean): Promise<T> {
  const m = (memoStore.__kxReportsMemo ??= new Map());
  const hit = m.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.value as Promise<T>;
  const value = load();
  m.set(key, { at: Date.now(), value });
  const drop = () => { if (m.get(key)?.value === value) m.delete(key); };
  value.then((v) => { if (!keep(v)) drop(); }, drop);
  return value;
}

export interface OrgTree {
  /** How many employees the tree was built from. */
  size: number;
  /** Managers of an account, nearest first (cycle-safe, max 8 levels). */
  chainOf(accountId: string): string[];
  /** Everyone below an account, at any depth. */
  descendantsOf(accountId: string): string[];
  /** Every employee that resolves to an account (Phase 3A: who can owe a
   *  report), with their employee id. */
  members(): Array<{ accountId: string; employeeId: string }>;
}

export function loadOrgTree(tenantId: string | null): Promise<OrgTree> {
  return memo(`tree:${tenantId ?? "-"}`, () => buildOrgTree(tenantId), (t) => t.size > 0);
}

async function buildOrgTree(tenantId: string | null): Promise<OrgTree> {
  const emps = await employeesOf(tenantId);
  const acc = await accountMap(emps);
  const byId = new Map(emps.map((e) => [e.id, e]));
  const empOfAccount = new Map<string, EmpLite>();
  for (const e of emps) { const a = acc.get(e.id); if (a) empOfAccount.set(a, e); }
  return {
    size: emps.length,
    members() {
      return Array.from(empOfAccount.entries()).map(([accountId, e]) => ({ accountId, employeeId: e.id }));
    },
    chainOf(accountId) {
      const out: string[] = [];
      const seen = new Set<string>();
      let e = empOfAccount.get(accountId);
      for (let depth = 0; e && e.manager_id && depth < 8; depth++) {
        if (seen.has(e.manager_id)) break;
        seen.add(e.manager_id);
        const m = byId.get(e.manager_id);
        if (!m) break;
        const a = acc.get(m.id);
        if (a && a !== accountId && !out.includes(a)) out.push(a);
        e = m;
      }
      return out;
    },
    descendantsOf(accountId) {
      const me = empOfAccount.get(accountId);
      if (!me) return [];
      const kids = new Map<string, EmpLite[]>();
      for (const e of emps) if (e.manager_id) kids.set(e.manager_id, [...(kids.get(e.manager_id) ?? []), e]);
      const out: string[] = [];
      const stack = [...(kids.get(me.id) ?? [])];
      const seen = new Set<string>([me.id]);
      while (stack.length) {
        const e = stack.pop()!;
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        const a = acc.get(e.id);
        if (a && a !== accountId) out.push(a);
        stack.push(...(kids.get(e.id) ?? []));
      }
      return out;
    },
  };
}

/** Active internal super admins of the tenant — the fallback reader when
 *  an author has no manager ("the owner"). */
export async function superAdminIds(tenantId: string | null): Promise<string[]> {
  let q = supabaseServer.from("accounts").select("id").eq("is_super_admin", true).eq("status", "active").eq("user_type", "internal").limit(20);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q;
  return ((data ?? []) as { id: string }[]).map((a) => a.id);
}

/** Who a new report of this type is addressed to before the author changes
 *  anything. Never the author themself. */
export async function defaultRecipients(tpl: ReportTemplateDef, auth: ServerAuthContext, tree?: OrgTree): Promise<string[]> {
  /* The writer picks (5A: a 1-on-1 goes to the person it was with). */
  if (tpl.recipients === "none") return [];
  const me = auth.account_id;
  const wantsManager = tpl.recipients === "manager" || tpl.recipients === "manager_hr";
  const wantsHr = tpl.recipients === "hr" || tpl.recipients === "manager_hr";
  const [chain, hr] = await Promise.all([
    wantsManager ? (tree ? Promise.resolve(tree) : loadOrgTree(auth.tenant_id)).then((t) => t.chainOf(me)) : Promise.resolve([] as string[]),
    wantsHr ? hrReviewerAccountIds(auth.tenant_id) : Promise.resolve([] as string[]),
  ]);
  const out = new Set<string>();
  if (wantsManager) {
    if (chain[0]) out.add(chain[0]);
    else for (const id of await superAdminIds(auth.tenant_id)) out.add(id);
  }
  for (const id of hr) out.add(id);
  out.delete(me);
  return Array.from(out);
}

export interface PersonLite { id: string; name: string; nameAlt: string | null; avatar: string | null; position: string | null }

/** The people a report can be sent to, with real names. */
export function listPeople(tenantId: string | null): Promise<PersonLite[]> {
  return memo(`people:${tenantId ?? "-"}`, async () => {
    const rows: AssignableEmployee[] = await listAssignableEmployees(tenantId).catch(() => []);
    return rows.map((r) => ({ id: r.account_id, name: r.full_name?.trim() || r.username, nameAlt: r.name_alt, avatar: r.avatar_url, position: r.position }));
  }, (v) => v.length > 0);
}

export async function loadRecipients(reportId: string): Promise<RecipientRow[]> {
  const { data, error } = await supabaseServer.from("work_report_recipients")
    .select("account_id, role, read_at, acknowledged_at").eq("report_id", reportId).order("created_at", { ascending: true });
  if (error) { console.error("[reports] recipients:", error.message); return []; }
  return (data ?? []) as RecipientRow[];
}

export interface LoadedReport { row: ReportRow; recipients: RecipientRow[]; access: Exclude<ReportAccess, null> }

/** The report, if THIS viewer may read it — otherwise null (the routes
 *  answer 404 either way, so a stranger cannot learn that it exists). */
export async function loadForViewer(id: string, auth: ServerAuthContext): Promise<LoadedReport | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  let q = supabaseServer.from("work_reports").select(REPORT_COLS).eq("id", id);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  /* The id is known, so the recipients load beside the report, not after it. */
  const [{ data, error }, recipients] = await Promise.all([q.maybeSingle(), loadRecipients(id)]);
  if (error) { console.error("[reports] load:", error.message); return null; }
  if (!data) return null;
  const row = data as ReportRow;
  const recipientIds = recipients.map((r) => r.account_id);
  const quick = { status: row.status, confidential: row.confidential, authorAccountId: row.author_account_id, recipientIds, managerChain: [] as string[] };
  const viewer = { accountId: auth.account_id, isSuperAdmin: !!auth.is_super_admin };
  let access = reportAccess(quick, viewer);
  /* The org walk only when it can change the answer. */
  if (!access && !row.confidential && row.status !== "draft") {
    const chain = (await loadOrgTree(auth.tenant_id)).chainOf(row.author_account_id);
    access = reportAccess({ ...quick, managerChain: chain }, viewer);
  }
  return access ? { row, recipients, access } : null;
}

export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
