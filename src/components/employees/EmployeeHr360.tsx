"use client";

/* ---------------------------------------------------------------------------
   EmployeeHr360 — the HR half of the employee profile (HR plan Phase E).

   The profile used to stop at "HR Details" (bank, IDs, visa). Everything HR
   knows about a person — leave, attendance, pay, documents, reviews — lived
   only inside the HR app behind a filter. These tabs put it on the person's
   own page, read through the same HR client functions (so the viewer needs
   HR·view, exactly as in the HR app) and the same server-derived sheet and
   payslips the HR app shows. Nothing is written from here; every row links
   into the app that owns it.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { hrT } from "@/lib/translations/hr";
import {
  fetchLeaveRequests, fetchLeaveBalances, fetchLeaveTypes, fetchAttendanceSheet, fetchSalaryRecords, fetchPayslips,
  fetchHrDocuments, fetchAppraisals, fetchAppraisalCycles,
  type LeaveRequestWithName, type SalaryRecordWithName, type PayslipWithName, type AttendanceSheet,
} from "@/lib/hr-admin";
import type { LeaveBalanceRow, LeaveTypeRow, HrDocumentRow, AppraisalCycleRow } from "@/types/supabase";
import { resolveHrFileUrl } from "@/components/hr/HrFileField";
import {
  cardCls, fmtDate, fmtTime, StatusBadge, EmptyState, makeTranslationHelpers,
  LEAVE_STATUS_MAP, ATTENDANCE_STATUS_MAP, PAYSLIP_STATUS_MAP, DOC_CATEGORY_MAP,
} from "@/components/hr/shared";
import CalendarPlusIcon from "@/components/icons/ui/CalendarPlusIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import WalletIcon from "@/components/icons/ui/WalletIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import StarIcon from "@/components/icons/ui/StarIcon";
import PrinterIcon from "@/components/icons/ui/PrinterIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import ArrowRightIcon from "@/components/icons/ui/ArrowRightIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

export type Hr360Tab = "leave" | "attendance" | "payroll" | "documents" | "reviews";
export const HR360_TABS: Hr360Tab[] = ["leave", "attendance", "payroll", "documents", "reviews"];

const num = (n: number | null | undefined, d = 2) => (n === null || n === undefined ? "—" : new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n));
const shiftMonth = (ym: string, by: number) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + by, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const Head = ({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--border-subtle)]">
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{children}</h3>
    {aside}
  </div>
);
const Spinner = () => <div className="flex items-center justify-center py-12"><SpinnerIcon size={20} className="text-[var(--text-dim)]" /></div>;

/* ── Leave ── */
function LeaveTab({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation(hrT);
  const { tLeaveType, tStatus } = makeTranslationHelpers(t);
  const [data, setData] = useState<{ requests: LeaveRequestWithName[]; balances: (LeaveBalanceRow & { leave_type_name: string })[]; types: LeaveTypeRow[] } | null>(null);
  useEffect(() => {
    let c = false;
    const year = new Date().getFullYear();
    Promise.all([fetchLeaveRequests({ employee_id: employeeId }), fetchLeaveBalances(employeeId, year), fetchLeaveTypes()])
      .then(([requests, balances, types]) => { if (!c) setData({ requests, balances, types }); });
    return () => { c = true; };
  }, [employeeId]);
  if (!data) return <Spinner />;
  const codeOf = (typeId: string) => data.types.find((x) => x.id === typeId)?.code ?? null;
  return (
    <div className="space-y-4">
      {data.balances.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {data.balances.map((b) => (
            <div key={b.id} className={`${cardCls} p-4`}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] truncate">{tLeaveType(b.leave_type_name, codeOf(b.leave_type_id))}</div>
              <div className="mt-1 text-[22px] font-bold tabular-nums text-[var(--text-primary)]">{num(b.entitled + b.carried_over + b.adjustment - b.used, 1)}</div>
              <div className="text-[12px] text-[var(--text-dim)] tabular-nums">{t("hr.used")} {num(b.used, 1)} / {num(b.entitled + b.carried_over + b.adjustment, 1)}</div>
            </div>
          ))}
        </div>
      )}
      <section className={`${cardCls} overflow-hidden`}>
        <Head aside={<Link href={`/hr?tab=leave`} className="text-[12px] font-medium text-[#0066FF]">{t("hr.leaveRequests")} →</Link>}>{t("hr.leaveRequests")}</Head>
        {data.requests.length === 0 ? <EmptyState icon={CalendarPlusIcon} title={t("hr.noLeaveRequests")} /> : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {data.requests.map((r) => (
              <li key={r.id} className="px-5 py-3 flex items-center gap-3 text-[13px]">
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-[var(--text-primary)]">{tLeaveType(r.leave_type_name, r.leave_type_code)}</span>
                  <span className="text-[var(--text-dim)] tabular-nums"> · {fmtDate(r.start_date)}{r.start_date !== r.end_date ? ` → ${fmtDate(r.end_date)}` : ""} · {r.days} {r.days === 1 ? t("hr.day") : t("hr.days")}</span>
                  {r.reason && <div className="text-[12px] text-[var(--text-dim)] truncate">{r.reason}</div>}
                </div>
                <StatusBadge status={r.status} map={LEAVE_STATUS_MAP} label={tStatus(r.status)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ── Attendance ── */
function AttendanceTab({ employeeId }: { employeeId: string }) {
  const { t, lang } = useTranslation(hrT);
  const { tStatus } = makeTranslationHelpers(t);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [fetched, setFetched] = useState<AttendanceSheet | null>(null);
  useEffect(() => {
    let c = false;
    fetchAttendanceSheet(employeeId, month).then((s) => { if (!c && s) setFetched(s); });
    return () => { c = true; };
  }, [employeeId, month]);
  const sheet = fetched && fetched.month === month ? fetched : null;
  const title = (() => { const [y, m] = month.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString(lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-EG" : "en-GB", { month: "long", year: "numeric" }); })();
  const s = sheet?.summary;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {([["hr.att.workdays", s?.workdays], ["hr.att.presentDays", s?.present], ["hr.att.lateDays", s?.late], ["hr.att.absentDays", s?.absent], ["hr.att.leaveDays", s?.leave], ["hr.att.hours", s ? `${num(s.hours, 1)} h` : undefined]] as Array<[string, number | string | undefined]>).map(([k, v]) => (
          <div key={k} className={`${cardCls} px-3 py-2`}><div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)] truncate">{t(k)}</div><div className="text-[17px] font-semibold tabular-nums text-[var(--text-primary)]">{v ?? "—"}</div></div>
        ))}
      </div>
      <section className={`${cardCls} overflow-hidden`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:bg-[var(--bg-surface)]" aria-label="Previous month"><ArrowLeftIcon size={14} className="rtl:rotate-180" /></button>
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</span>
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, 1))} className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:bg-[var(--bg-surface)]" aria-label="Next month"><ArrowRightIcon size={14} className="rtl:rotate-180" /></button>
        </div>
        {!sheet ? <Spinner /> : (
          <ul className="divide-y divide-[var(--border-subtle)] max-h-[50vh] overflow-y-auto">
            {sheet.days.map((d) => (
              <li key={d.date} className={`grid grid-cols-[1fr_auto] md:grid-cols-[140px_1fr_1fr_1fr_auto] items-center gap-3 px-4 py-2 text-[13px] ${d.status === "weekend" || d.status === "holiday" ? "opacity-60" : ""}`}>
                <span className="font-medium text-[var(--text-primary)] tabular-nums">{fmtDate(d.date)}</span>
                <span className="hidden md:block text-[var(--text-secondary)] tabular-nums">{d.clockIn ? fmtTime(d.clockIn) : d.note ?? ""}{d.lateMin > 0 ? <span className="text-amber-400"> +{d.lateMin}m</span> : null}</span>
                <span className="hidden md:block text-[var(--text-secondary)] tabular-nums">{d.clockOut ? fmtTime(d.clockOut) : ""}</span>
                <span className="hidden md:block text-[var(--text-secondary)] tabular-nums">{d.hours !== null ? `${num(d.hours, 1)} h` : ""}</span>
                <span className="justify-self-end">{d.status !== "future" && <StatusBadge status={d.status} map={ATTENDANCE_STATUS_MAP} label={tStatus(d.status)} />}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ── Payroll ── */
function PayrollTab({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation(hrT);
  const { tStatus } = makeTranslationHelpers(t);
  const [data, setData] = useState<{ salary: SalaryRecordWithName[]; payslips: PayslipWithName[] } | null>(null);
  useEffect(() => {
    let c = false;
    Promise.all([fetchSalaryRecords(employeeId), fetchPayslips({ employee_id: employeeId })]).then(([salary, payslips]) => { if (!c) setData({ salary, payslips }); });
    return () => { c = true; };
  }, [employeeId]);
  if (!data) return <Spinner />;
  const current = data.salary.find((s) => !s.effective_to) ?? data.salary[0] ?? null;
  return (
    <div className="space-y-4">
      <section className={`${cardCls} overflow-hidden`}>
        <Head aside={<Link href="/hr?tab=payroll" className="text-[12px] font-medium text-[#0066FF]">{t("hr.payroll")} →</Link>}>{t("hr.salaryRegister")}</Head>
        {data.salary.length === 0 ? <EmptyState icon={WalletIcon} title={t("hr.noSalaryRecords")} /> : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {data.salary.map((s) => (
              <li key={s.id} className="px-5 py-3 flex items-center justify-between gap-3 text-[13px]">
                <div>
                  <div className={`font-semibold tabular-nums ${s.id === current?.id ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>{s.currency} {num(s.base_salary)} <span className="text-[12px] font-normal text-[var(--text-dim)]">/ {s.pay_frequency}</span></div>
                  <div className="text-[12px] text-[var(--text-dim)] tabular-nums">{fmtDate(s.effective_from)} → {s.effective_to ? fmtDate(s.effective_to) : "…"}</div>
                </div>
                {s.id === current?.id && <span className="text-[11px] font-medium text-[#0066FF]">{t("hr.status.active")}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={`${cardCls} overflow-hidden`}>
        <Head>{t("hr.payslips")}</Head>
        {data.payslips.length === 0 ? <EmptyState icon={WalletIcon} title={t("hr.noPayslips")} /> : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {data.payslips.map((p) => (
              <li key={p.id} className="px-5 py-3 grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 text-[13px]">
                <span className="tabular-nums text-[var(--text-primary)]">{fmtDate(p.period_start)} → {fmtDate(p.period_end)}</span>
                <span className="font-semibold tabular-nums text-[var(--text-primary)]">{num(p.net_amount)}</span>
                <StatusBadge status={p.status} map={PAYSLIP_STATUS_MAP} label={tStatus(p.status)} />
                <a href={`/payslips/${p.id}/print?auto=1`} target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]" aria-label={t("hr.pay.print")} title={t("hr.pay.print")}><PrinterIcon size={14} /></a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ── Documents ── */
function DocumentsTab({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation(hrT);
  const { tCat } = makeTranslationHelpers(t);
  const [docs, setDocs] = useState<HrDocumentRow[] | null>(null);
  useEffect(() => { let c = false; fetchHrDocuments(employeeId).then((d) => { if (!c) setDocs(d); }); return () => { c = true; }; }, [employeeId]);
  const open = async (v: string) => { const url = await resolveHrFileUrl(v); if (url) window.open(url, "_blank", "noopener,noreferrer"); };
  if (!docs) return <Spinner />;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <section className={`${cardCls} overflow-hidden`}>
      <Head aside={<Link href="/hr?tab=documents" className="text-[12px] font-medium text-[#0066FF]">{t("hr.documents")} →</Link>}>{t("hr.documents")}</Head>
      {docs.length === 0 ? <EmptyState icon={DocumentIcon} title={t("hr.noDocuments")} /> : (
        <ul className="divide-y divide-[var(--border-subtle)]">
          {docs.map((d) => (
            <li key={d.id} className="px-5 py-3 flex items-center gap-3 text-[13px]">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-[var(--text-primary)] truncate">{d.name}</div>
                <div className="flex items-center gap-2 mt-0.5"><StatusBadge status={d.category} map={DOC_CATEGORY_MAP} label={tCat(d.category)} />{d.expiry_date && <span className={`text-[12px] tabular-nums ${d.expiry_date < today ? "text-[#FF3333]" : "text-[var(--text-dim)]"}`}>{t("hr.expires")} {fmtDate(d.expiry_date)}</span>}</div>
              </div>
              <button type="button" onClick={() => open(d.file_url)} className="text-[12px] font-medium text-[#0066FF]">{t("hr.me.view")}</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ── Reviews — ONE timeline for appraisals, skills re-assessments and behavior assessments ── */
interface ReviewEvent { date: string; kind: "appraisal" | "skills" | "behavior"; title: string; detail: string; status: string | null; href: string }
function ReviewsTab({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation(hrT);
  const { tStatus } = makeTranslationHelpers(t);
  const [events, setEvents] = useState<ReviewEvent[] | null>(null);
  useEffect(() => {
    let c = false;
    (async () => {
      const [appraisals, cycles, skillsRes, behaviorRes] = await Promise.all([
        fetchAppraisals(), fetchAppraisalCycles(),
        fetch(`/api/hr/skills?employee_id=${employeeId}`, { credentials: "include" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`/api/hr/behavior?employee_id=${employeeId}`, { credentials: "include" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      const cycleName = (id: string) => (cycles as AppraisalCycleRow[]).find((x) => x.id === id)?.name ?? "Appraisal";
      const out: ReviewEvent[] = [];
      for (const a of appraisals.filter((x) => x.employee_id === employeeId)) {
        out.push({ date: a.completed_at ?? a.created_at, kind: "appraisal", title: cycleName(a.cycle_id), detail: a.overall_score !== null ? `${t("hr.overallScore")} ${a.overall_score}` : "", status: a.status, href: "/hr?tab=appraisals" });
      }
      /* Skills: the history is per skill per moment; group by day so a
         re-assessment session reads as one event. */
      const hist = ((skillsRes as { history?: Array<{ skill_id: string; employee_score: number; recorded_at: string }> } | null)?.history ?? []);
      const byDay = new Map<string, number[]>();
      for (const h of hist) { const d = h.recorded_at.slice(0, 10); byDay.set(d, [...(byDay.get(d) ?? []), Number(h.employee_score)]); }
      for (const [d, scores] of byDay) {
        out.push({ date: d, kind: "skills", title: t("hr.skills"), detail: `${scores.length} ${t("hr.sk.skillsAssessed")} · ${t("hr.sk.avg")} ${num(scores.reduce((a, b) => a + b, 0) / scores.length, 1)}`, status: null, href: `/hr?tab=skills&employee=${employeeId}` });
      }
      const beh = ((behaviorRes as { assessments?: Array<{ id: string; assessment_type: string; status: string; review_date: string | null; finalized_at: string | null; created_at: string; overall_behavior_score: number | null; position_behavior_match: number | null; critical_gap_count: number | null }> } | null)?.assessments ?? []);
      for (const b of beh) {
        out.push({ date: b.finalized_at ?? b.review_date ?? b.created_at, kind: "behavior", title: `${t("hr.behavior")} · ${b.assessment_type}`, detail: [b.overall_behavior_score !== null ? `${t("hr.overallScore")} ${num(b.overall_behavior_score, 1)}` : "", b.position_behavior_match !== null ? `${t("hr.bhv.match")} ${num(b.position_behavior_match, 0)}%` : "", b.critical_gap_count ? `${b.critical_gap_count} ${t("hr.bhv.criticalGaps")}` : ""].filter(Boolean).join(" · "), status: b.status, href: `/hr?tab=behavior&employee=${employeeId}` });
      }
      out.sort((a, b) => (a.date < b.date ? 1 : -1));
      if (!c) setEvents(out);
    })();
    return () => { c = true; };
  }, [employeeId, t]);
  if (!events) return <Spinner />;
  const KIND_CLS: Record<ReviewEvent["kind"], string> = { appraisal: "bg-amber-500/15 text-amber-400 border-amber-500/20", skills: "bg-blue-500/15 text-blue-400 border-blue-500/20", behavior: "bg-violet-500/15 text-violet-400 border-violet-500/20" };
  return (
    <section className={`${cardCls} overflow-hidden`}>
      <Head>{t("hr.reviewsTimeline")}</Head>
      {events.length === 0 ? <EmptyState icon={StarIcon} title={t("hr.noReviews")} /> : (
        <ol className="divide-y divide-[var(--border-subtle)]">
          {events.map((e, i) => (
            <li key={i} className="px-5 py-3 flex items-start gap-4 text-[13px]">
              <span className="w-[92px] shrink-0 tabular-nums text-[var(--text-dim)] pt-0.5">{fmtDate(e.date)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={e.kind} map={KIND_CLS} label={t(`hr.reviewKind.${e.kind}`)} />
                  <Link href={e.href} className="font-medium text-[var(--text-primary)] hover:underline">{e.title}</Link>
                  {e.status && <span className="text-[11px] text-[var(--text-dim)]">· {tStatus(e.status)}</span>}
                </div>
                {e.detail && <div className="text-[12px] text-[var(--text-dim)] mt-0.5">{e.detail}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default function EmployeeHr360({ employeeId, tab }: { employeeId: string; tab: Hr360Tab }) {
  if (tab === "leave") return <LeaveTab employeeId={employeeId} />;
  if (tab === "attendance") return <AttendanceTab employeeId={employeeId} />;
  if (tab === "payroll") return <PayrollTab employeeId={employeeId} />;
  if (tab === "documents") return <DocumentsTab employeeId={employeeId} />;
  return <ReviewsTab employeeId={employeeId} />;
}
