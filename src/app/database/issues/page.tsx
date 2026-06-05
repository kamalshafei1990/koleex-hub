import { Suspense } from "react";
import PermissionGate from "@/components/layout/PermissionGate";
import QaReportsApp from "@/components/qa/QaReportsApp";

/* Issue Reports lives inside the Database app (a container of data systems).
   The Database layout renders the header + title; QaReportsApp runs embedded.
   Suspense boundary: QaReportsApp reads ?issue= via useSearchParams. */
export default function DatabaseIssuesPage() {
  return (
    <PermissionGate module="Database">
      <Suspense fallback={null}>
        <QaReportsApp embedded />
      </Suspense>
    </PermissionGate>
  );
}
