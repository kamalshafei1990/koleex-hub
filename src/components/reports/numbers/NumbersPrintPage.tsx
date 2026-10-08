"use client";

/* ---------------------------------------------------------------------------
   The paper page of a number report — the house print contract, as the
   report's own /print and the quotation's: PRINT_AND_DOC_STYLES, the sheets
   and nothing else (the Hub shell and the Reports layout both skip /print),
   `document.title` as the PDF's name, the ready flag once the fonts have
   settled, and `?auto=1` prints itself. The page on screen prints it through
   a hidden iframe (NumbersKit.printPaper).

   It reads the same API as the page, with the reader's own session: who
   may not see the numbers cannot print them. The URL is read in an effect —
   a static route calling useSearchParams would need a Suspense boundary.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import { PRINT_AND_DOC_STYLES } from "@/components/quotations/Quotations";
import { reportNumbersT } from "@/lib/translations/report-ui/numbers";
import type { Lang } from "@/lib/i18n";
import NumbersPrintDoc, { type Paper } from "./NumbersPrintDoc";

/** `failed`: the word that says why (locked by which permission, or not loaded). */
export type PaperResult = { paper: Paper } | { failed: string };
type Words = (key: string) => string;

export default function NumbersPrintPage({ build }: { build: (q: URLSearchParams, t: Words) => Promise<PaperResult> }) {
  const [state, setState] = useState<{ lang: Lang; auto: boolean; result: PaperResult } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams(window.location.search);
    const lang = ((["en", "zh", "ar"] as const).find((l) => l === q.get("lang")) ?? "en") as Lang;
    const t: Words = (key) => (reportNumbersT[key]?.[lang] ?? reportNumbersT[key]?.en ?? key) as string;
    void build(q, t).then((result) => { if (!cancelled) setState({ lang, auto: q.get("auto") === "1", result }); });
    return () => { cancelled = true; };
  }, [build]);

  const paper = state && "paper" in state.result ? state.result.paper : null;
  useEffect(() => { if (paper) document.title = paper.fileName; }, [paper]);

  const auto = !!state?.auto;
  const onReady = useCallback(() => {
    /* One frame so the sheets are painted before anything snapshots them. */
    requestAnimationFrame(() => {
      (window as unknown as { __quotation_pdf_ready__?: boolean }).__quotation_pdf_ready__ = true;
      if (auto) setTimeout(() => window.print(), 100);
    });
  }, [auto]);

  if (!state) return null;
  if (!paper) {
    const lang = state.lang;
    const word = "failed" in state.result ? state.result.failed : "num.error";
    return <div style={{ padding: 24, fontFamily: "system-ui" }}>{reportNumbersT[word]?.[lang] ?? reportNumbersT[word]?.en}</div>;
  }
  const t = (key: string) => (reportNumbersT[key]?.[state.lang] ?? reportNumbersT[key]?.en ?? key) as string;
  /* The Hub's <body> never scrolls (the shell's scroller does, and /print
     renders without the shell), so on SCREEN the sheets get a scroller of
     their own. Print is untouched: the rule is screen-only. */
  return (
    <>
      <style>{PRINT_AND_DOC_STYLES}</style>
      <style>{"@media screen { .kx-numbers-print-scroll { height: 100vh; overflow-y: auto; } }"}</style>
      <div className="kx-numbers-print-scroll">
        <div className="quot-print-root" style={{ background: "#fff", minHeight: "100vh", padding: 0 }}>
          <NumbersPrintDoc paper={paper} lang={state.lang} contWord={t("num.print.cont")} pageOfWord={t("num.print.pageOf")} onReady={onReady} />
        </div>
      </div>
    </>
  );
}
