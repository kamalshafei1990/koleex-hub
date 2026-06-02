import { Suspense } from "react";
import PermissionGate from "@/components/layout/PermissionGate";
import CollectionsBrowser from "@/components/database/CollectionsBrowser";

export default function CollectionsPage() {
  return (
    <PermissionGate module="Database">
      <Suspense fallback={<div className="py-20 text-center text-[13px] text-[var(--text-dim)]">Loading…</div>}>
        <CollectionsBrowser />
      </Suspense>
    </PermissionGate>
  );
}
