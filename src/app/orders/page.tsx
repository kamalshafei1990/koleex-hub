"use client";

import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuth";
import PermissionGate from "@/components/layout/PermissionGate";
import { DirectoryListSkeleton } from "@/components/ui/skeletons/AppShellSkeletons";

const OrdersApp = dynamic(() => import("@/components/orders/OrdersApp"), {
  ssr: false,
  loading: () => <DirectoryListSkeleton label="Loading orders…" />,
});

export default function OrdersPage() {
  return (
    <AdminAuth>
      <PermissionGate module="Orders">
        <OrdersApp />
      </PermissionGate>
    </AdminAuth>
  );
}
