"use client";

/* /employment-contracts/[id]/print?lang=en|zh|ar — the employment contract
   of employee [id] on the house sheet, one language per print. Same print
   contract as the quotation (PRINT_AND_DOC_STYLES, the ready flag, ?auto=1).
   Outside /employees on purpose: its layout paints the Aurora ground. */

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import EmploymentContractDoc from "@/components/hr/contract/EmploymentContractDoc";
import { PRINT_AND_DOC_STYLES } from "@/components/quotations/Quotations";
import type { EmploymentContractData } from "@/app/api/hr/contract/[employeeId]/route";
import type { Lang } from "@/lib/i18n";

export default function EmploymentContractPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const search = useSearchParams();
  const lang = ((["en", "zh", "ar"] as const).find((l) => l === search.get("lang")) ?? "en") as Lang;
  const [data, setData] = useState<EmploymentContractData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/hr/contract/${encodeURIComponent(id)}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) { if (!cancelled) setError(`Could not load contract (${res.status})`); return; }
      const j = (await res.json()) as { contract: EmploymentContractData };
      if (!cancelled) setData(j.contract);
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      if (typeof document !== "undefined" && "fonts" in document) { try { await document.fonts.ready; } catch { /* ignore */ } }
      if (cancelled) return;
      (window as unknown as { __quotation_pdf_ready__?: boolean }).__quotation_pdf_ready__ = true;
      if (search.get("auto") === "1") requestAnimationFrame(() => setTimeout(() => window.print(), 100));
    }, 50);
    return () => { cancelled = true; clearTimeout(t); };
  }, [data, search]);

  if (error) return <div style={{ padding: 24, fontFamily: "system-ui" }}>{error}</div>;
  if (!data) return null;
  return (
    <>
      <style>{PRINT_AND_DOC_STYLES}</style>
      <div className="quot-print-root" style={{ background: "#fff", minHeight: "100vh", padding: 0 }}>
        <EmploymentContractDoc data={data} lang={lang} />
      </div>
    </>
  );
}
