"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuthGate";
import PermissionGate from "@/components/layout/PermissionGate";
import { DirectoryListSkeleton } from "@/components/ui/skeletons/AppShellSkeletons";

const BrandItemApp = dynamic(() => import("@/components/brand-center/BrandItemApp"), {
  ssr: false,
  loading: () => <DirectoryListSkeleton label="Loading…" />,
});

export default function BrandItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AdminAuth>
      <PermissionGate module="Brand Center">
        <BrandItemApp itemId={id} />
      </PermissionGate>
    </AdminAuth>
  );
}
