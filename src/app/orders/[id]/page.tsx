"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuth";
import PermissionGate from "@/components/layout/PermissionGate";
import { DirectoryListSkeleton } from "@/components/ui/skeletons/AppShellSkeletons";

const OrderDetail = dynamic(() => import("@/components/orders/OrderDetail"), {
  ssr: false,
  loading: () => <DirectoryListSkeleton label="Loading orders…" />,
});

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AdminAuth>
      <PermissionGate module="Orders">
        <OrderDetail id={id} />
      </PermissionGate>
    </AdminAuth>
  );
}
