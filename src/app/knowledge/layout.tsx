"use client";

import AuroraShell from "@/components/ui/AuroraShell";
import KnowledgeDownload from "@/components/knowledge/KnowledgeDownload";

export default function KnowledgeLayout({ children }: { children: React.ReactNode }) {
  /* [data-knowledge-doc] marks the article subtree so the global @media print
     rules can isolate it — the exported PDF carries the document only, not the
     Hub chrome. KnowledgeDownload (report GEN-9) triggers print → Save as PDF.
     AuroraShell adds the kx-app scope + the ground (Aurora only; Core and the
     printed document are untouched — print rules isolate [data-knowledge-doc]). */
  return (
    <AuroraShell>
      <div data-knowledge-doc>
        {children}
        <KnowledgeDownload />
      </div>
    </AuroraShell>
  );
}
