"use client";

import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuth";
import PermissionGate from "@/components/layout/PermissionGate";
import { DirectoryListSkeleton } from "@/components/ui/skeletons/AppShellSkeletons";

const ContractsApp = dynamic(() => import("@/components/contracts/ContractsApp"), {
  ssr: false,
  loading: () => <DirectoryListSkeleton label="Loading contracts…" />,
});

export default function ContractsPage() {
  return (
    <AdminAuth>
      <PermissionGate module="Contracts">
        <ContractsApp />
      </PermissionGate>
    </AdminAuth>
  );
}
