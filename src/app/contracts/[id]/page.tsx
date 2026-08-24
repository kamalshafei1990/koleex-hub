"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuth";
import PermissionGate from "@/components/layout/PermissionGate";
import { EditorSkeleton } from "@/components/ui/skeletons/AppShellSkeletons";

/* A sales contract is a document of the invoice it was raised from, so it
   rides the Invoices permission rather than inventing a module of its own:
   anyone who may see the invoice may see what was agreed on it. */
const ContractDoc = dynamic(() => import("@/components/contracts/ContractDoc"), {
  ssr: false,
  loading: () => <EditorSkeleton label="Loading contract…" />,
});

export default function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AdminAuth>
      <PermissionGate module="Invoices">
        <ContractDoc id={id} />
      </PermissionGate>
    </AdminAuth>
  );
}
