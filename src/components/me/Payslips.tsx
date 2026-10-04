"use client";

/* Payslips — mine, newest first. Amounts as HR entered them; the currency
   lives on the salary record and is not repeated per slip. */

import { cardCls, fmtDate, StatusBadge, PAYSLIP_STATUS_MAP, makeTranslationHelpers, EmptyState, sumObj } from "@/components/hr/shared";
import WalletIcon from "@/components/icons/ui/WalletIcon";
import PrinterIcon from "@/components/icons/ui/PrinterIcon";
import { fmtNum, type MeTabProps } from "./shared";

export default function Payslips({ bundle, t }: MeTabProps) {
  const { tStatus } = makeTranslationHelpers(t);
  const rows = bundle.payslips;
  return (
    <section className={`${cardCls} overflow-hidden`}>
      <div className="hidden md:grid grid-cols-[1fr_120px_120px_140px_110px_40px] gap-4 px-5 py-2.5 border-b border-[var(--border-subtle)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">
        <span>{t("hr.me.period")}</span><span className="text-end">{t("hr.grossAmount")}</span><span className="text-end">{t("hr.me.deductions")}</span><span className="text-end">{t("hr.netAmount")}</span><span>{t("hr.status")}</span><span />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={WalletIcon} title={t("hr.noPayslips")} />
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)]">
          {rows.map((p) => (
            <li key={p.id} className="px-5 py-3.5 grid grid-cols-[1fr_auto_auto] md:grid-cols-[1fr_120px_120px_140px_110px_40px] gap-x-4 gap-y-1 items-center text-[13px]">
              <div>
                <div className="font-medium text-[var(--text-primary)] tabular-nums">{fmtDate(p.period_start)} → {fmtDate(p.period_end)}</div>
                {p.paid_at && <div className="text-[12px] text-[var(--text-dim)]">{t("hr.me.paidOn")} {fmtDate(p.paid_at)}</div>}
              </div>
              <span className="hidden md:block text-end tabular-nums text-[var(--text-secondary)]">{fmtNum(p.gross_amount)}</span>
              <span className="hidden md:block text-end tabular-nums text-[var(--text-secondary)]">{fmtNum(sumObj(p.deductions))}</span>
              <span className="text-end text-[16px] md:text-[14px] font-semibold tabular-nums text-[var(--text-primary)]">{p.currency ? `${p.currency} ` : ""}{fmtNum(p.net_amount)}</span>
              <span className="md:justify-self-start"><StatusBadge status={p.status} map={PAYSLIP_STATUS_MAP} label={tStatus(p.status)} /></span>
              <a href={`/payslips/${p.id}/print?auto=1`} target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]" title={t("hr.pay.print")} aria-label={t("hr.pay.print")}><PrinterIcon size={14} /></a>
              <span className="md:hidden col-span-3 text-[12px] text-[var(--text-dim)] tabular-nums">{t("hr.grossAmount")} {fmtNum(p.gross_amount)} · {t("hr.me.deductions")} {fmtNum(sumObj(p.deductions))}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
