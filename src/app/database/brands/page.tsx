import PermissionGate from "@/components/layout/PermissionGate";
import BrandsManager from "@/components/database/BrandsManager";

/* Brands is part of the KOLEEX visual identity — it lives inside the Database
   app's Visual Library. Rendered embedded under the shared DatabaseHeader. */
export default function DatabaseBrandsPage() {
  return (
    <PermissionGate module="Database">
      <BrandsManager embedded />
    </PermissionGate>
  );
}
