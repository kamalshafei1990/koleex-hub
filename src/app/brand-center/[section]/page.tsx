"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuthGate";
import PermissionGate from "@/components/layout/PermissionGate";
import { DirectoryListSkeleton } from "@/components/ui/skeletons/AppShellSkeletons";

const BrandSectionApp = dynamic(() => import("@/components/brand-center/BrandSectionApp"), {
  ssr: false,
  loading: () => <DirectoryListSkeleton label="Loading…" />,
});

export default function BrandSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = use(params);
  return (
    <AdminAuth>
      <PermissionGate module="Brand Center">
        <BrandSectionApp sectionKey={section} />
      </PermissionGate>
    </AdminAuth>
  );
}
