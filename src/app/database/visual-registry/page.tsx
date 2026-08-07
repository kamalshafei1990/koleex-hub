import { Suspense } from "react";
import PermissionGate from "@/components/layout/PermissionGate";
import ClassificationIconHub from "@/components/database/ClassificationIconHub";

export default function ClassificationPage() {
  return (
    <PermissionGate module="Database">
      <Suspense fallback={<div className="py-20 text-center text-[13px] text-[var(--text-dim)]">Loading…</div>}>
        <div className="px-4 md:px-6 py-6 max-w-[1400px] mx-auto"><ClassificationIconHub /></div>
      </Suspense>
    </PermissionGate>
  );
}
