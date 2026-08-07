import PermissionGate from "@/components/layout/PermissionGate";
import UiComponentsCatalog from "@/components/database/ui-components/UiComponentsCatalog";
import KdsShowcase from "@/components/database/ui-components/KdsShowcase";

/* The "UI Components" section of the Visual Library — a catalog of every UI
   component in the system, organized by module and built on the design system. */
export default function UiComponentsPage() {
  return (
    <PermissionGate module="Database">
      <div className="px-4 md:px-6 pt-6 max-w-[1400px] mx-auto">
        <KdsShowcase />
      </div>
      <UiComponentsCatalog />
    </PermissionGate>
  );
}
