"use client";

/* ---------------------------------------------------------------------------
   PayslipDoc — one payslip on the HOUSE sheet (210 × 270 mm, the same paper
   as the quotation and the invoice): wordmark left, title right, the black
   company strips, a meta strip, then the earnings and deductions as two
   tables with black heads, and a black NET PAY bar. Built FROM the invoice
   language on purpose (feedback_house_document_style) — three papers that
   leave one company must read as one company.

   Printed through /hr/payslips/[id]/print (never window.print() on the
   editor window). Amounts are the slip's stored breakdown: a slip prints
   the same numbers years later regardless of today's rules.
   --------------------------------------------------------------------------- */

import KoleexWordmark from "@/components/brand/KoleexWordmark";
import DocumentBrandStrips, { KOLEEX_COMPANY } from "@/components/brand/DocumentBrandStrips";
import type { PayslipBreakdown } from "@/lib/server/payroll-run";

const T = { black: "#0A0A0A", ink: "#1A1A1A", soft: "#4B5563", ghost: "#9CA3AF", border: "#E5E7EB", surface: "#F5F5F5", mono: "ui-monospace, SFMono-Regular, Menlo, monospace" } as const;

export interface PayslipDocData {
  id: string;
  employeeName: string;
  employeeNameAlt: string | null;
  employeeNumber: string | null;
  department: string | null;
  position: string | null;
  periodStart: string;
  periodEnd: string;
  status: string;
  paidAt: string | null;
  currency: string;
  breakdown: PayslipBreakdown | null;
  gross: number | null;
  net: number | null;
  deductions: Record<string, number>;
}

const money = (n: number, ccy: string) => `${ccy} ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
const fmtD = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");

function Meta({ label, value, first, last }: { label: string; value: string; first?: boolean; last?: boolean }) {
  return (
    <div style={{ borderLeft: first ? "none" : `1px solid ${T.border}`, borderRadius: first ? "12px 0 0 12px" : last ? "0 12px 12px 0" : 0 }}>
      <div style={{ background: T.black, color: "#fff", fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "5px 12px" }}>{label}</div>
      <div style={{ padding: "8px 12px", fontSize: 11, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function Lines({ title, rows, total, totalLabel, ccy }: { title: string; rows: Array<[string, number, string?]>; total: number; totalLabel: string; ccy: string }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ background: T.black, color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "7px 14px", display: "flex", justifyContent: "space-between" }}>
        <span>{title}</span><span>{ccy}</span>
      </div>
      {rows.length === 0 && <div style={{ padding: "10px 14px", fontSize: 10, color: T.ghost }}>—</div>}
      {rows.map(([label, amount, note], i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 14px", borderTop: i ? `1px solid ${T.border}` : "none", fontSize: 10.5, color: T.ink }}>
          <span>{label}{note ? <span style={{ color: T.ghost, marginLeft: 6, fontSize: 9 }}>{note}</span> : null}</span>
          <span style={{ fontFamily: T.mono, fontVariantNumeric: "tabular-nums" }}>{new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(amount)}</span>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", borderTop: `1px solid ${T.border}`, background: T.surface, fontSize: 10.5, fontWeight: 700, color: T.black }}>
        <span>{totalLabel}</span><span style={{ fontFamily: T.mono }}>{new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(total)}</span>
      </div>
    </div>
  );
}

export default function PayslipDoc({ slip }: { slip: PayslipDocData }) {
  const b = slip.breakdown;
  const ccy = slip.currency || b?.currency || "";
  const pct = (r: number) => `${Math.round(r * 10000) / 100}%`;
  const earnings: Array<[string, number, string?]> = b
    ? [
        ["Basic salary", b.basic, `${b.workdays} workdays · daily ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(b.dailyRate)}`],
        ...Object.entries(b.allowances).map(([k, v]): [string, number] => [k, Number(v)]),
        ...(b.overtimePay > 0 ? [["Overtime", b.overtimePay, `${b.overtimeHours} h`] as [string, number, string]] : []),
        ...(b.absenceDeduction > 0 ? [["Absence", -b.absenceDeduction, `${b.absentDays} day${b.absentDays === 1 ? "" : "s"}`] as [string, number, string]] : []),
        ...(b.unpaidLeaveDeduction > 0 ? [["Unpaid leave", -b.unpaidLeaveDeduction, `${b.unpaidLeaveDays} day${b.unpaidLeaveDays === 1 ? "" : "s"}`] as [string, number, string]] : []),
      ]
    : [["Gross", slip.gross ?? 0]];
  const deductions: Array<[string, number, string?]> = b
    ? [
        ...Object.entries(b.fixedDeductions).map(([k, v]): [string, number] => [k, Number(v)]),
        ...b.statutory.map((l): [string, number, string] => [l.name, l.amount, `${pct(l.rate)} of ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(l.base)}`]),
        ...b.tax.map((l): [string, number, string] => [l.name, l.amount, `${pct(l.rate)}`]),
      ]
    : Object.entries(slip.deductions).map(([k, v]): [string, number] => [k, Number(v)]);
  const gross = b?.gross ?? slip.gross ?? 0;
  const dedTotal = b ? b.fixedTotal + b.statutoryTotal + b.taxTotal : deductions.reduce((a, [, v]) => a + v, 0);
  const net = b?.net ?? slip.net ?? 0;

  return (
    <div className="quot-a4-doc" style={{ fontFamily: "Inter, system-ui, sans-serif", color: T.ink }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "36px 0 32px" }}>
        <KoleexWordmark />
        <div style={{ fontSize: 22, fontWeight: 800, color: T.black, letterSpacing: "0.08em" }}>PAYSLIP</div>
      </div>
      <DocumentBrandStrips />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
        <Meta label="Pay period" value={`${fmtD(slip.periodStart)} — ${fmtD(slip.periodEnd)}`} first />
        <Meta label="Payslip No" value={slip.id.slice(0, 8).toUpperCase()} />
        <Meta label="Status" value={slip.status === "paid" ? `Paid ${fmtD(slip.paidAt)}` : slip.status.charAt(0).toUpperCase() + slip.status.slice(1)} />
        <Meta label="Currency" value={ccy || "—"} last />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ background: T.black, color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "7px 14px" }}>Employee</div>
          <div style={{ padding: "10px 14px", fontSize: 11, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700, color: T.black, fontSize: 12 }}>{slip.employeeName}{slip.employeeNameAlt ? <span style={{ fontWeight: 400, color: T.soft, marginLeft: 8 }}>{slip.employeeNameAlt}</span> : null}</div>
            <div style={{ color: T.soft }}>{[slip.employeeNumber, slip.position, slip.department].filter(Boolean).join(" · ") || "—"}</div>
            {b?.policy && <div style={{ color: T.ghost, fontSize: 9.5 }}>{b.policy}{b.country ? ` · ${b.country}` : ""}</div>}
          </div>
        </div>
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ background: T.black, color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "7px 14px" }}>Employer</div>
          <div style={{ padding: "10px 14px", fontSize: 10.5, lineHeight: 1.5, color: T.soft }}>
            <div style={{ fontWeight: 700, color: T.black }}>{KOLEEX_COMPANY.en}</div>
            <div>{KOLEEX_COMPANY.address}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <Lines title="Earnings" rows={earnings} total={gross} totalLabel="Gross pay" ccy={ccy} />
        <Lines title="Deductions" rows={deductions} total={dedTotal} totalLabel="Total deductions" ccy={ccy} />
      </div>

      <div style={{ background: T.black, color: "#fff", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>Net pay</span>
        <span style={{ fontSize: 18, fontWeight: 800, fontFamily: T.mono, fontVariantNumeric: "tabular-nums" }}>{money(net, ccy)}</span>
      </div>

      {b && b.employer.length > 0 && (
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
          <div style={{ background: T.surface, color: T.soft, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 14px" }}>Employer contributions (not deducted)</div>
          {b.employer.map((l, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 14px", borderTop: `1px solid ${T.border}`, fontSize: 10, color: T.soft }}>
              <span>{l.name} <span style={{ color: T.ghost }}>{pct(l.rate)}</span></span>
              <span style={{ fontFamily: T.mono }}>{new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(l.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 8.5, color: T.ghost, lineHeight: 1.5, marginTop: 8 }}>
        This payslip is generated by the Koleex Hub from the salary record, the attendance sheet and the approved leave of the period. Statutory lines follow the payroll rules of the employee&apos;s work country in force when the run was approved. {KOLEEX_COMPANY.email} · {KOLEEX_COMPANY.web}
      </div>
    </div>
  );
}
