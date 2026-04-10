"use client";

import { useParams } from "next/navigation";
import AdminAuth from "@/components/admin/AdminAuth";
import AccountDetail from "@/components/admin/accounts/AccountDetail";

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  return (
    <AdminAuth
      title="Accounts Manager"
      subtitle="Super Admin access only"
    >
      {id ? (
        <AccountDetail accountId={id} />
      ) : (
        <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center">
          <p className="text-[var(--text-dim)]">No account selected.</p>
        </div>
      )}
    </AdminAuth>
  );
}
