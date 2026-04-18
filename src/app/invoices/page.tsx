"use client";

import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuth";
import PermissionGate from "@/components/layout/PermissionGate";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

const InvoicesApp = dynamic(() => import("@/components/invoices/InvoicesApp"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)] animate-spin" />
    </div>
  ),
});

export default function InvoicesPage() {
  return (
    <AdminAuth title="Invoices" subtitle="Sign in to access invoices">
      <PermissionGate module="Invoices">
        <InvoicesApp />
      </PermissionGate>
    </AdminAuth>
  );
}
