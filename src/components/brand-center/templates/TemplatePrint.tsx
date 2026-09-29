"use client";

/* ---------------------------------------------------------------------------
   /brand-center/templates/print — the paper of a filled template (C7).

   One print page per side at the real size plus the print margin (bleed,
   crop marks, slug): @page is sized to it, so "Save as PDF" at 100% gives
   the printer a 1:1 file. No Hub shell (the /print suffix) and no Brand
   Center ground (the segment layout skips /print). Rendered in the browser
   only — the fill is read from the window that opened it.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { brandCenterTemplatesT } from "@/lib/translations/brand-center-templates";
import { templateById } from "@/lib/brand-center/templates/registry";
import { qrCodes } from "@/lib/brand-center/templates/qr";
import TemplateSheet, { sheetSize } from "./TemplateSheet";
import { readPrintJob } from "./print";

export default function TemplatePrint() {
  const { t } = useTranslation(brandCenterTemplatesT);
  const [job] = useState(readPrintJob);
  const def = job ? (job.def ?? templateById(job.templateId)) : null;
  const qrs = useMemo(() => (def && job ? qrCodes(def.qrRequests?.(job.values)) : {}), [def, job]);

  useEffect(() => {
    if (!def || !job) return;
    document.title = job.fileName;
    let alive = true;
    void document.fonts.ready.then(() => requestAnimationFrame(() => {
      if (alive) (window as Window & { __quotation_pdf_ready__?: boolean }).__quotation_pdf_ready__ = true;
    }));
    return () => { alive = false; };
  }, [def, job]);

  if (!def || !job) return <p style={{ padding: 24, fontFamily: "system-ui" }}>{t("print.none")}</p>;
  const { outerW, outerH } = sheetSize(def, job.values, "print");
  return (
    <>
      <style>{`
        @page { size: ${outerW}mm ${outerH}mm; margin: 0; }
        html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
        /* The Hub's <body> is a full-height flex column that never scrolls:
           as-is it would squeeze the pages to fit one screen. */
        @media print { html, body { height: auto !important; overflow: visible !important; display: block !important; } }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .kx-brand-page { flex: none; width: ${outerW}mm; height: ${outerH}mm; overflow: hidden; }
        /* Break BEFORE each later side, never after the last: <body> holds
           more than these pages, so :last-child cannot be relied on. */
        .kx-brand-page + .kx-brand-page { break-before: page; page-break-before: always; }
        .kx-brand-page svg { display: block; }
      `}</style>
      {def.pages.filter((p) => !def.pagesFor || def.pagesFor(job.values).includes(p.id)).map((p) => (
        <div key={p.id} className="kx-brand-page">
          <TemplateSheet def={def} values={job.values} pageId={p.id} qrs={qrs} mode="print"
            slug={`${job.slug} · ${t(`tpl.page.${p.id}`)}`} />
        </div>
      ))}
    </>
  );
}
