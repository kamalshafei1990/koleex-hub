"use client";

/* ---------------------------------------------------------------------------
   /crm — Koleex CRM (pipeline + opportunities + activities).

   Thin wrapper around <CRM /> so the route file stays minimal. Same pattern
   as /discuss — the actual UI lives in src/components/crm/CRM.tsx so it
   could be embedded elsewhere later (e.g. a contact-detail side panel).
   --------------------------------------------------------------------------- */

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import CRM from "@/components/crm/CRM";

export default function CrmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 min-h-0 flex items-center justify-center bg-[var(--bg-primary)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--text-dim)]" />
        </div>
      }
    >
      <CRM />
    </Suspense>
  );
}
