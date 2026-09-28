"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuthGate";
import PermissionGate from "@/components/layout/PermissionGate";
import { DirectoryListSkeleton } from "@/components/ui/skeletons/AppShellSkeletons";

const TemplateStudio = dynamic(() => import("@/components/brand-center/templates/TemplateStudio"), {
  ssr: false,
  loading: () => <DirectoryListSkeleton label="Loading…" />,
});

export default function BrandTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AdminAuth>
      <PermissionGate module="Brand Center">
        <TemplateStudio templateId={id} />
      </PermissionGate>
    </AdminAuth>
  );
}
