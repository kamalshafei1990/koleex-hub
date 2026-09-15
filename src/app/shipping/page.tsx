"use client";

import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuth";
import PermissionGate from "@/components/layout/PermissionGate";
import { DirectoryListSkeleton } from "@/components/ui/skeletons/AppShellSkeletons";

/* The page is a Client Component, so this dynamic() IS a real split point —
   the code-split trap only bites when the caller is a Server Component, where
   every client reference in the route ships whether the branch renders or not. */
const ShippingApp = dynamic(() => import("@/components/shipping/ShippingApp"), {
  ssr: false,
  loading: () => <DirectoryListSkeleton label="Loading shipping…" />,
});

export default function ShippingPage() {
  return (
    <AdminAuth>
      <PermissionGate module="Shipping">
        <ShippingApp />
      </PermissionGate>
    </AdminAuth>
  );
}
