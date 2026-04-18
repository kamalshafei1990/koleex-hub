"use client";

/* ---------------------------------------------------------------------------
   Payroll — Salary register and payslip management module.
   --------------------------------------------------------------------------- */

import { useState, useEffect } from "react";
import type { HRModuleProps } from "@/components/hr/HRApp";
import {
  ModalShell,
  FieldLabel,
  EmptyState,
  StatusBadge,
  inputCls,
  textareaCls,
  selectCls,
  primaryBtnCls,
  cancelBtnCls,
  PAYSLIP_STATUS_MAP,
  fmtDate,
  sumObj,
  cardCls,
  sectionTitleCls,
  makeTranslationHelpers,
} from "@/components/hr/shared";
import {
  fetchSalaryRecords,
  createSalaryRecord,
  fetchPayslips,
  createPayslip,
  type SalaryRecordWithName,
  type PayslipWithName,
} from "@/lib/hr-admin";

/* ── Icons ── */
import PlusIcon from "@/components/icons/ui/PlusIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import WalletIcon from "@/components/icons/ui/WalletIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */

export default function PayrollModule({ employees, t, lang }: HRModuleProps) {
  /* ── state ── */
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecordWithName[]>([]);
  const [payslips, setPayslips] = useState<PayslipWithName[]>([]);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryForm, setSalaryForm] = useState({
    employee_id: "",
    base_salary: "",
    currency: "USD",
    pay_frequency: "monthly",
    effective_from: "",
    allowances: "{}",
    deductions: "{}",
    notes: "",
  });
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [payslipForm, setPayslipForm] = useState({
    employee_id: "",
    period_start: "",
    period_end: "",
    gross_amount: "",
    net_amount: "",
    status: "draft",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ── translation helpers ── */
  const { tStatus } = makeTranslationHelpers(t);

  /* ── data loading ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sal, pay] = await Promise.all([fetchSalaryRecords(), fetchPayslips()]);
        if (cancelled) return;
        setSalaryRecords(sal);
        setPayslips(pay);
      } catch (err) {
        console.error("[Payroll] Load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── actions ── */
  const handleCreateSalary = async () => {
    if (!salaryForm.employee_id || !salaryForm.base_salary || !salaryForm.effective_from) return;
    setSaving(true);
    try {
      let allowances: Record<string, number> = {};
      let deductions: Record<string, number> = {};
      try { allowances = JSON.parse(salaryForm.allowances); } catch { /* keep empty */ }
      try { deductions = JSON.parse(salaryForm.deductions); } catch { /* keep empty */ }

      await createSalaryRecord({
        employee_id: salaryForm.employee_id,
        base_salary: parseFloat(salaryForm.base_salary),
        currency: salaryForm.currency,
        pay_frequency: salaryForm.pay_frequency,
        effective_from: salaryForm.effective_from,
        effective_to: null,
        allowances,
        deductions,
        notes: salaryForm.notes || null,
      });

      const sal = await fetchSalaryRecords();
      setSalaryRecords(sal);
      setShowSalaryModal(false);
      setSalaryForm({
        employee_id: "",
        base_salary: "",
        currency: "USD",
        pay_frequency: "monthly",
        effective_from: "",
        allowances: "{}",
        deductions: "{}",
        notes: "",
      });
    } catch (err) {
      console.error("[Payroll] Create salary error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePayslip = async () => {
    if (!payslipForm.employee_id || !payslipForm.period_start || !payslipForm.period_end) return;
    setSaving(true);
    try {
      await createPayslip({
        employee_id: payslipForm.employee_id,
        salary_record_id: null,
        period_start: payslipForm.period_start,
        period_end: payslipForm.period_end,
        gross_amount: payslipForm.gross_amount ? parseFloat(payslipForm.gross_amount) : null,
        net_amount: payslipForm.net_amount ? parseFloat(payslipForm.net_amount) : null,
        deductions: {},
        status: payslipForm.status,
        paid_at: null,
        notes: null,
      });

      const pay = await fetchPayslips();
      setPayslips(pay);
      setShowPayslipModal(false);
      setPayslipForm({
        employee_id: "",
        period_start: "",
        period_end: "",
        gross_amount: "",
        net_amount: "",
        status: "draft",
      });
    } catch (err) {
      console.error("[Payroll] Create payslip error:", err);
    } finally {
      setSaving(false);
    }
  };

  /* ── loading spinner ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <SpinnerIcon size={28} className="text-[var(--text-dim)] animate-spin" />
      </div>
    );
  }

  /* ── render ── */
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">
          {t("hr.payroll")}
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowPayslipModal(true)} className={cancelBtnCls + " flex items-center gap-2"}>
            <PlusIcon size={14} />
            {t("hr.payslip")}
          </button>
          <button onClick={() => setShowSalaryModal(true)} className={primaryBtnCls + " flex items-center gap-2"}>
            <PlusIcon size={14} />
            {t("hr.addSalary")}
          </button>
        </div>
      </div>

      {/* ── Salary Register ── */}
      <div className={cardCls}>
        <div className="p-5">
          <div className={sectionTitleCls}>
            <WalletIcon size={14} className="text-[var(--text-dim)]" />
            {t("hr.salaryRegister")}
          </div>

          {salaryRecords.length === 0 ? (
            <EmptyState
              icon={WalletIcon}
              title={t("hr.noSalaryRecords")}
              subtitle={t("hr.addSalarySubtitle")}
            />
          ) : (
            <div className="space-y-2">
              {salaryRecords.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--bg-surface)] transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                    <UserIcon size={14} className="text-[var(--text-dim)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                      {rec.employee_name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                        {rec.currency} {rec.base_salary.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-[var(--text-dim)]">
                        {fmtDate(rec.effective_from)} — {rec.effective_to ? fmtDate(rec.effective_to) : t("hr.presentLabel")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {sumObj(rec.allowances) > 0 && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                        +{rec.currency} {sumObj(rec.allowances).toLocaleString()}
                      </span>
                    )}
                    {sumObj(rec.deductions) > 0 && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">
                        -{rec.currency} {sumObj(rec.deductions).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Payslips ── */}
      <div className={cardCls}>
        <div className="p-5">
          <div className={sectionTitleCls}>
            <WalletIcon size={14} className="text-[var(--text-dim)]" />
            {t("hr.payslips")}
          </div>

          {payslips.length === 0 ? (
            <EmptyState
              icon={WalletIcon}
              title={t("hr.noPayslips")}
            />
          ) : (
            <div className="space-y-2">
              {payslips.map((ps) => (
                <div
                  key={ps.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--bg-surface)] transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                    <UserIcon size={14} className="text-[var(--text-dim)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                      {ps.employee_name}
                    </div>
                    <div className="text-[11px] text-[var(--text-dim)] mt-0.5">
                      {fmtDate(ps.period_start)} — {fmtDate(ps.period_end)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {ps.gross_amount != null && (
                      <span className="text-[11px] text-[var(--text-dim)]">
                        {t("hr.grossLabel")} {ps.gross_amount.toLocaleString()}
                      </span>
                    )}
                    {ps.net_amount != null && (
                      <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                        {t("hr.netLabel")} {ps.net_amount.toLocaleString()}
                      </span>
                    )}
                    <StatusBadge
                      status={ps.status}
                      map={PAYSLIP_STATUS_MAP}
                      label={tStatus(ps.status)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Add Salary Modal ── */}
      <ModalShell
        open={showSalaryModal}
        onClose={() => setShowSalaryModal(false)}
        title={t("hr.addSalaryRecord")}
        footer={
          <>
            <button onClick={() => setShowSalaryModal(false)} className={cancelBtnCls}>
              {t("hr.cancel")}
            </button>
            <button
              onClick={handleCreateSalary}
              disabled={saving || !salaryForm.employee_id || !salaryForm.base_salary || !salaryForm.effective_from}
              className={primaryBtnCls + " flex items-center gap-2"}
            >
              {saving && <SpinnerIcon size={14} className="animate-spin" />}
              {t("hr.save")}
            </button>
          </>
        }
      >
        {/* Employee */}
        <div>
          <FieldLabel>{t("hr.employee")}</FieldLabel>
          <select
            value={salaryForm.employee_id}
            onChange={(e) => setSalaryForm((f) => ({ ...f, employee_id: e.target.value }))}
            className={selectCls}
          >
            <option value="">{t("hr.selectEmployee")}</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.person.full_name}
              </option>
            ))}
          </select>
        </div>

        {/* Base Salary + Currency */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>{t("hr.baseSalary")}</FieldLabel>
            <input
              type="number"
              value={salaryForm.base_salary}
              onChange={(e) => setSalaryForm((f) => ({ ...f, base_salary: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <FieldLabel>{t("hr.currency")}</FieldLabel>
            <input
              type="text"
              value={salaryForm.currency}
              onChange={(e) => setSalaryForm((f) => ({ ...f, currency: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        {/* Pay Frequency + Effective From */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>{t("hr.payFrequency")}</FieldLabel>
            <select
              value={salaryForm.pay_frequency}
              onChange={(e) => setSalaryForm((f) => ({ ...f, pay_frequency: e.target.value }))}
              className={selectCls}
            >
              <option value="monthly">{t("hr.monthly")}</option>
              <option value="bi_weekly">{t("hr.biWeekly")}</option>
              <option value="weekly">{t("hr.weekly")}</option>
            </select>
          </div>
          <div>
            <FieldLabel>{t("hr.effectiveFrom")}</FieldLabel>
            <input
              type="date"
              value={salaryForm.effective_from}
              onChange={(e) => setSalaryForm((f) => ({ ...f, effective_from: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        {/* Allowances JSON */}
        <div>
          <FieldLabel>{t("hr.allowancesJSON")}</FieldLabel>
          <input
            type="text"
            value={salaryForm.allowances}
            onChange={(e) => setSalaryForm((f) => ({ ...f, allowances: e.target.value }))}
            className={inputCls}
          />
        </div>

        {/* Deductions JSON */}
        <div>
          <FieldLabel>{t("hr.deductionsJSON")}</FieldLabel>
          <input
            type="text"
            value={salaryForm.deductions}
            onChange={(e) => setSalaryForm((f) => ({ ...f, deductions: e.target.value }))}
            className={inputCls}
          />
        </div>

        {/* Notes */}
        <div>
          <FieldLabel>{t("hr.notes")}</FieldLabel>
          <textarea
            value={salaryForm.notes}
            onChange={(e) => setSalaryForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder={t("hr.optionalNotesPlaceholder")}
            rows={3}
            className={textareaCls}
          />
        </div>
      </ModalShell>

      {/* ── Create Payslip Modal ── */}
      <ModalShell
        open={showPayslipModal}
        onClose={() => setShowPayslipModal(false)}
        title={t("hr.createPayslip")}
        footer={
          <>
            <button onClick={() => setShowPayslipModal(false)} className={cancelBtnCls}>
              {t("hr.cancel")}
            </button>
            <button
              onClick={handleCreatePayslip}
              disabled={saving || !payslipForm.employee_id || !payslipForm.period_start || !payslipForm.period_end}
              className={primaryBtnCls + " flex items-center gap-2"}
            >
              {saving && <SpinnerIcon size={14} className="animate-spin" />}
              {t("hr.create")}
            </button>
          </>
        }
      >
        {/* Employee */}
        <div>
          <FieldLabel>{t("hr.employee")}</FieldLabel>
          <select
            value={payslipForm.employee_id}
            onChange={(e) => setPayslipForm((f) => ({ ...f, employee_id: e.target.value }))}
            className={selectCls}
          >
            <option value="">{t("hr.selectEmployee")}</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.person.full_name}
              </option>
            ))}
          </select>
        </div>

        {/* Period Start / End */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>{t("hr.periodStart")}</FieldLabel>
            <input
              type="date"
              value={payslipForm.period_start}
              onChange={(e) => setPayslipForm((f) => ({ ...f, period_start: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <FieldLabel>{t("hr.periodEnd")}</FieldLabel>
            <input
              type="date"
              value={payslipForm.period_end}
              onChange={(e) => setPayslipForm((f) => ({ ...f, period_end: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        {/* Gross / Net */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>{t("hr.grossAmount")}</FieldLabel>
            <input
              type="number"
              value={payslipForm.gross_amount}
              onChange={(e) => setPayslipForm((f) => ({ ...f, gross_amount: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <FieldLabel>{t("hr.netAmount")}</FieldLabel>
            <input
              type="number"
              value={payslipForm.net_amount}
              onChange={(e) => setPayslipForm((f) => ({ ...f, net_amount: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        {/* Status */}
        <div>
          <FieldLabel>{t("hr.status")}</FieldLabel>
          <select
            value={payslipForm.status}
            onChange={(e) => setPayslipForm((f) => ({ ...f, status: e.target.value }))}
            className={selectCls}
          >
            <option value="draft">{t("hr.draft")}</option>
            <option value="approved">{t("hr.approved")}</option>
            <option value="paid">{t("hr.paid")}</option>
          </select>
        </div>
      </ModalShell>
    </div>
  );
}
