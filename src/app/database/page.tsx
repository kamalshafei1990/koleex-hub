import PermissionGate from "@/components/layout/PermissionGate";
import DatabaseHome from "@/components/database/DatabaseHome";

export default function DatabasePage() {
  return (
    <PermissionGate module="Database">
      <DatabaseHome />
    </PermissionGate>
  );
}
