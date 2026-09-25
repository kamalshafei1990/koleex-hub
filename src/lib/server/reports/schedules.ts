import "server-only";

/* ---------------------------------------------------------------------------
   Reports (server) — the drafts the system prepares on schedule (Phase 5D,
   owner's picks 26 Sep 2026). Run by /api/cron/report-reminders every 15
   minutes, after the events and the nudges:

     for each active schedule (a person × a weekly or monthly type)
       · the period that JUST ENDED, in the writer's own time — due from
         07:00 on the new period's first day (lib/reports/schedules)
       · once: the row is CLAIMED for that period before anything is written
         (last_period, set only if it still differs), so a second run — or a
         stranger calling the job while CRON_SECRET is unset — prepares
         nothing twice
       · only for someone who may start the type (canStartTemplate, read
         every time) and not for a built-in the company hid
       · the same draft "Write it" starts (lib/server/reports/drafts); if the
         writer already has one for that period — a draft or sent — nothing
         new is made and nothing is said
       · the writer is told once (report_scheduled), and the notice goes
         away when the report is sent or deleted

   Nothing is ever sent by itself. `dryRun` reads and plans only.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { ServerAuthContext } from "@/lib/server/auth";
import { canStartTemplate } from "@/lib/server/reports/core";
import { reportTemplate } from "@/lib/reports/catalog";
import { isCustomKey, snapshotOf, type TemplateSnapshot } from "@/lib/reports/custom-templates";
import { customAsTemplate, loadCustomTemplate, loadHiddenKeys } from "@/lib/server/reports/custom-templates";
import { insertDraft, periodReport } from "@/lib/server/reports/drafts";
import { loadPolicyRows, pickPolicy, resolveEmployeeCountries } from "@/lib/server/work-calendar";
import { notifyLite } from "@/lib/server/notify-lite";
import { localDayOf } from "@/lib/reports/obligations";
import { periodFor, type ReportTemplateDef } from "@/lib/reports/templates";
import { rangeLabel } from "@/lib/reports/team";
import { SCHEDULE_LIMITS, localMinutesOf, periodToPrepare, schedulable, type ScheduleRow } from "@/lib/reports/schedules";
import { reportsT } from "@/lib/translations/reports";

type Sched = { id: string; tenant_id: string | null; account_id: string; template_key: string; active: boolean; last_period: string | null; last_report_id: string | null };

/** A writer's context, as their own session would build it — for the
 *  checks and the draft only (never a session, never a view-as). Null for
 *  an account that is gone or not active. */
async function authForAccount(accountId: string): Promise<ServerAuthContext | null> {
  const [acc, emp] = await Promise.all([
    supabaseServer.from("accounts").select("id, username, login_email, status, user_type, tenant_id, role_id, is_super_admin, roles:role_id(is_super_admin, can_view_private)").eq("id", accountId).maybeSingle(),
    supabaseServer.from("koleex_employees").select("id, department").eq("account_id", accountId).maybeSingle(),
  ]);
  const a = acc.data as { id: string; username: string; login_email: string; status: string; user_type: string; tenant_id: string; role_id: string | null; is_super_admin: boolean | null; roles?: unknown } | null;
  if (!a || a.status !== "active") return null;
  const role = (Array.isArray(a.roles) ? a.roles[0] : a.roles) as { is_super_admin?: boolean; can_view_private?: boolean } | null | undefined;
  return {
    account_id: a.id, tenant_id: a.tenant_id, role_id: a.role_id,
    department: (emp.data as { department?: string | null } | null)?.department ?? null,
    is_super_admin: !!a.is_super_admin || !!role?.is_super_admin,
    can_view_private: !!role?.can_view_private,
    username: a.username, login_email: a.login_email, status: a.status, user_type: a.user_type,
    viewing_as: false, real_account_id: null, view_as_kind: null, view_as_role_id: null,
  };
}

/** A schedule's type: a built-in, or a builder type's current version
 *  (active only, the tenant's own) with its copy. */
async function typeOf(tenantId: string | null, key: string): Promise<{ tpl: ReportTemplateDef; snapshot: TemplateSnapshot | null } | null> {
  if (isCustomKey(key)) {
    const row = await loadCustomTemplate(tenantId, key).catch(() => null);
    if (!row || row.status !== "active") return null;
    return { tpl: customAsTemplate(row), snapshot: snapshotOf(row.def, row.words, row.version) };
  }
  const tpl = reportTemplate(key);
  return tpl ? { tpl, snapshot: null } : null;
}

/** Each writer's time zone: their country's attendance policy (the one the
 *  obligations read), the default policy's when none is known. */
async function zonesOf(accountIds: string[]): Promise<Map<string, string>> {
  const [policies, emps] = await Promise.all([
    loadPolicyRows(),
    supabaseServer.from("koleex_employees").select("id, account_id").in("account_id", accountIds.slice(0, SCHEDULE_LIMITS.perTenant)),
  ]);
  const empOf = new Map(((emps.data ?? []) as Array<{ id: string; account_id: string }>).map((e) => [e.account_id, e.id]));
  const countries = await resolveEmployeeCountries([...empOf.values()]);
  return new Map(accountIds.map((a) => [a, pickPolicy(policies, countries.get(empOf.get(a) ?? "") ?? null).timezone]));
}

export interface ScheduleRun { checked: number; prepared: Array<{ accountId: string; key: string; period: string; reportId: string | null }>; waiting: number; skipped: number }

/** `deadline` (epoch ms): no new row is started after it — the rest stay
 *  due and the next run prepares them; one cut off halfway would keep its
 *  claim with no draft. */
export async function runReportSchedules(opts: { now?: Date; dryRun?: boolean; tenantId?: string | null; deadline?: number } = {}): Promise<ScheduleRun> {
  const nowIso = (opts.now ?? new Date()).toISOString();
  let q = supabaseServer.from("work_report_schedules").select("id, tenant_id, account_id, template_key, active, last_period, last_report_id").eq("active", true).limit(SCHEDULE_LIMITS.perTenant * 4);
  if (opts.tenantId) q = q.eq("tenant_id", opts.tenantId);
  const { data, error } = await q;
  if (error) throw new Error(`schedules: ${error.message}`);
  const rows = (data ?? []) as Sched[];
  const out: ScheduleRun = { checked: rows.length, prepared: [], waiting: 0, skipped: 0 };
  if (!rows.length) return out;
  const zones = await zonesOf(Array.from(new Set(rows.map((r) => r.account_id))));
  const hiddenOf = new Map<string, Promise<string[]>>();
  const hidden = (t: string | null) => { const k = t ?? "-"; if (!hiddenOf.has(k)) hiddenOf.set(k, loadHiddenKeys(t).catch(() => [])); return hiddenOf.get(k)!; };

  for (const [i, r] of rows.entries()) {
    if (opts.deadline && Date.now() > opts.deadline) { out.waiting += rows.length - i; break; }
    try {
      const found = await typeOf(r.tenant_id, r.template_key);
      if (!found || !schedulable(found.tpl) || (!found.tpl.custom && (await hidden(r.tenant_id)).includes(found.tpl.key))) { out.skipped++; continue; }
      const { tpl, snapshot } = found;
      const tz = zones.get(r.account_id) ?? "UTC";
      const day = periodToPrepare(tpl.cadence, localDayOf(nowIso, tz), localMinutesOf(nowIso, tz));
      if (!day) { out.waiting++; continue; }
      const period = periodFor(tpl.cadence, day);
      if (r.last_period === period.key) continue;
      const auth = await authForAccount(r.account_id);
      if (!auth || !(await canStartTemplate(tpl, auth))) { out.skipped++; continue; }
      if (opts.dryRun) { out.prepared.push({ accountId: r.account_id, key: tpl.key, period: period.key, reportId: null }); continue; }

      /* Claim the period first: only the run that moves last_period prepares it. */
      let claim = supabaseServer.from("work_report_schedules").update({ last_period: period.key, updated_at: nowIso }).eq("id", r.id);
      claim = r.last_period === null ? claim.is("last_period", null) : claim.eq("last_period", r.last_period);
      const { data: won, error: cErr } = await claim.select("id");
      if (cErr) throw new Error(cErr.message);
      if (!won?.length) continue;

      const existing = await periodReport(auth, tpl.key, period.key);
      if (existing) {
        /* The writer already has it — a draft or sent: nothing new, nothing said. */
        await supabaseServer.from("work_report_schedules").update({ last_report_id: existing.id }).eq("id", r.id);
        continue;
      }
      const id = await insertDraft(auth, tpl, { start: period.start, end: period.end, key: period.key }, "", [], snapshot);
      if (!id) {
        /* Not written: give the period back, so the next run tries again. */
        await supabaseServer.from("work_report_schedules").update({ last_period: r.last_period }).eq("id", r.id).eq("last_period", period.key);
        continue;
      }
      await supabaseServer.from("work_report_schedules").update({ last_report_id: id }).eq("id", r.id);
      const type = tpl.custom ? (snapshot?.words.name?.en || tpl.key) : ((reportsT[`tpl.${tpl.key}.name`]?.en as string | undefined) ?? tpl.key);
      await notifyLite({
        tenantId: auth.tenant_id,
        recipients: [auth.account_id],
        tpl: { k: "report_scheduled", p: { type, period: rangeLabel(period.start, period.end) } },
        link: `/reports/${id}`,
        type: "report_scheduled",
        metadata: { source: "reports", report_id: id, template_key: tpl.key, period_key: period.key },
        tag: `report-scheduled:${id}`,
      });
      out.prepared.push({ accountId: r.account_id, key: tpl.key, period: period.key, reportId: id });
    } catch (e) {
      console.error("[reports] schedule:", r.id, e instanceof Error ? e.message : e);
      out.skipped++;
    }
  }
  return out;
}

/* ── The setup (the Compliance tab — a super admin or HR · edit) ─────── */

export async function loadSchedules(tenantId: string | null): Promise<ScheduleRow[]> {
  let q = supabaseServer.from("work_report_schedules").select("account_id, template_key, active, last_period, last_report_id").order("created_at", { ascending: true }).limit(SCHEDULE_LIMITS.perTenant);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ account_id: string; template_key: string; active: boolean; last_period: string | null; last_report_id: string | null }>)
    .map((r) => ({ accountId: r.account_id, templateKey: r.template_key, active: r.active, lastPeriod: r.last_period, lastReportId: r.last_report_id }));
}

/** Set one schedule: on or off, or removed. Only a schedulable type, only
 *  one of the tenant's own people (the route checks the person). */
export async function saveSchedule(auth: ServerAuthContext, s: { accountId: string; templateKey: string; active?: boolean; remove?: boolean }): Promise<"ok" | "bad_type"> {
  const found = await typeOf(auth.tenant_id, s.templateKey);
  if (!s.remove && (!found || !schedulable(found.tpl))) return "bad_type";
  if (s.remove) {
    let d = supabaseServer.from("work_report_schedules").delete().eq("account_id", s.accountId).eq("template_key", s.templateKey);
    if (auth.tenant_id) d = d.eq("tenant_id", auth.tenant_id);
    const { error } = await d;
    if (error) throw new Error(error.message);
    return "ok";
  }
  const now = new Date().toISOString();
  /* A new schedule starts with the NEXT period: the one that has just ended
     for the writer is counted as done, so no draft of a past period comes
     the moment a schedule is set (the first one comes when the current week
     or month ends). */
  const zone = (await zonesOf([s.accountId])).get(s.accountId) ?? "UTC";
  const cadence = found!.tpl.cadence;
  const due = periodToPrepare(cadence, localDayOf(now, zone), localMinutesOf(now, zone));
  const startAfter = due ? periodFor(cadence, due).key : null;
  /* Who first set it stays; who changed it last is stamped. */
  const { data: had, error: rErr } = await supabaseServer.from("work_report_schedules").select("id, active, last_period").eq("account_id", s.accountId).eq("template_key", s.templateKey).maybeSingle();
  if (rErr) throw new Error(rErr.message);
  const was = had as { id: string; active: boolean; last_period: string | null } | null;
  /* Switched back on after a pause: it starts again with the next period,
     like a new one — the periods it was off for are not prepared late. */
  const resumes = !!was && !was.active && s.active !== false && !!startAfter && was.last_period !== startAfter;
  const { error } = was
    ? await supabaseServer.from("work_report_schedules").update({ active: s.active !== false, ...(resumes ? { last_period: startAfter, last_report_id: null } : {}), updated_by: auth.account_id, updated_at: now }).eq("id", was.id)
    : await supabaseServer.from("work_report_schedules").insert({
      tenant_id: auth.tenant_id, account_id: s.accountId, template_key: s.templateKey, active: s.active !== false,
      last_period: startAfter, created_by: auth.account_id, updated_by: auth.account_id, updated_at: now,
    });
  if (error) throw new Error(error.message);
  return "ok";
}
