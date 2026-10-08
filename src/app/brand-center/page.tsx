"use client";

import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuthGate";
import PermissionGate from "@/components/layout/PermissionGate";
import { DirectoryListSkeleton } from "@/components/ui/skeletons/AppShellSkeletons";

const BrandCenterApp = dynamic(() => import("@/components/brand-center/BrandCenterApp"), {
  ssr: false,
  loading: () => <DirectoryListSkeleton label="Loading Brand Center…" />,
});

export default function BrandCenterPage() {
  return (
    <AdminAuth>
      <PermissionGate module="Brand Center">
        <BrandCenterApp />
      </PermissionGate>
    </AdminAuth>
  );
}
