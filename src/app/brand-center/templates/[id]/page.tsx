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
/* svg-<design id>: a designer's own artwork as a template (C18) */
const SvgTemplateStudio = dynamic(() => import("@/components/brand-center/templates/SvgTemplateStudio"), {
  ssr: false,
  loading: () => <DirectoryListSkeleton label="Loading…" />,
});

export default function BrandTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AdminAuth>
      <PermissionGate module="Brand Center">
        {id.startsWith("svg-") ? <SvgTemplateStudio designId={id.slice(4)} /> : <TemplateStudio templateId={id} />}
      </PermissionGate>
    </AdminAuth>
  );
}
