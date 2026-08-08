"use client";

import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuth";
import PermissionGate from "@/components/layout/PermissionGate";
import BrandLoading from "@/components/ui/BrandLoading";

/* The Invoices app is built as a direct document editor (A4 print-ready,
   rich per-line fields with images, number-to-words totals) — same shape
   as the Quotations app, loaded entirely client-side. */
const InvoicesDoc = dynamic(() => import("@/components/invoices-doc/InvoicesDoc"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <BrandLoading />
    </div>
  ),
});

export default function InvoicesPage() {
  return (
    <AdminAuth title="Invoices" subtitle="Sign in to access invoices">
      <PermissionGate module="Invoices">
        <InvoicesDoc />
      </PermissionGate>
    </AdminAuth>
  );
}
