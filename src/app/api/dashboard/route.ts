import "server-only";

/* ---------------------------------------------------------------------------
   /api/dashboard — the Home dashboard's ONE request (P1 of the approved plan).

   Design contract (docs discussed 2026-08-20 with the owner):
   • ONE batched request per open — the client never fans out per widget
     (the batching law: /api/shell is the model).
   • Every widget is gated by the account's can_view on its owning module,
     server-side — the dashboard is automatically different per person.
   • Money is SA/whitelisted only; everyone else gets counts.
   • Answers are NEVER cacheable: no-store, because a dashboard that shows
     pre-save numbers after the operator just changed something is the exact
     bug family we closed in products (the HTTP-cache revert).
   • A provider that fails reports itself as failed — it must never be
     swallowed into a plausible zero (the series_cadence lesson).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, type ServerAuthContext } from "@/lib/server/auth";
import { openTodoItems } from "@/lib/todo-open-count";
import { isOpenAccessModule, PERMISSION_MODULES } from "@/lib/permission-modules";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

type Widget = Record<string, unknown> & { error?: string };

/* ── Permission gate, in bulk ──────────────────────────────────────────────
   The Dashboard app's catalog spans many modules, and requireModuleAction
   costs two DB round-trips PER module. One dashboard open must stay ONE
   cheap gateway hit, so the same semantics are evaluated here from two bulk
   reads: SA bypasses; a per-account override REPLACES the role's verdict in
   both directions; no row anywhere falls back to the registry's openAccess
   default; DB errors fail closed (grant nothing).

   The list covers EVERY governable app (PERMISSION_MODULES — derived from
   APP_REGISTRY), because the Widgets view offers a launcher card per app,
   not only the apps with data providers. */
const DASH_MODULES = PERMISSION_MODULES;

async function viewableModules(auth: ServerAuthContext): Promise<Set<string>> {
  if (auth.is_super_admin) return new Set(DASH_MODULES);
  const [perms, overrides] = await Promise.all([
    auth.role_id
      ? supabaseServer.from("koleex_permissions").select("module_name, can_view").eq("role_id", auth.role_id)
      : Promise.resolve({ data: [] as Array<{ module_name: string; can_view: boolean | null }>, error: null }),
    supabaseServer.from("account_permission_overrides").select("module_key, can_view").eq("account_id", auth.account_id),
  ]);
  if (perms.error || overrides.error) {
    console.error("[api/dashboard modules]", perms.error?.message ?? overrides.error?.message);
    return new Set();
  }
  const roleView = new Map<string, boolean>();
  for (const p of perms.data ?? []) {
    if (p.module_name) roleView.set(String(p.module_name).toLowerCase(), p.can_view === true);
  }
  const overrideView = new Map<string, boolean>();
  for (const o of overrides.data ?? []) {
    if (o.module_key && typeof o.can_view === "boolean") overrideView.set(String(o.module_key).toLowerCase(), o.can_view);
  }
  const out = new Set<string>();
  for (const m of DASH_MODULES) {
    const key = m.toLowerCase();
    const ov = overrideView.get(key);
    const allowed = typeof ov === "boolean"
      ? ov
      : roleView.has(key)
        ? roleView.get(key) === true
        : isOpenAccessModule(m);
    if (allowed) out.add(m);
  }
  return out;
}

/* ── Quotations: pipeline + open value + expiring ─────────────────────── */
const PERIODS = { today: 1, week: 7, month: 31, quarter: 92 } as const;
type Period = keyof typeof PERIODS;

async function quotationsWidget(showMoney: boolean, period: Period): Promise<Widget> {
  const { data, error } = await supabaseServer
    .from("quotations")
    .select("status, total, valid_till, updated_at, created_at, quote_no, customer:customer_id ( name, company_name )");
  if (error) return { error: error.message };
  const rows = data ?? [];
  const stages: Record<string, number> = {};
  let openCount = 0;
  let openValue = 0;
  let expiringSoon = 0;
  let wonValueMtd = 0;
  const now = Date.now();
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const periodStart = period === "today"
    ? new Date(new Date().setHours(0, 0, 0, 0))
    : new Date(now - PERIODS[period] * DAY_MS);
  let createdInPeriod = 0;
  let wonValueInPeriod = 0;
  for (const r of rows) {
    const st = (r.status || "draft").toLowerCase();
    stages[st] = (stages[st] ?? 0) + 1;
    const isClosed = st === "won" || st === "lost" || st === "expired" || st === "cancelled";
    if (!isClosed) {
      openCount++;
      openValue += Number(r.total) || 0;
      if (r.valid_till) {
        const t = new Date(r.valid_till).getTime();
        if (t > now && t - now < 7 * DAY_MS) expiringSoon++;
      }
    }
    if (st === "won" && r.updated_at && new Date(r.updated_at) >= monthStart) {
      wonValueMtd += Number(r.total) || 0;
    }
    if (r.created_at && new Date(r.created_at) >= periodStart) createdInPeriod++;
    if (st === "won" && r.updated_at && new Date(r.updated_at) >= periodStart) {
      wonValueInPeriod += Number(r.total) || 0;
    }
  }
  /* 12-week creation series — the hero curve is REAL shape, not decor.
     Bucket by weeks-ago so the newest bucket is the last point. */
  const series = new Array<number>(12).fill(0);
  for (const r of rows) {
    if (!r.created_at) continue;
    const weeksAgo = Math.floor((now - new Date(r.created_at).getTime()) / (7 * DAY_MS));
    if (weeksAgo >= 0 && weeksAgo < 12) series[11 - weeksAgo]++;
  }
  /* The "Expiring soon" LIST card: open quotes with a future valid_till,
     soonest first. The embed arrives as an object (FK single-row). */
  type CustEmbed = { name?: string | null; company_name?: string | null } | null;
  const expiring = rows
    .filter((r) => {
      const st = (r.status || "draft").toLowerCase();
      const isClosed = st === "won" || st === "lost" || st === "expired" || st === "cancelled";
      return !isClosed && r.valid_till && new Date(r.valid_till).getTime() > now;
    })
    .sort((a, b) => new Date(a.valid_till as string).getTime() - new Date(b.valid_till as string).getTime())
    .slice(0, 5)
    .map((r) => {
      const c = r.customer as CustEmbed;
      return {
        no: r.quote_no ?? "—",
        name: c?.company_name || c?.name || "—",
        days: Math.ceil((new Date(r.valid_till as string).getTime() - now) / DAY_MS),
      };
    });
  return {
    openCount, expiringSoon, stages, series, createdInPeriod, period, expiring,
    ...(showMoney ? { openValue: Math.round(openValue), wonValueMtd: Math.round(wonValueMtd), wonValueInPeriod: Math.round(wonValueInPeriod) } : {}),
  };
}

/* ── Products: catalogue health ───────────────────────────────────────── */
async function productsWidget(): Promise<Widget> {
  const { data, error } = await supabaseServer
    .from("products")
    .select("product_name, status, updated_at");
  if (error) return { error: error.message };
  const rows = data ?? [];
  const total = rows.length;
  let active = 0, draft = 0, draftAging = 0;
  const now = Date.now();
  const draftRows: Array<{ name: string; days: number }> = [];
  for (const r of rows) {
    const st = (r.status || "draft").toLowerCase();
    if (st === "active") active++;
    else if (st === "draft") {
      draft++;
      const age = r.updated_at ? now - new Date(r.updated_at).getTime() : 0;
      if (age > 14 * DAY_MS) draftAging++;
      draftRows.push({ name: r.product_name || "—", days: Math.floor(age / DAY_MS) });
    }
  }
  /* The "Oldest drafts" LIST card — the stalest first. */
  const drafts = draftRows.sort((a, b) => b.days - a.days).slice(0, 5);
  return { total, active, draft, draftAging, drafts };
}

/* ── To-do: the operator's own open items — THE one shared definition ── */
async function todoWidget(auth: ServerAuthContext): Promise<Widget> {
  try {
    /* The list card and the count come from THE SAME set — one definition,
       so the badge and the list can never disagree. */
    const items = await openTodoItems(supabaseServer, auth.account_id, auth.tenant_id);
    items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return { open: items.length, items: items.slice(0, 5).map((i) => ({ title: i.title })) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "todo count failed" };
  }
}

/* ── Customers: growth + the newest arrivals (follow_up_date lives on the
     CONTACTS table, not customers — a follow-ups card belongs to a later
     wave; this one only claims what the customers table really holds) ──── */
async function customersWidget(auth: ServerAuthContext): Promise<Widget> {
  let q = supabaseServer.from("customers").select("name, company_name, created_at");
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data, error } = await q;
  if (error) return { error: error.message };
  const rows = data ?? [];
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const now = Date.now();
  let newThisMonth = 0;
  for (const r of rows) {
    if (r.created_at && new Date(r.created_at) >= monthStart) newThisMonth++;
  }
  const latest = rows
    .filter((r) => r.created_at)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 5)
    .map((r) => ({
      name: r.company_name || r.name || "—",
      days: Math.floor((now - new Date(r.created_at as string).getTime()) / DAY_MS),
    }));
  return { total: rows.length, newThisMonth, latest };
}

/* ── Presence: who is active today + hours (reuses usage_daily — no new
     pollers, the concurrency policy stays intact) ──────────────────────── */
const SERVICE_ACCOUNTS = new Set(["approvals-actor", "qfix-actor", "exp-unmatched"]);
async function presenceWidget(): Promise<Widget> {
  const today = new Date().toISOString().slice(0, 10);
  const [usage, accounts] = await Promise.all([
    supabaseServer.from("usage_daily").select("account_id, active_seconds").eq("day", today),
    supabaseServer.from("accounts").select("id, username, avatar_url").eq("status", "active").eq("user_type", "internal"),
  ]);
  if (usage.error) return { error: usage.error.message };
  if (accounts.error) return { error: accounts.error.message };
  const team = (accounts.data ?? []).filter((a) => !SERVICE_ACCOUNTS.has(a.username));
  const teamIds = new Set(team.map((a) => a.id));
  let secs = 0;
  const activeIds = new Set<string>();
  for (const u of usage.data ?? []) {
    if (!teamIds.has(u.account_id)) continue;
    const s = Number(u.active_seconds) || 0;
    if (s > 0) { activeIds.add(u.account_id); secs += s; }
  }
  /* the avatar row: active people first, then the rest */
  const people = team
    .map((a) => ({
      name: a.username,
      initials: a.username.slice(0, 2).toUpperCase(),
      avatar: a.avatar_url || null,
      active: activeIds.has(a.id),
    }))
    .sort((a, b) => Number(b.active) - Number(a.active));
  return { activeToday: activeIds.size, teamSize: team.length, hoursToday: Math.round(secs / 360) / 10, people };
}

/* ═══ THE WIDE PROVIDER SET (owner: "all cards as much as can and for all
   apps") — one small, cheap provider per app, all in the ONE request, each
   gated by its module's can_view. Column names verified against each app's
   own API route before use; a wrong one self-reports, never silent-zeros. ═══ */

function monthStart(): Date {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
}

/* Invoices: unpaid + overdue (balance/total are money — SA only) */
async function invoicesWidget(auth: ServerAuthContext, showMoney: boolean): Promise<Widget> {
  let q = supabaseServer.from("invoices").select("inv_no, status, total, balance, due_date, customer:customer_id ( name, company_name )");
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data, error } = await q;
  if (error) return { error: error.message };
  const rows = data ?? [];
  const now = Date.now();
  type Cust = { name?: string | null; company_name?: string | null } | null;
  let unpaidCount = 0, unpaidBalance = 0;
  const overdue: Array<{ no: string; name: string; days: number }> = [];
  for (const r of rows) {
    const bal = Number(r.balance) || 0;
    if (bal <= 0) continue;
    unpaidCount++; unpaidBalance += bal;
    if (r.due_date && new Date(r.due_date).getTime() < now) {
      const c = r.customer as Cust;
      overdue.push({ no: r.inv_no ?? "—", name: c?.company_name || c?.name || "—", days: Math.floor((now - new Date(r.due_date).getTime()) / DAY_MS) });
    }
  }
  overdue.sort((a, b) => b.days - a.days);
  return { total: rows.length, unpaidCount, overdue: overdue.slice(0, 5), ...(showMoney ? { unpaidBalance: Math.round(unpaidBalance) } : {}) };
}

/* CRM: opportunities + closes due soonest */
async function crmWidget(auth: ServerAuthContext, showMoney: boolean): Promise<Widget> {
  let q = supabaseServer.from("crm_opportunities").select("name, expected_revenue, expected_close_date, created_at");
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data, error } = await q;
  if (error) return { error: error.message };
  const rows = data ?? [];
  const now = Date.now();
  let pipeline = 0;
  for (const r of rows) pipeline += Number(r.expected_revenue) || 0;
  const closing = rows
    .filter((r) => r.expected_close_date)
    .map((r) => ({ name: r.name || "—", days: Math.ceil((new Date(r.expected_close_date as string).getTime() - now) / DAY_MS) }))
    .filter((r) => r.days > -30)
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);
  return { open: rows.length, closing, ...(showMoney ? { pipelineValue: Math.round(pipeline) } : {}) };
}

/* Purchases: PO count + the latest, with their status */
async function purchasesWidget(auth: ServerAuthContext): Promise<Widget> {
  /* count:"exact" rides the same query — `rows.length` under a limit() would
     report the CAP as the total, which is a lie */
  let q = supabaseServer.from("purchase_orders")
    .select("po_no, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false }).limit(5);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data, error, count } = await q;
  if (error) return { error: error.message };
  const now = Date.now();
  const latest = (data ?? []).map((r) => ({
    name: `${r.po_no ?? "—"} · ${(r.status ?? "").toString().toUpperCase()}`,
    days: r.created_at ? Math.floor((now - new Date(r.created_at).getTime()) / DAY_MS) : 0,
  }));
  return { total: count ?? 0, latest };
}

/* Suppliers: how many + the newest */
async function suppliersWidget(auth: ServerAuthContext): Promise<Widget> {
  /* suppliers are CONTACTS with contact_type=supplier (the identity
     architecture: contacts is the source of truth; "suppliers" is a lens) */
  let q = supabaseServer.from("contacts")
    .select("company_name_en, company_name_cn, display_name, created_at", { count: "exact" })
    .eq("contact_type", "supplier")
    .order("created_at", { ascending: false }).limit(5);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data, error, count } = await q;
  if (error) return { error: error.message };
  const now = Date.now();
  const newest = (data ?? []).map((r) => ({
    name: r.display_name || r.company_name_en || r.company_name_cn || "—",
    days: r.created_at ? Math.floor((now - new Date(r.created_at).getTime()) / DAY_MS) : 0,
  }));
  return { total: count ?? 0, newest };
}

/* Contacts: counts only — the list payload rule keeps blobs (and rows) out */
async function contactsWidget(auth: ServerAuthContext): Promise<Widget> {
  let base = supabaseServer.from("contacts").select("id", { count: "exact", head: true });
  if (auth.tenant_id) base = base.eq("tenant_id", auth.tenant_id);
  let recent = supabaseServer.from("contacts").select("id", { count: "exact", head: true }).gte("created_at", monthStart().toISOString());
  if (auth.tenant_id) recent = recent.eq("tenant_id", auth.tenant_id);
  const [t, m] = await Promise.all([base, recent]);
  if (t.error) return { error: t.error.message };
  if (m.error) return { error: m.error.message };
  return { total: t.count ?? 0, newThisMonth: m.count ?? 0 };
}

/* Projects: count + nearest planned ends */
async function projectsWidget(auth: ServerAuthContext): Promise<Widget> {
  let q = supabaseServer.from("projects").select("name, status, planned_end");
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data, error } = await q;
  if (error) return { error: error.message };
  const rows = data ?? [];
  const now = Date.now();
  const deadlines = rows
    .filter((r) => r.planned_end)
    .map((r) => ({ name: r.name || "—", days: Math.ceil((new Date(r.planned_end as string).getTime() - now) / DAY_MS) }))
    .filter((r) => r.days > -60)
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);
  return { total: rows.length, deadlines };
}

/* Calendar: MY upcoming one-off events + how many active series.
   (Recurring occurrences render via the calendar's own expansion — series
   are COUNTED here, honestly, rather than pretended into the list.) */
async function calendarWidget(auth: ServerAuthContext): Promise<Widget> {
  const nowIso = new Date().toISOString();
  const [oneOff, series] = await Promise.all([
    supabaseServer.from("koleex_calendar_events")
      .select("title, start_at").eq("account_id", auth.account_id)
      .is("recurrence", null).gte("start_at", nowIso)
      .order("start_at", { ascending: true }).limit(5),
    supabaseServer.from("koleex_calendar_events")
      .select("id", { count: "exact", head: true })
      .eq("account_id", auth.account_id).not("recurrence", "is", null),
  ]);
  if (oneOff.error) return { error: oneOff.error.message };
  if (series.error) return { error: series.error.message };
  const now = Date.now();
  const upcoming = (oneOff.data ?? []).map((r) => ({
    name: r.title || "—",
    days: Math.max(0, Math.ceil((new Date(r.start_at as string).getTime() - now) / DAY_MS)),
  }));
  return { upcoming, seriesCount: series.count ?? 0 };
}

/* Notes: my recent notes */
async function notesWidget(auth: ServerAuthContext): Promise<Widget> {
  const { data, error, count } = await supabaseServer.from("notes")
    .select("title, updated_at", { count: "exact" })
    .eq("account_id", auth.account_id).is("deleted_at", null)
    .order("updated_at", { ascending: false }).limit(5);
  if (error) return { error: error.message };
  const now = Date.now();
  const recent = (data ?? []).map((r) => ({
    name: r.title || "Untitled",
    days: r.updated_at ? Math.floor((now - new Date(r.updated_at).getTime()) / DAY_MS) : 0,
  }));
  return { total: count ?? 0, recent };
}

/* Documents: a count is real; column names for a list are not verified */
async function documentsWidget(auth: ServerAuthContext): Promise<Widget> {
  let q = supabaseServer.from("documents").select("id", { count: "exact", head: true });
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { count, error } = await q;
  if (error) return { error: error.message };
  return { total: count ?? 0 };
}

/* Expenses: this month + unpaid (amounts are money — SA only) */
async function expensesWidget(auth: ServerAuthContext, showMoney: boolean): Promise<Widget> {
  let q = supabaseServer.from("finance_expenses").select("amount, expense_date, payment_status");
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data, error } = await q;
  if (error) return { error: error.message };
  const rows = data ?? [];
  const ms = monthStart().getTime();
  let monthCount = 0, monthTotal = 0, unpaid = 0;
  for (const r of rows) {
    if (r.expense_date && new Date(r.expense_date).getTime() >= ms) { monthCount++; monthTotal += Number(r.amount) || 0; }
    if ((r.payment_status ?? "").toString().toLowerCase() !== "paid") unpaid++;
  }
  return { monthCount, unpaid, ...(showMoney ? { monthTotal: Math.round(monthTotal) } : {}) };
}

/* Employees: headcount + departments */
async function employeesWidget(): Promise<Widget> {
  const { data, error } = await supabaseServer.from("koleex_employees").select("department");
  if (error) return { error: error.message };
  const rows = data ?? [];
  const departments = new Set(rows.map((r) => r.department).filter(Boolean)).size;
  return { headcount: rows.length, departments };
}

/* Issue Reports: open issues (resolved_at empty) */
async function issuesWidget(auth: ServerAuthContext): Promise<Widget> {
  let q = supabaseServer.from("qa_issue_reports")
    .select("title, severity, created_at", { count: "exact" })
    .is("resolved_at", null).order("created_at", { ascending: false }).limit(5);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data, error, count } = await q;
  if (error) return { error: error.message };
  const open = (data ?? []).map((r) => ({
    name: r.title || "—",
    tag: (r.severity ?? "").toString().toUpperCase(),
  }));
  return { openCount: count ?? 0, open };
}

/* Visual Library (Database app): asset counts */
async function libraryWidget(): Promise<Widget> {
  const [t, m] = await Promise.all([
    supabaseServer.from("visual_assets").select("id", { count: "exact", head: true }),
    supabaseServer.from("visual_assets").select("id", { count: "exact", head: true }).gte("created_at", monthStart().toISOString()),
  ]);
  if (t.error) return { error: t.error.message };
  if (m.error) return { error: m.error.message };
  return { total: t.count ?? 0, newThisMonth: m.count ?? 0 };
}

/* Mail: my unread (the inbox feed's own definition: unread, unarchived) */
async function mailWidget(auth: ServerAuthContext): Promise<Widget> {
  const { count, error } = await supabaseServer.from("inbox_messages")
    .select("*", { count: "exact", head: true })
    .eq("recipient_account_id", auth.account_id)
    .is("read_at", null).is("archived_at", null);
  if (error) return { error: error.message };
  return { unread: count ?? 0 };
}

/* Knowledge: how many knowledge units the AI can stand on */
async function knowledgeWidget(): Promise<Widget> {
  const { count, error } = await supabaseServer.from("ai_knowledge_units").select("id", { count: "exact", head: true });
  if (error) return { error: error.message };
  return { units: count ?? 0 };
}

/* ── System strip: only numbers that are REAL — gateway latency, pending
     membership reviews, delivery errors today. SA-only. ─────────────────── */
async function systemWidget(): Promise<Widget> {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const [pending, errs] = await Promise.all([
    supabaseServer.from("membership_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabaseServer.from("notification_logs").select("id", { count: "exact", head: true })
      .eq("status", "error").gte("created_at", dayStart.toISOString()),
  ]);
  if (pending.error) return { error: pending.error.message };
  if (errs.error) return { error: errs.error.message };
  return { pendingMembership: pending.count ?? 0, notifyErrorsToday: errs.count ?? 0 };
}

export async function GET(req: Request) {
  const t0 = Date.now();
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  /* Money visibility: SA only for now — widening it later is a whitelist
     entry here, not a UI change (enforced server-side on purpose). */
  const showMoney = auth.is_super_admin === true;

  const url = new URL(req.url);
  const rawPeriod = url.searchParams.get("period") ?? "month";
  const period: Period = rawPeriod in PERIODS ? (rawPeriod as Period) : "month";

  const mods = await viewableModules(auth);
  const iff = <T,>(cond: boolean, fn: () => Promise<T>): Promise<T | null> =>
    cond ? fn() : Promise.resolve(null);

  const [
    quotations, products, todo, customers, presence, system,
    invoices, crm, purchases, suppliers, contacts, projects,
    calendar, notes, documents, expenses, employees, issues,
    library, mail, knowledge,
  ] = await Promise.all([
    iff(mods.has("Quotations"), () => quotationsWidget(showMoney, period)),
    iff(mods.has("Products"), () => productsWidget()),
    iff(mods.has("To-do"), () => todoWidget(auth)),
    iff(mods.has("Customers"), () => customersWidget(auth)),
    iff(mods.has("Management"), () => presenceWidget()),
    iff(auth.is_super_admin === true, () => systemWidget()),
    iff(mods.has("Invoices"), () => invoicesWidget(auth, showMoney)),
    iff(mods.has("CRM"), () => crmWidget(auth, showMoney)),
    iff(mods.has("Purchases"), () => purchasesWidget(auth)),
    iff(mods.has("Suppliers"), () => suppliersWidget(auth)),
    iff(mods.has("Contacts"), () => contactsWidget(auth)),
    iff(mods.has("Projects"), () => projectsWidget(auth)),
    iff(mods.has("Calendar"), () => calendarWidget(auth)),
    iff(mods.has("Notes"), () => notesWidget(auth)),
    iff(mods.has("Documents"), () => documentsWidget(auth)),
    iff(mods.has("Expenses"), () => expensesWidget(auth, showMoney)),
    iff(mods.has("Employees"), () => employeesWidget()),
    iff(mods.has("Issue Reports"), () => issuesWidget(auth)),
    iff(mods.has("Database"), () => libraryWidget()),
    iff(mods.has("Mail"), () => mailWidget(auth)),
    iff(mods.has("Knowledge"), () => knowledgeWidget()),
  ]);

  return NextResponse.json(
    {
      widgets: {
        quotations, products, todo, customers, presence, system,
        invoices, crm, purchases, suppliers, contacts, projects,
        calendar, notes, documents, expenses, employees, issues,
        library, mail, knowledge,
      },
      /* the client's catalog filter: a widget renders ONLY when its owning
         module is in this list — the dashboard is different per person */
      modules: [...mods],
      isSuperAdmin: auth.is_super_admin === true,
      showMoney, period, gatewayMs: Date.now() - t0, ts: Date.now(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
