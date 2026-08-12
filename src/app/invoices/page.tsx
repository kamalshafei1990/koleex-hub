"use client";

import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuth";
import PermissionGate from "@/components/layout/PermissionGate";
import { EditorSkeleton } from "@/components/ui/skeletons/AppShellSkeletons";

/* The Invoices app is built as a direct document editor (A4 print-ready,
   rich per-line fields with images, number-to-words totals) — same shape
   as the Quotations app, loaded entirely client-side. */
const InvoicesDoc = dynamic(() => import("@/components/invoices-doc/InvoicesDoc"), {
  ssr: false,
  loading: () => <EditorSkeleton label="Loading invoices…" />,
});

export default function InvoicesPage() {
  return (
    <AdminAuth>
      <PermissionGate module="Invoices">
        <InvoicesDoc />
      </PermissionGate>
    </AdminAuth>
  );
}
