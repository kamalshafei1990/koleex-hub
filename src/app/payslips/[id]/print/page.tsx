"use client";

/* /payslips/[id]/print — print-only render of one payslip on the house
   sheet. Lives OUTSIDE /hr on purpose: the HR layout paints the Aurora
   ground behind everything, and a print route must own a plain white page. Same contract as /quotations/[id]/print: the shared print
   stylesheet, the __quotation_pdf_ready__ flag and the ?auto=1 trigger, so
   the "Print slip" buttons get the instant Save-as-PDF flow. Readable by HR
   or by the employee the slip belongs to (the API decides). */

import { use, useEffect, useState } from "react";
import PayslipDoc, { type PayslipDocData } from "@/components/hr/payslip/PayslipDoc";
import { PRINT_AND_DOC_STYLES } from "@/components/quotations/Quotations";

type Raw = {
  id: string; period_start: string; period_end: string; status: string; paid_at: string | null; currency: string | null;
  gross_amount: number | null; net_amount: number | null; deductions: Record<string, number> | null; breakdown: PayslipDocData["breakdown"];
  department?: string | null; position?: string | null;
  koleex_employees?: {
    employee_number: string | null;
    people?: Person | Person[] | null;
  } | null;
};
type Person = { full_name?: string; name_alt?: string | null };
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

export default function PayslipPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [slip, setSlip] = useState<PayslipDocData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/hr/payslips/${encodeURIComponent(id)}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) { if (!cancelled) setError(`Could not load payslip (${res.status})`); return; }
      const { payslip: p } = (await res.json()) as { payslip: Raw };
      const emp = p.koleex_employees;
      const person = one(emp?.people);
      if (!cancelled) setSlip({
        id: p.id, employeeName: person?.full_name ?? "Employee", employeeNameAlt: person?.name_alt ?? null, employeeNumber: emp?.employee_number ?? null,
        department: p.department ?? null, position: p.position ?? null,
        periodStart: p.period_start, periodEnd: p.period_end, status: p.status, paidAt: p.paid_at, currency: p.currency ?? p.breakdown?.currency ?? "",
        breakdown: p.breakdown ?? null, gross: p.gross_amount, net: p.net_amount, deductions: p.deductions ?? {},
      });
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!slip) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      if (typeof document !== "undefined" && "fonts" in document) { try { await document.fonts.ready; } catch { /* ignore */ } }
      if (cancelled) return;
      (window as unknown as { __quotation_pdf_ready__?: boolean }).__quotation_pdf_ready__ = true;
      if (new URLSearchParams(window.location.search).get("auto") === "1") {
        requestAnimationFrame(() => setTimeout(() => window.print(), 100));
      }
    }, 50);
    return () => { cancelled = true; clearTimeout(t); };
  }, [slip]);

  if (error) return <div style={{ padding: 24, fontFamily: "system-ui" }}>{error}</div>;
  if (!slip) return null;
  return (
    <>
      <style>{PRINT_AND_DOC_STYLES}</style>
      <div className="quot-print-root" style={{ background: "#fff", minHeight: "100vh", padding: 0 }}>
        <PayslipDoc slip={slip} />
      </div>
    </>
  );
}
