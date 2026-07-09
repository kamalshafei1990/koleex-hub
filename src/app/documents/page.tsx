"use client";

import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuth";
import PermissionGate from "@/components/layout/PermissionGate";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/* Documents = a library of Koleex's official document formats (Quotation,
   Invoice to start). Each opens the SAME A4 design used by the live
   Quotations/Invoices apps, but blank — a fillable, printable template that
   is not saved as a real record. Loads client-side only: it mounts
   QuotationA4Preview, which is a browser-only component. */
const DocumentsApp = dynamic(() => import("@/components/documents/DocumentsApp"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)] animate-spin" />
    </div>
  ),
});

export default function DocumentsPage() {
  return (
    <AdminAuth title="Documents" subtitle="Sign in to access document templates">
      <PermissionGate module="Documents">
        <DocumentsApp />
      </PermissionGate>
    </AdminAuth>
  );
}
