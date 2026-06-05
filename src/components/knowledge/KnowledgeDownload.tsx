"use client";

/* ---------------------------------------------------------------------------
   KnowledgeDownload — "Download PDF" affordance for every Knowledge article
   (report GEN-9). Triggers the browser's print → Save-as-PDF pipeline. The
   knowledge content is wrapped in [data-knowledge-doc] by the knowledge
   layout; the global @media print rules isolate that subtree so the exported
   PDF carries only the document, not the Hub chrome (header / sidebar / panel)
   or this button itself.

   Hidden in print via data-knowledge-print-hide.
   --------------------------------------------------------------------------- */

import DownloadIcon from "@/components/icons/ui/DownloadIcon";

export default function KnowledgeDownload() {
  return (
    <button
      type="button"
      data-knowledge-print-hide
      onClick={() => window.print()}
      title="Download this article as a PDF"
      className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)]/95 px-3.5 py-2 text-[12px] font-semibold text-[var(--text-primary)] shadow-lg backdrop-blur-md transition-colors hover:bg-[var(--bg-surface-hover)]"
    >
      <DownloadIcon size={14} />
      Download PDF
    </button>
  );
}
