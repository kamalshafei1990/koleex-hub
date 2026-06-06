import PermissionGate from "@/components/layout/PermissionGate";
import UiComponentsCatalog from "@/components/database/ui-components/UiComponentsCatalog";

/* The "UI Components" section of the Visual Library — a catalog of every UI
   component in the system, organized by module and built on the design system. */
export default function UiComponentsPage() {
  return (
    <PermissionGate module="Database">
      <UiComponentsCatalog />
    </PermissionGate>
  );
}
