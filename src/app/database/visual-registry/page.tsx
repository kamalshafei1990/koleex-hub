import { Suspense } from "react";
import PermissionGate from "@/components/layout/PermissionGate";
import RegistryBrowser from "@/components/database/RegistryBrowser";

export default function VisualRegistryPage() {
  return (
    <PermissionGate module="Database">
      <Suspense fallback={<div className="py-20 text-center text-[13px] text-[var(--text-dim)]">Loading…</div>}>
        <RegistryBrowser />
      </Suspense>
    </PermissionGate>
  );
}
