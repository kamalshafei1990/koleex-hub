"use client";

/* /reports/[id]/print?lang=en|zh|ar — one report on the house sheet. Same
   print contract as the quotation and the contracts: PRINT_AND_DOC_STYLES,
   the ready flag — set only once the document has MEASURED its text and
   dealt it onto sheets (onReady), never on a timer — and ?auto=1 prints
   itself (the reader drives it through a hidden iframe). The Hub shell skips any /print route
   and the Reports layout does too, so nothing but paper is on the page.
   The GET is the reader's own: who may not read the report cannot print it. */

import { use, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReportPrintDoc from "@/components/reports/app/ReportPrintDoc";
import { PRINT_AND_DOC_STYLES } from "@/components/quotations/Quotations";
import { fetchReport, periodLabel, type ReportDetail } from "@/lib/work-reports";
import { reportsT } from "@/lib/translations/reports";
import type { Lang } from "@/lib/i18n";

export default function ReportPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const search = useSearchParams();
  const lang = ((["en", "zh", "ar"] as const).find((l) => l === search.get("lang")) ?? "en") as Lang;
  const [data, setData] = useState<ReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchReport(id).then((res) => {
      if (cancelled) return;
      if (res.ok) setData(res.data);
      else setError(res.status === 404 ? "Report not found." : `Could not load the report (${res.status || "network"}).`);
    });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!data) return;
    const name = reportsT[`tpl.${data.report.templateKey}.name`]?.[lang] ?? data.report.templateKey;
    document.title = `${name} — ${data.report.author.name} — ${periodLabel(data.report.periodStart, data.report.periodEnd).replace(/\//g, "-")}`;
  }, [data, lang]);

  const auto = search.get("auto") === "1";
  const onReady = useCallback(() => {
    /* One frame so the sheets are painted before anything snapshots them. */
    requestAnimationFrame(() => {
      (window as unknown as { __quotation_pdf_ready__?: boolean }).__quotation_pdf_ready__ = true;
      if (auto) setTimeout(() => window.print(), 100);
    });
  }, [auto]);

  if (error) return <div style={{ padding: 24, fontFamily: "system-ui" }}>{error}</div>;
  if (!data) return null;
  /* The Hub's <body> never scrolls (the shell's own scroller does, and a
     /print route renders without the shell), so on SCREEN the sheets get a
     scroller of their own — someone who opens this link sees every page.
     Print is untouched: the rule is screen-only. */
  return (
    <>
      <style>{PRINT_AND_DOC_STYLES}</style>
      <style>{"@media screen { .kx-report-print-scroll { height: 100vh; overflow-y: auto; } }"}</style>
      <div className="kx-report-print-scroll">
        <div className="quot-print-root" style={{ background: "#fff", minHeight: "100vh", padding: 0 }}>
          <ReportPrintDoc detail={data} lang={lang} onReady={onReady} />
        </div>
      </div>
    </>
  );
}
