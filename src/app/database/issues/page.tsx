import { Suspense } from "react";
import PermissionGate from "@/components/layout/PermissionGate";
import QaReportsApp from "@/components/qa/QaReportsApp";

/* Issue Reports is its OWN app (owner 2026-08-07: totally separate from the
   Visual Library). The route stays under /database/issues so old links keep
   working; the Database layout renders a STANDALONE header for this segment.
   Permission module "Issue Reports" was grandfathered from Database rows, so
   nobody lost access in the split.
   Suspense boundary: QaReportsApp reads ?issue= via useSearchParams. */
export default function DatabaseIssuesPage() {
  return (
    <PermissionGate module="Issue Reports">
      <Suspense fallback={null}>
        <QaReportsApp embedded />
      </Suspense>
    </PermissionGate>
  );
}
