"use client";

/* ---------------------------------------------------------------------------
   /crm — Koleex CRM (pipeline + opportunities + activities).

   Thin wrapper around <CRM /> so the route file stays minimal. Same pattern
   as /discuss — the actual UI lives in src/components/crm/CRM.tsx so it
   could be embedded elsewhere later (e.g. a contact-detail side panel).
   --------------------------------------------------------------------------- */

import { Suspense } from "react";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import dynamic from "next/dynamic";
import AppLoadingSkeleton from "@/components/ui/AppLoadingSkeleton";

/* SW-4: code-split the 158KB CRM board off the initial route bundle. It is a
   client-only interactive board (DnD) — ssr:false avoids shipping+hydrating it
   until the route actually renders. Skeleton prevents a blank flash. */
const CRM = dynamic(() => import("@/components/crm/CRM"), {
  ssr: false,
  loading: () => <AppLoadingSkeleton label="Loading CRM…" />,
});
import PermissionGate from "@/components/layout/PermissionGate";

export default function CrmPage() {
  return (
    <PermissionGate module="CRM">
      <Suspense
        fallback={
          <div className="flex-1 min-h-0 flex items-center justify-center bg-[var(--bg-primary)]">
            <SpinnerIcon className="h-5 w-5 animate-spin text-[var(--text-dim)]" />
          </div>
        }
      >
        <CRM />
      </Suspense>
    </PermissionGate>
  );
}
