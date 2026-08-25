"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuth";
import PermissionGate from "@/components/layout/PermissionGate";
import { EditorSkeleton } from "@/components/ui/skeletons/AppShellSkeletons";

/* Gated on Contracts, its own module since the Contracts app shipped. It
   rode Invoices while a contract was only reachable FROM an invoice; now that
   it has a list of its own, "may bill a customer" and "may read every
   agreement Koleex has signed" are separate decisions. */
const ContractDoc = dynamic(() => import("@/components/contracts/ContractDoc"), {
  ssr: false,
  loading: () => <EditorSkeleton label="Loading contract…" />,
});

export default function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AdminAuth>
      <PermissionGate module="Contracts">
        <ContractDoc id={id} />
      </PermissionGate>
    </AdminAuth>
  );
}
