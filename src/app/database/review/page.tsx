import { Suspense } from "react";
import PermissionGate from "@/components/layout/PermissionGate";
import ReviewBoard from "@/components/database/ReviewBoard";

export default function ReviewBoardPage() {
  return (
    <PermissionGate module="Database">
      <Suspense fallback={<div className="py-20 text-center text-[13px] text-[var(--text-dim)]">Loading…</div>}>
        <ReviewBoard />
      </Suspense>
    </PermissionGate>
  );
}
