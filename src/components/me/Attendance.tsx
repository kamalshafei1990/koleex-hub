"use client";

/* Attendance — today's punch, then MY month with every day accounted for:
   weekend, public holiday, approved leave, present, late, absent. The
   sheet is server-derived (attendance-sheet.ts) so HR and I read the same
   thing; the bundle's raw month list is only the fallback while it loads.

   Phase 1 (owner-approved 23 Sep 2026): any day of the last 60 can be sent
   for correction ("I forgot to clock out", "the time is wrong") — nothing
   changes until HR or the owner approves. A day shows when it was closed
   automatically, corrected, or has overtime waiting for approval. */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AttendanceSheet, SheetDay } from "@/lib/server/attendance-sheet";
import {
  cardCls, fmtDate, fmtTime, StatusBadge, ATTENDANCE_STATUS_MAP, makeTranslationHelpers,
  ModalShell, FieldLabel, inputCls, textareaCls, primaryBtnCls, cancelBtnCls,
} from "@/components/hr/shared";
import { hhmmInZone } from "@/lib/hr/attendance-time";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import ArrowRightIcon from "@/components/icons/ui/ArrowRightIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import ClockButton from "./ClockButton";
import { ERROR_KEYS, browserTz, fmtHours, meFetch, type MeTabProps } from "./shared";

interface MyCorrection {
  id: string; date: string; status: "pending" | "approved" | "rejected"; clock_in: string | null; clock_out: string | null;
  reason: string; decision_note: string | null; created_at: string;
}

const monthLabel = (ym: string, lang: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-EG" : "en-GB", { month: "long", year: "numeric" });
};
const shiftMonth = (ym: string, by: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const chip = "inline-flex items-center h-5 px-1.5 rounded-md text-[10.5px] font-medium border";

export default function Attendance({ bundle, setBundle, t, lang }: MeTabProps) {
  const { tStatus } = makeTranslationHelpers(t);
  const { today, method, remote } = bundle.attendance;
  const [month, setMonth] = useState(bundle.serverDate.slice(0, 7));
  const [fetched, setFetched] = useState<AttendanceSheet | null>(null);
  const [sheetVersion, setSheetVersion] = useState(0);

  /* The sheet is per month; refetch on month change and after a punch
     (bundle.attendance.today changes identity). "loading" is derived — the
     sheet on hand is for another month — so the effect body never sets state. */
  useEffect(() => {
    let cancelled = false;
    meFetch<{ sheet: AttendanceSheet }>(`/api/me/hr/attendance/sheet?month=${month}&tz=${encodeURIComponent(browserTz())}`, { cache: "no-store" })
      .then((res) => { if (!cancelled && res.ok) setFetched(res.data.sheet); });
    return () => { cancelled = true; };
  }, [month, today?.id, today?.clock_out, sheetVersion]);
  const sheet = fetched && fetched.month === month ? fetched : null;
  const loading = !sheet;

  /* My correction requests — the pending ones mark their day. */
  const [requests, setRequests] = useState<MyCorrection[]>([]);
  const loadRequests = useCallback(() => {
    void meFetch<{ requests: MyCorrection[] }>("/api/me/hr/attendance/corrections", { cache: "no-store" })
      .then((res) => { if (res.ok) setRequests(res.data.requests); });
  }, []);
  useEffect(() => { loadRequests(); }, [loadRequests]);
  const pendingByDate = useMemo(() => new Set(requests.filter((r) => r.status === "pending").map((r) => r.date)), [requests]);

  /* The correction form. Times are HH:MM in MY policy's zone. */
  const [fix, setFix] = useState<{ date: string; clockIn: string; clockOut: string; reason: string } | null>(null);
  const [fixBusy, setFixBusy] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);
  const tz = sheet?.policy.timezone ?? "Asia/Shanghai";
  const openFix = (d: SheetDay) => {
    setFixError(null);
    setFix({ date: d.date, clockIn: hhmmInZone(d.clockIn, tz), clockOut: hhmmInZone(d.clockOut, tz), reason: "" });
  };
  const sendFix = async () => {
    if (!fix) return;
    const current = sheet?.days.find((d) => d.date === fix.date);
    const inChanged = fix.clockIn && fix.clockIn !== hhmmInZone(current?.clockIn, tz);
    const outChanged = fix.clockOut && fix.clockOut !== hhmmInZone(current?.clockOut, tz);
    setFixBusy(true);
    setFixError(null);
    const res = await meFetch<{ request: MyCorrection }>("/api/me/hr/attendance/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: fix.date, clock_in: inChanged ? fix.clockIn : null, clock_out: outChanged ? fix.clockOut : null, reason: fix.reason, tz: browserTz() }),
    });
    setFixBusy(false);
    if (!res.ok) { setFixError(t(ERROR_KEYS[res.error] ?? "hr.me.error")); return; }
    setFix(null);
    loadRequests();
    setSheetVersion((v) => v + 1);
  };

  const s = sheet?.summary;
  const weekday = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-EG" : "en-GB", { weekday: "short" });
  const isToday = (d: SheetDay) => d.date === bundle.serverDate;
  const canFix = (d: SheetDay) => d.date <= bundle.serverDate && daysBetween(d.date, bundle.serverDate) <= 60 && !pendingByDate.has(d.date) && d.status !== "leave";
  const otChip = (d: SheetDay) => d.overtimeState === "approved"
    ? { cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: `${t("hr.me.otApproved")} ${fmtHours(d.overtimeApprovedH)}` }
    : d.overtimeState === "rejected"
      ? { cls: "bg-slate-500/10 text-[var(--text-dim)] border-slate-500/15", label: t("hr.me.otRejected") }
      : { cls: "bg-amber-500/10 text-amber-400 border-amber-500/20", label: `${t("hr.me.otPending")} ${fmtHours(d.overtimeH)}` };

  return (
    <div className="space-y-4">
      <section className={`${cardCls} p-5 md:p-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t("hr.me.today")}</div>
            <div className="mt-1 text-[32px] font-bold leading-none tabular-nums text-[var(--text-primary)]">
              {today?.clock_out ? fmtHours(today.total_hours) : today?.clock_in ? fmtTime(today.clock_in) : "—"}
            </div>
            <div className="mt-2 text-[13px] text-[var(--text-dim)] tabular-nums">
              {today?.clock_in ? `${t("hr.clockIn")} ${fmtTime(today.clock_in)}` : t("hr.me.notClockedIn")}
              {today?.clock_out ? ` · ${t("hr.clockOut")} ${fmtTime(today.clock_out)}` : ""}
              {today?.status === "late" ? ` · ${tStatus("late")}` : ""}
            </div>
          </div>
          <ClockButton today={today} setBundle={setBundle} t={t} size="lg" method={method} remote={remote} />
        </div>
      </section>

      {/* Month summary */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {([
          ["hr.att.workdays", s?.workdays], ["hr.att.presentDays", s?.present], ["hr.att.lateDays", s?.late],
          ["hr.att.absentDays", s?.absent], ["hr.att.leaveDays", s?.leave], ["hr.att.hours", s ? fmtHours(s.hours) : undefined],
        ] as Array<[string, number | string | undefined]>).map(([k, v]) => (
          <div key={k} className={`${cardCls} px-3 py-2.5`}>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)] truncate">{t(k)}</div>
            <div className="text-[18px] font-semibold tabular-nums text-[var(--text-primary)]">{v ?? "—"}</div>
          </div>
        ))}
      </div>

      <section className={`${cardCls} overflow-hidden`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:bg-[var(--bg-surface)]" aria-label="Previous month"><ArrowLeftIcon size={14} className="rtl:rotate-180" /></button>
          <div className="text-[13px] font-semibold text-[var(--text-primary)] flex flex-wrap items-center justify-center gap-x-2">
            {monthLabel(month, lang)}{loading && <SpinnerIcon size={12} className="text-[var(--text-dim)]" />}
            {s && s.overtimeApprovedH > 0 && <span className="text-[11px] font-medium text-[var(--text-dim)]">· {t("hr.me.otApproved")} {fmtHours(s.overtimeApprovedH)}</span>}
            {s && s.overtimePendingH > 0 && <span className="text-[11px] font-medium text-amber-400">· {t("hr.me.otPending")} {fmtHours(s.overtimePendingH)}</span>}
          </div>
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, 1))} disabled={month >= bundle.serverDate.slice(0, 7)} className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:bg-[var(--bg-surface)] disabled:opacity-30" aria-label="Next month"><ArrowRightIcon size={14} className="rtl:rotate-180" /></button>
        </div>
        {sheet ? (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {sheet.days.map((d) => (
              <li key={d.date} className={`grid grid-cols-[1fr_auto] sm:grid-cols-[150px_1fr_1fr_1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-2 text-[13px] ${d.status === "weekend" || d.status === "holiday" ? "opacity-60" : ""} ${isToday(d) ? "bg-[var(--bg-surface-subtle)]" : ""}`}>
                <span className="font-medium text-[var(--text-primary)] tabular-nums">{fmtDate(d.date)} <span className="text-[var(--text-dim)] font-normal">{weekday(d.date)}</span></span>
                <span className="hidden sm:block text-[var(--text-secondary)] tabular-nums">{d.clockIn ? `${t("hr.clockIn")} ${fmtTime(d.clockIn)}` : d.note ?? ""}</span>
                <span className="hidden sm:block text-[var(--text-secondary)] tabular-nums">{d.clockOut ? `${t("hr.clockOut")} ${fmtTime(d.clockOut)}` : ""}</span>
                <span className="hidden sm:block text-[var(--text-secondary)] tabular-nums">{d.hours !== null ? fmtHours(d.hours) : ""}{d.lateMin > 0 ? ` · +${d.lateMin}m` : ""}</span>
                <span className="justify-self-end inline-flex items-center gap-1.5">
                  {d.status !== "future" && <StatusBadge status={d.status} map={ATTENDANCE_STATUS_MAP} label={tStatus(d.status)} />}
                  {/* Today counts too: a device-only employee who forgot the morning punch asks here. */}
                  {canFix(d) && (d.status !== "future" || isToday(d)) && (
                    <button type="button" onClick={() => openFix(d)} aria-label={t("hr.me.requestFix")} title={t("hr.me.requestFix")}
                      className="h-7 w-7 rounded-lg inline-flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]">
                      <PencilIcon size={13} />
                    </button>
                  )}
                </span>
                {(d.autoClosed || d.corrected || d.overtimeState || pendingByDate.has(d.date)) && (
                  <span className="col-span-2 sm:col-span-5 flex flex-wrap gap-1.5">
                    {d.autoClosed && <span className={`${chip} bg-amber-500/10 text-amber-400 border-amber-500/20`}>{t("hr.me.autoClosed")}</span>}
                    {d.corrected && <span className={`${chip} bg-blue-500/10 text-blue-400 border-blue-500/15`}>{t("hr.me.corrected")}</span>}
                    {d.overtimeState && (() => { const c = otChip(d); return <span className={`${chip} ${c.cls}`}>{c.label}</span>; })()}
                    {pendingByDate.has(d.date) && <span className={`${chip} bg-[#567FB2]/15 text-[#7FA9D6] border-[#567FB2]/30`}>{t("hr.me.fixPending")}</span>}
                  </span>
                )}
                {(d.clockIn || d.note) && <span className="sm:hidden col-span-2 text-[12px] text-[var(--text-dim)] tabular-nums">{d.note ?? (d.clockOut ? `${fmtTime(d.clockIn)} → ${fmtTime(d.clockOut)} · ${fmtHours(d.hours)}` : `${fmtTime(d.clockIn)} →`)}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center justify-center py-12"><SpinnerIcon size={20} className="text-[var(--text-dim)]" /></div>
        )}
      </section>

      {requests.length > 0 && (
        <section className={`${cardCls} overflow-hidden`}>
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] text-[13px] font-semibold text-[var(--text-primary)]">{t("hr.me.myFixes")}</div>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[13px]">
                <div className="min-w-0">
                  <div className="font-medium text-[var(--text-primary)] tabular-nums">
                    {fmtDate(r.date)}
                    <span className="ms-2 text-[var(--text-secondary)] font-normal">
                      {[r.clock_in ? `${t("hr.clockIn")} ${hhmmInZone(r.clock_in, tz)}` : null, r.clock_out ? `${t("hr.clockOut")} ${hhmmInZone(r.clock_out, tz)}` : null].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <div className="text-[12px] text-[var(--text-dim)] truncate">{r.reason}{r.decision_note ? ` — ${r.decision_note}` : ""}</div>
                </div>
                <StatusBadge status={r.status} map={{ pending: "bg-amber-500/10 text-amber-400 border-amber-500/20", approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", rejected: "bg-red-500/10 text-red-400 border-red-500/20" }} label={tStatus(r.status)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <ModalShell open={!!fix} onClose={() => setFix(null)} title={t("hr.me.fixTitle")} width="max-w-[460px]"
        footer={<>
          <button type="button" onClick={() => setFix(null)} className={cancelBtnCls}>{t("hr.cancel")}</button>
          <button type="button" onClick={sendFix} disabled={fixBusy || !fix || fix.reason.trim().length < 3} className={primaryBtnCls}>{fixBusy ? <SpinnerIcon size={13} /> : t("hr.me.fixSend")}</button>
        </>}>
        {fix && (
          <div className="space-y-3">
            <p className="text-[12.5px] text-[var(--text-dim)]">{fmtDate(fix.date)} · {weekday(fix.date)} · {t("hr.me.fixHint")}</p>
            <div className="grid grid-cols-2 gap-3">
              <div><FieldLabel>{t("hr.clockIn")}</FieldLabel><input type="time" value={fix.clockIn} onChange={(e) => setFix({ ...fix, clockIn: e.target.value })} className={inputCls} /></div>
              <div><FieldLabel>{t("hr.clockOut")}</FieldLabel><input type="time" value={fix.clockOut} onChange={(e) => setFix({ ...fix, clockOut: e.target.value })} className={inputCls} /></div>
            </div>
            <div><FieldLabel>{t("hr.reason")}</FieldLabel><textarea value={fix.reason} onChange={(e) => setFix({ ...fix, reason: e.target.value })} rows={3} maxLength={500} className={textareaCls} /></div>
            {fixError && <p className="text-[12.5px] text-[#FF3333]">{fixError}</p>}
          </div>
        )}
      </ModalShell>
    </div>
  );
}
