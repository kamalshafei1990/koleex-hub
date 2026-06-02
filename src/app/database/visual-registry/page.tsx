import { Suspense } from "react";
import PermissionGate from "@/components/layout/PermissionGate";
import ClassificationManager from "@/components/database/ClassificationManager";

export default function ClassificationPage() {
  return (
    <PermissionGate module="Database">
      <Suspense fallback={<div className="py-20 text-center text-[13px] text-[var(--text-dim)]">Loading…</div>}>
        <ClassificationManager />
      </Suspense>
    </PermissionGate>
  );
}
