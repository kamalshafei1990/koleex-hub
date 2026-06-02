import { Suspense } from "react";
import PermissionGate from "@/components/layout/PermissionGate";
import VisualLibraryBrowser from "@/components/database/VisualLibraryBrowser";

export default function VisualLibraryPage() {
  return (
    <PermissionGate module="Database">
      <Suspense fallback={<div className="py-20 text-center text-[13px] text-[var(--text-dim)]">Loading…</div>}>
        <VisualLibraryBrowser />
      </Suspense>
    </PermissionGate>
  );
}
