"use client";

import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuth";
import PermissionGate from "@/components/layout/PermissionGate";
import BrandLoading from "@/components/ui/BrandLoading";

const ProjectsApp = dynamic(() => import("@/components/projects/ProjectsApp"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <BrandLoading />
    </div>
  ),
});

export default function ProjectsPage() {
  return (
    <AdminAuth title="Projects" subtitle="Sign in to access projects">
      <PermissionGate module="Projects">
        <ProjectsApp />
      </PermissionGate>
    </AdminAuth>
  );
}
