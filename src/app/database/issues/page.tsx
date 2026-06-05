import PermissionGate from "@/components/layout/PermissionGate";
import QaReportsApp from "@/components/qa/QaReportsApp";

/* Issue Reports lives inside the Database app (a container of data systems).
   The Database layout renders the header + title; QaReportsApp runs embedded. */
export default function DatabaseIssuesPage() {
  return (
    <PermissionGate module="Database">
      <QaReportsApp embedded />
    </PermissionGate>
  );
}
