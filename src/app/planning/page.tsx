"use client";

import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuth";
import PermissionGate from "@/components/layout/PermissionGate";
import BrandLoading from "@/components/ui/BrandLoading";

const PlanningApp = dynamic(() => import("@/components/planning/PlanningApp"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <BrandLoading className="min-h-screen" />
    </div>
  ),
});

export default function PlanningPage() {
  return (
    <AdminAuth title="Planning" subtitle="Sign in to access planning">
      <PermissionGate module="Planning">
        <PlanningApp />
      </PermissionGate>
    </AdminAuth>
  );
}
