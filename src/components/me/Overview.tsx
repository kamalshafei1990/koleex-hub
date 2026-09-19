"use client";

/* Overview — the five-second look: who I am on paper, where I stand today,
   what is coming up. Every number links to the tab that owns it. */

import KdsAvatar from "@/components/kds/Avatar";
import KpiCard from "@/components/ui/KpiCard";
import { fpAvatar } from "@/lib/cdn";
import { cardCls, fmtDate, fmtTime, makeTranslationHelpers, StatusBadge, LEAVE_STATUS_MAP, PAYSLIP_STATUS_MAP } from "@/components/hr/shared";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import CalendarCheckIcon from "@/components/icons/ui/CalendarCheckIcon";
import CalendarPlusIcon from "@/components/icons/ui/CalendarPlusIcon";
import WalletIcon from "@/components/icons/ui/WalletIcon";
import ClockButton from "./ClockButton";
import { fmtHours, fmtNum, type MeTabProps } from "./shared";

export default function Overview({ bundle, setBundle, t, setTab }: MeTabProps) {
  const { tLeaveType, tStatus, tEmpType } = makeTranslationHelpers(t);
  const { employee, person, leave, attendance, payslips, documents, serverDate } = bundle;

  const annual = leave.balances.find((b) => b.code === "annual") ?? leave.balances[0] ?? null;
  const pending = leave.requests.filter((r) => r.status === "pending").length;
  const upcoming = leave.requests
    .filter((r) => r.status === "approved" && r.end_date >= serverDate)
    .sort((a, b) => (a.start_date < b.start_date ? -1 : 1))
    .slice(0, 3);
  const latestPayslip = payslips[0] ?? null;
  const soon = new Date(serverDate); soon.setDate(soon.getDate() + 60);
  const soonIso = soon.toISOString().slice(0, 10);
  const expiring = documents.filter((d) => d.expiry_date && d.expiry_date <= soonIso);

  const today = attendance.today;
  const todayValue = today?.clock_out
    ? fmtHours(today.total_hours)
    : today?.clock_in
      ? fmtTime(today.clock_in)
      : "—";
  const todayHint = today?.clock_out
    ? `${fmtTime(today.clock_in)} → ${fmtTime(today.clock_out)}`
    : today?.clock_in
      ? t("hr.me.clockedInAt")
      : t("hr.me.notClockedIn");

  const typeName = (id: string) => {
    const ty = leave.types.find((x) => x.id === id);
    return ty ? tLeaveType(ty.name, ty.code) : "";
  };

  return (
    <div className="space-y-6">
      {/* Identity */}
      <section className={`${cardCls} p-5 md:p-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <KdsAvatar src={fpAvatar(person.avatarUrl)} name={person.fullName} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[24px] font-bold leading-tight text-[var(--text-primary)]">{person.fullName}</h2>
              {employee.employeeNumber && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[var(--bg-surface)] text-[var(--text-dim)] border border-[var(--border-faint)]">{employee.employeeNumber}</span>
              )}
              {employee.employmentStatus && <StatusBadge status={employee.employmentStatus} map={{ active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", on_leave: "bg-amber-500/15 text-amber-400 border-amber-500/20" }} label={tStatus(employee.employmentStatus)} />}
            </div>
            {person.nameAlt && <div lang="zh" className="text-[14px] text-[var(--text-dim)]">{person.nameAlt}</div>}
            <div className="mt-1 text-[14px] text-[var(--text-secondary)]">
              {[employee.positionTitle, employee.departmentName].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] sm:text-end">
            <dt className="text-[var(--text-dim)]">{t("hr.me.hireDate")}</dt><dd className="text-[var(--text-primary)] tabular-nums">{fmtDate(employee.hireDate)}</dd>
            <dt className="text-[var(--text-dim)]">{t("hr.me.manager")}</dt><dd className="text-[var(--text-primary)]">{employee.managerName ?? "—"}</dd>
            <dt className="text-[var(--text-dim)]">{t("hr.me.employmentType")}</dt><dd className="text-[var(--text-primary)]">{employee.employmentType ? tEmpType(employee.employmentType) : "—"}</dd>
          </dl>
        </div>
      </section>

      {/* Today + numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label={t("hr.me.today")} value={todayValue} hint={todayHint} icon={<ClockIcon size={15} />} onClick={() => setTab("attendance")} />
        <KpiCard
          label={annual ? tLeaveType(leave.types.find((x) => x.id === annual.leaveTypeId)?.name ?? "", annual.code) : t("hr.me.leaveRemaining")}
          value={annual ? annual.remaining : "—"}
          hint={annual ? `${t("hr.used")} ${fmtNum(annual.used)} / ${fmtNum(annual.entitled + annual.carriedOver + annual.adjustment)}` : undefined}
          icon={<CalendarCheckIcon size={15} />}
          onClick={() => setTab("leave")}
        />
        <KpiCard label={t("hr.me.pendingRequests")} value={pending} icon={<CalendarPlusIcon size={15} />} tone={pending > 0 ? "warning" : "default"} onClick={() => setTab("leave")} />
        <KpiCard label={t("hr.me.monthHours")} value={fmtHours(attendance.monthHours)} hint={`${attendance.month.length} ${t("hr.days")}`} icon={<WalletIcon size={15} />} onClick={() => setTab("attendance")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Clock */}
        <section className={`${cardCls} p-5`}>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-3">{t("hr.attendance")}</h3>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[18px] font-medium text-[var(--text-primary)] tabular-nums">{fmtDate(serverDate)}</div>
              <div className="text-[12px] text-[var(--text-dim)] mt-0.5">{todayHint}</div>
            </div>
            <ClockButton today={today} setBundle={setBundle} t={t} />
          </div>
        </section>

        {/* Upcoming leave */}
        <section className={`${cardCls} p-5`}>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-3">{t("hr.me.upcomingLeave")}</h3>
          {upcoming.length === 0 ? (
            <p className="text-[13px] text-[var(--text-dim)]">{t("hr.me.noUpcomingLeave")}</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {upcoming.map((r) => (
                <li key={r.id} className="py-2 flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-[var(--text-primary)] font-medium">{typeName(r.leave_type_id)}</span>
                  <span className="text-[var(--text-dim)] tabular-nums">{fmtDate(r.start_date)}{r.start_date !== r.end_date ? ` → ${fmtDate(r.end_date)}` : ""} · {r.days} {t("hr.days")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Latest payslip */}
        <section className={`${cardCls} p-5`}>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-3">{t("hr.me.latestPayslip")}</h3>
          {latestPayslip ? (
            <button type="button" onClick={() => setTab("payslips")} className="w-full text-start flex items-center justify-between gap-3">
              <div>
                <div className="text-[18px] font-semibold text-[var(--text-primary)] tabular-nums">{fmtNum(latestPayslip.net_amount)}</div>
                <div className="text-[12px] text-[var(--text-dim)] tabular-nums">{fmtDate(latestPayslip.period_start)} → {fmtDate(latestPayslip.period_end)}</div>
              </div>
              <StatusBadge status={latestPayslip.status} map={PAYSLIP_STATUS_MAP} label={tStatus(latestPayslip.status)} />
            </button>
          ) : (
            <p className="text-[13px] text-[var(--text-dim)]">{t("hr.me.noPayslipsYet")}</p>
          )}
        </section>

        {/* Documents */}
        <section className={`${cardCls} p-5`}>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-3">{t("hr.documents")}</h3>
          {expiring.length === 0 ? (
            <p className="text-[13px] text-[var(--text-dim)]">{documents.length} {t("hr.documents").toLowerCase()} · {t("hr.me.nothingExpiring")}</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {expiring.slice(0, 3).map((d) => (
                <li key={d.id} className="py-2 flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-[var(--text-primary)] font-medium truncate">{d.name}</span>
                  <span className={`shrink-0 tabular-nums ${d.expiry_date! < serverDate ? "text-[#FF3333]" : "text-[#FFCC00]"}`}>{t("hr.expires")} {fmtDate(d.expiry_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {leave.requests.some((r) => r.status === "pending") && (
        <p className="text-[12px] text-[var(--text-dim)]">
          {leave.requests.filter((r) => r.status === "pending").map((r) => `${typeName(r.leave_type_id)} ${fmtDate(r.start_date)}`).join(" · ")} — <StatusBadge status="pending" map={LEAVE_STATUS_MAP} label={tStatus("pending")} />
        </p>
      )}
    </div>
  );
}
