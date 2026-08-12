"use client";

import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuth";
import PermissionGate from "@/components/layout/PermissionGate";
import BrandLoading from "@/components/ui/BrandLoading";

const ProjectsApp = dynamic(() => import("@/components/projects/ProjectsApp"), {
  ssr: false,
  loading: () => <BrandLoading />,
});

export default function ProjectsPage() {
  return (
    <AdminAuth>
      <PermissionGate module="Projects">
        <ProjectsApp />
      </PermissionGate>
    </AdminAuth>
  );
}
