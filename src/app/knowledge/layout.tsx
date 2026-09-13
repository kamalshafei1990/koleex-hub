"use client";

import AuroraShell from "@/components/ui/AuroraShell";
import PermissionGate from "@/components/layout/PermissionGate";
import KnowledgeDownload from "@/components/knowledge/KnowledgeDownload";

export default function KnowledgeLayout({ children }: { children: React.ReactNode }) {
  /* [data-knowledge-doc] marks the article subtree so the global @media print
     rules can isolate it — the exported PDF carries the document only, not the
     Hub chrome. KnowledgeDownload (report GEN-9) triggers print → Save as PDF.
     AuroraShell adds the kx-app scope + the ground (Aurora only; Core and the
     printed document are untouched — print rules isolate [data-knowledge-doc]). */
  /* THE GATE GOES ON THE LAYOUT, so it covers the index and every document
     under it at once — commercial policy, product coding, supplier guides.
     "Knowledge" has been a governable module all along (it is in the app
     registry, and the permission system is deny-by-default), but no page ever
     asked the question, so the module existed and the door stood open.
     Super admins always pass; everyone else needs the grant. */
  return (
    <PermissionGate module="Knowledge">
      <AuroraShell>
        <div data-knowledge-doc>
          {children}
          <KnowledgeDownload />
        </div>
      </AuroraShell>
    </PermissionGate>
  );
}
