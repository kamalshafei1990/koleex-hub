import { Suspense } from "react";
import PermissionGate from "@/components/layout/PermissionGate";
import CollectionDetail from "@/components/database/CollectionDetail";

export default async function CollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PermissionGate module="Database">
      <Suspense fallback={<div className="py-20 text-center text-[13px] text-[var(--text-dim)]">Loading…</div>}>
        <CollectionDetail cid={id} />
      </Suspense>
    </PermissionGate>
  );
}
