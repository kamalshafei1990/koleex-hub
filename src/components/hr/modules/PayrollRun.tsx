"use client";

/* PayrollRunPanel — "run payroll for month X" (Phase D), mounted at the top
   of the Payroll module. Pick a month (and optionally a country), generate
   the drafts, read the totals, approve, mark paid. The rules editor sits
   behind one button: per-country statutory lines as data. */

import { useEffect, useState } from "react";
import {
  fetchPayrollRuns, runPayrollMonth, fetchPayrollRun, transitionPayrollRun,
  fetchPayrollRules, savePayrollRule, deletePayrollRule,
  type PayrollRunRow, type RunPayslipRow, type PayrollRule, type PayrollRuleInput,
} from "@/lib/hr-admin";
import { ModalShell, FieldLabel, StatusBadge, PAYSLIP_STATUS_MAP, inputCls, primaryBtnCls, cancelBtnCls, dangerBtnCls, cardCls, sectionTitleCls, fmtDate, makeTranslationHelpers } from "@/components/hr/shared";
import { COUNTRIES } from "@/lib/commercial-policy/countries";
import WalletIcon from "@/components/icons/ui/WalletIcon";
import CogIcon from "@/components/icons/ui/CogIcon";
import PrinterIcon from "@/components/icons/ui/PrinterIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

const monthNow = () => new Date().toISOString().slice(0, 7);
const money = (n: number | null | undefined, ccy?: string | null) => n === null || n === undefined ? "—" : `${ccy ? `${ccy} ` : ""}${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
const emptyRule = (): PayrollRuleInput => ({ country: null, name: "", kind: "employee_deduction", base: "gross", rate: 0, cap: null, bracket_from: null, bracket_to: null, sort_order: 0, is_active: true });
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

export default function PayrollRunPanel({ t, onChanged }: { t: (k: string) => string; onChanged: () => void }) {
  const { tStatus } = makeTranslationHelpers(t);
  const [period, setPeriod] = useState(monthNow());
  const [country, setCountry] = useState("");
  /* Off until attendance is actually tracked — otherwise every unpunched
     workday would be deducted as an absence. */
  const [deductAbsence, setDeductAbsence] = useState(false);
  const [runs, setRuns] = useState<PayrollRunRow[]>([]);
  const [selected, setSelected] = useState<{ run: PayrollRunRow; payslips: RunPayslipRow[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reloadRuns = async () => setRuns(await fetchPayrollRuns());
  useEffect(() => { let c = false; fetchPayrollRuns().then((r) => { if (!c) setRuns(r); }); return () => { c = true; }; }, []);

  const open = async (id: string) => { setBusy(`open:${id}`); const d = await fetchPayrollRun(id); setBusy(null); if (d) setSelected(d); };

  const generate = async () => {
    setBusy("run"); setNotice(null);
    const r = await runPayrollMonth(period, country || null, deductAbsence);
    setBusy(null);
    if (!r.ok || !r.result) { setNotice(r.error ?? t("hr.me.error")); return; }
    const res = r.result;
    const skipped = res.skipped.length ? ` · ${res.skipped.length} ${t("hr.pay.skipped")} (${res.skipped.filter((s) => s.reason === "no_salary").length} ${t("hr.pay.skipNoSalary")}, ${res.skipped.filter((s) => s.reason === "locked").length} ${t("hr.pay.skipLocked")})` : "";
    setNotice(`${res.totals.employees} ${t("hr.pay.employees")} · ${t("hr.pay.totalNet")} ${money(res.totals.net)}${skipped}`);
    await reloadRuns(); await open(res.runId); onChanged();
  };

  const transition = async (action: "approve" | "pay" | "reopen") => {
    if (!selected) return;
    setBusy(action);
    const r = await transitionPayrollRun(selected.run.id, action);
    setBusy(null);
    if (r.ok) { await reloadRuns(); await open(selected.run.id); onChanged(); }
  };

  /* ── rules ── */
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rules, setRules] = useState<PayrollRule[]>([]);
  const [editing, setEditing] = useState<{ id: string | null; form: PayrollRuleInput } | null>(null);
  const [ruleSaving, setRuleSaving] = useState(false);
  const openRules = async () => { setRulesOpen(true); setRules(await fetchPayrollRules()); };
  const setR = <K extends keyof PayrollRuleInput>(k: K, v: PayrollRuleInput[K]) => setEditing((e) => (e ? { ...e, form: { ...e.form, [k]: v } } : e));
  const saveRule = async () => {
    if (!editing || !editing.form.name.trim()) return;
    setRuleSaving(true);
    const ok = await savePayrollRule(editing.id, { ...editing.form, country: editing.form.country || null });
    setRuleSaving(false);
    if (ok) { setEditing(null); setRules(await fetchPayrollRules()); }
  };
  const removeRule = async (id: string) => { if (await deletePayrollRule(id)) setRules(await fetchPayrollRules()); };
  const countryLabel = (code: string | null) => { const c = code ? COUNTRIES.find((x) => x.code === code) : null; return c ? `${c.flag} ${c.name}` : t("hr.pay.allCountries"); };
  const num = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v));
  const name = (p: RunPayslipRow) => one(p.koleex_employees?.people)?.full_name ?? "Employee";

  return (
    <div className={cardCls}>
      <div className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className={sectionTitleCls + " !mb-0"}><WalletIcon size={14} className="text-[var(--text-dim)]" />{t("hr.pay.run")}</div>
          <button type="button" onClick={openRules} className="h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-2"><CogIcon size={14} /> {t("hr.pay.rules")}</button>
        </div>
        <p className="text-[12px] text-[var(--text-dim)]">{t("hr.pay.runHint")}</p>
        <div className="flex flex-wrap items-end gap-3">
          <div><FieldLabel>{t("hr.pay.period")}</FieldLabel><input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className={inputCls + " !w-44"} /></div>
          <div>
            <FieldLabel>{t("hr.att.country")}</FieldLabel>
            <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls + " !w-56"}>
              <option value="">{t("hr.pay.allCountries")}</option>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
            </select>
          </div>
          <label className="inline-flex items-center gap-2 h-10 text-[12px] text-[var(--text-secondary)]">
            <input type="checkbox" checked={deductAbsence} onChange={(e) => setDeductAbsence(e.target.checked)} className="h-4 w-4" /> {t("hr.pay.deductAbsence")}
          </label>
          <button type="button" onClick={generate} disabled={busy === "run" || !/^\d{4}-\d{2}$/.test(period)} className={primaryBtnCls + " inline-flex items-center gap-2"}>{busy === "run" ? <SpinnerIcon size={13} /> : null} {t("hr.pay.generate")}</button>
          {notice && <span className="text-[12px] text-[var(--text-secondary)]">{notice}</span>}
        </div>

        {/* Runs */}
        {runs.length === 0 ? (
          <p className="text-[12px] text-[var(--text-dim)]">{t("hr.pay.noRuns")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {runs.map((r) => (
              <button key={r.id} type="button" onClick={() => open(r.id)} className={`h-9 px-3 rounded-lg text-[12px] font-medium border transition-colors inline-flex items-center gap-2 ${selected?.run.id === r.id ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-transparent" : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]"}`}>
                {r.period}{r.country ? ` · ${r.country}` : ""} <StatusBadge status={r.status} map={PAYSLIP_STATUS_MAP} label={tStatus(r.status)} />
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {([["hr.pay.employees", String(selected.run.employees)], ["hr.pay.totalGross", money(selected.run.total_gross, selected.run.currency)], ["hr.pay.totalNet", money(selected.run.total_net, selected.run.currency)], ["hr.pay.employerCost", money(selected.run.total_employer, selected.run.currency)]] as Array<[string, string]>).map(([k, v]) => (
                <div key={k} className="rounded-xl border border-[var(--border-subtle)] px-3 py-2"><div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{t(k)}</div><div className="text-[15px] font-semibold tabular-nums text-[var(--text-primary)]">{v}</div></div>
              ))}
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
              <div className="hidden md:grid grid-cols-[1fr_repeat(6,110px)_40px] gap-2 px-3 py-2 border-b border-[var(--border-subtle)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">
                <span>{t("hr.employee")}</span><span className="text-end">{t("hr.pay.basic")}</span><span className="text-end">{t("hr.pay.allowances")}</span><span className="text-end">{t("hr.pay.overtime")}</span><span className="text-end">{t("hr.pay.gross")}</span><span className="text-end">{t("hr.pay.deductions")}</span><span className="text-end">{t("hr.pay.net")}</span><span />
              </div>
              <ul className="divide-y divide-[var(--border-subtle)]">
                {selected.payslips.map((p) => {
                  const b = p.breakdown;
                  return (
                    <li key={p.id} className="grid grid-cols-[1fr_auto_40px] md:grid-cols-[1fr_repeat(6,110px)_40px] gap-2 items-center px-3 py-2 text-[13px]">
                      <span className="font-medium text-[var(--text-primary)] truncate">{name(p)} <span className="text-[11px] text-[var(--text-dim)]">{p.koleex_employees?.employee_number ?? ""}</span></span>
                      <span className="hidden md:block text-end tabular-nums text-[var(--text-secondary)]">{money(b?.basic)}</span>
                      <span className="hidden md:block text-end tabular-nums text-[var(--text-secondary)]">{money(b?.allowancesTotal)}</span>
                      <span className="hidden md:block text-end tabular-nums text-[var(--text-secondary)]">{money(b?.overtimePay)}</span>
                      <span className="hidden md:block text-end tabular-nums text-[var(--text-secondary)]">{money(p.gross_amount)}</span>
                      <span className="hidden md:block text-end tabular-nums text-[var(--text-secondary)]">{money(b ? b.fixedTotal + b.statutoryTotal + b.taxTotal : null)}</span>
                      <span className="text-end font-semibold tabular-nums text-[var(--text-primary)]">{money(p.net_amount, p.currency)}</span>
                      <a href={`/payslips/${p.id}/print?auto=1`} target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]" title={t("hr.pay.print")} aria-label={t("hr.pay.print")}><PrinterIcon size={14} /></a>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="flex items-center justify-end gap-2">
              {selected.run.status === "draft" && <button type="button" onClick={() => transition("approve")} disabled={!!busy} className={primaryBtnCls}>{busy === "approve" ? <SpinnerIcon size={13} /> : t("hr.pay.approve")}</button>}
              {selected.run.status === "approved" && <>
                <button type="button" onClick={() => transition("reopen")} disabled={!!busy} className={cancelBtnCls}>{t("hr.pay.reopen")}</button>
                <button type="button" onClick={() => transition("pay")} disabled={!!busy} className={primaryBtnCls}>{busy === "pay" ? <SpinnerIcon size={13} /> : t("hr.pay.markPaid")}</button>
              </>}
              {selected.run.status === "paid" && <span className="text-[12px] text-[var(--text-dim)]">{t("hr.paid")} · {fmtDate(selected.run.paid_at)}</span>}
            </div>
          </div>
        )}
      </div>

      {/* ── Rules ── */}
      <ModalShell open={rulesOpen} onClose={() => { setRulesOpen(false); setEditing(null); }} title={t("hr.pay.rules")} width="max-w-[680px]"
        footer={editing ? <>
          <button type="button" className={cancelBtnCls} onClick={() => setEditing(null)}>{t("hr.cancel")}</button>
          <button type="button" className={primaryBtnCls} disabled={ruleSaving || !editing.form.name.trim()} onClick={saveRule}>{ruleSaving ? <SpinnerIcon size={13} /> : t("hr.save")}</button>
        </> : <>
          <button type="button" className={cancelBtnCls} onClick={() => setRulesOpen(false)}>{t("hr.close")}</button>
          <button type="button" className={primaryBtnCls} onClick={() => setEditing({ id: null, form: emptyRule() })}>{t("hr.pay.newRule")}</button>
        </>}>
        <p className="text-[12px] text-[var(--text-dim)]">{t("hr.pay.rulesHint")}</p>
        {editing ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><FieldLabel>{t("hr.pay.ruleName")}</FieldLabel><input value={editing.form.name} onChange={(e) => setR("name", e.target.value)} className={inputCls} /></div>
            <div>
              <FieldLabel>{t("hr.att.country")}</FieldLabel>
              <select value={editing.form.country ?? ""} onChange={(e) => setR("country", e.target.value || null)} className={inputCls}>
                <option value="">{t("hr.pay.allCountries")}</option>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>{t("hr.pay.ruleKind")}</FieldLabel>
              <select value={editing.form.kind} onChange={(e) => setR("kind", e.target.value as PayrollRuleInput["kind"])} className={inputCls}>
                {(["employee_deduction", "employer_contribution", "tax_bracket"] as const).map((k) => <option key={k} value={k}>{t(`hr.pay.kind.${k}`)}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>{t("hr.pay.ruleBase")}</FieldLabel>
              <select value={editing.form.base} onChange={(e) => setR("base", e.target.value as PayrollRuleInput["base"])} className={inputCls}>
                {(["gross", "basic", "taxable"] as const).map((b) => <option key={b} value={b}>{t(`hr.pay.base.${b}`)}</option>)}
              </select>
            </div>
            <div><FieldLabel>{t("hr.pay.rate")}</FieldLabel><input type="number" step="0.01" min={0} value={Math.round(editing.form.rate * 10000) / 100} onChange={(e) => setR("rate", (Number(e.target.value) || 0) / 100)} className={inputCls} /></div>
            {editing.form.kind === "tax_bracket" ? (
              <>
                <div><FieldLabel>{t("hr.pay.bracketFrom")}</FieldLabel><input type="number" min={0} value={editing.form.bracket_from ?? ""} onChange={(e) => setR("bracket_from", num(e.target.value))} className={inputCls} /></div>
                <div><FieldLabel>{t("hr.pay.bracketTo")}</FieldLabel><input type="number" min={0} value={editing.form.bracket_to ?? ""} onChange={(e) => setR("bracket_to", num(e.target.value))} className={inputCls} /></div>
              </>
            ) : (
              <div><FieldLabel>{t("hr.pay.cap")}</FieldLabel><input type="number" min={0} value={editing.form.cap ?? ""} onChange={(e) => setR("cap", num(e.target.value))} className={inputCls} /></div>
            )}
            <div><FieldLabel>#</FieldLabel><input type="number" value={editing.form.sort_order} onChange={(e) => setR("sort_order", Number(e.target.value) || 0)} className={inputCls} /></div>
          </div>
        ) : rules.length === 0 ? (
          <p className="text-[13px] text-[var(--text-dim)]">{t("hr.pay.noRules")}</p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)]">
            {rules.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
                <div className="min-w-0">
                  <div className="font-medium text-[var(--text-primary)]">{r.name} <span className="text-[11px] text-[var(--text-dim)]">· {t(`hr.pay.kind.${r.kind}`)}</span></div>
                  <div className="text-[12px] text-[var(--text-dim)] tabular-nums">
                    {countryLabel(r.country)} · {Math.round(Number(r.rate) * 10000) / 100}% {t(`hr.pay.base.${r.base}`).toLowerCase()}
                    {r.kind === "tax_bracket" ? ` · ${r.bracket_from ?? 0} → ${r.bracket_to ?? "∞"}` : r.cap ? ` · cap ${r.cap}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" className="text-[12px] font-medium text-[#0066FF]" onClick={() => setEditing({ id: r.id, form: { country: r.country, name: r.name, kind: r.kind, base: r.base, rate: Number(r.rate), cap: r.cap === null ? null : Number(r.cap), bracket_from: r.bracket_from === null ? null : Number(r.bracket_from), bracket_to: r.bracket_to === null ? null : Number(r.bracket_to), sort_order: r.sort_order, is_active: r.is_active } })}>{t("hr.edit")}</button>
                  <button type="button" className={dangerBtnCls + " !h-8 !px-3 text-[12px]"} onClick={() => removeRule(r.id)}>{t("hr.delete")}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ModalShell>
    </div>
  );
}
