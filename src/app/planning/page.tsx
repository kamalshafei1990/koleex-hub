"use client";

import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuth";
import PermissionGate from "@/components/layout/PermissionGate";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

const PlanningApp = dynamic(() => import("@/components/planning/PlanningApp"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)] animate-spin" />
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
