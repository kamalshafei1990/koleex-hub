"use client";

/* Printing a filled template (plan step C7) — the house recipe: the /print
   route in an off-screen iframe, printed once the page says it is ready.
   The fill travels by the parent window (same origin), never by the URL:
   a card carries a person's mobile and email. */

import type { TemplateDef, TemplateValues } from "@/lib/brand-center/templates/types";

/** `def` travels with the job when the template is not in the registry (a
 *  designer's SVG, C18): the print page reads it from this same window. */
export interface PrintJob { templateId: string; values: TemplateValues; fileName: string; slug: string; def?: TemplateDef }
type Holder = Window & { __kxBrandPrint?: PrintJob; __quotation_pdf_ready__?: boolean };

export function printTemplate(job: PrintJob) {
  (window as Holder).__kxBrandPrint = job;
  const FRAME_ID = "koleex-brand-print-frame";
  document.getElementById(FRAME_ID)?.remove();
  const frame = document.createElement("iframe");
  frame.id = FRAME_ID;
  frame.title = job.fileName;
  Object.assign(frame.style, { position: "fixed", left: "-10000px", top: "0", width: "160mm", height: "120mm", border: "none" });
  frame.addEventListener("load", () => {
    let tries = 0;
    const ready = () => {
      const win = frame.contentWindow as Holder | null;
      if (win?.__quotation_pdf_ready__) { win.focus(); win.print(); }
      else if (++tries < 300) setTimeout(ready, 100);
    };
    ready();
  }, { once: true });
  frame.src = `/brand-center/templates/print?_t=${Date.now()}`;
  document.body.appendChild(frame);
}

/** The job this print page was opened for, or null (opened on its own). */
export function readPrintJob(): PrintJob | null {
  try {
    if (window.parent === window) return null;
    return (window.parent as Holder).__kxBrandPrint ?? null;
  } catch {
    return null;
  }
}
