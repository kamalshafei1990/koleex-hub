"use client";

import { useParams } from "next/navigation";
import AuthGate from "@/components/admin/AuthGate";
import AccountDetail from "@/components/admin/accounts/AccountDetail";

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  return (
    <AuthGate
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
    </AuthGate>
  );
}
