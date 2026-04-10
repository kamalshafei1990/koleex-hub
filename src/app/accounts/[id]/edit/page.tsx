"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AdminAuth from "@/components/admin/AdminAuth";
import AccountForm from "@/components/admin/accounts/AccountForm";
import { fetchAccountById } from "@/lib/accounts-admin";
import type { AccountRow } from "@/types/supabase";

export default function EditAccountPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [account, setAccount] = useState<AccountRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    (async () => {
      const a = await fetchAccountById(id);
      setAccount(a);
      setLoading(false);
    })();
  }, [id]);

  return (
    <AdminAuth
      title="Accounts Manager"
      subtitle="Super Admin access only"
    >
      {loading ? (
        <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
          <div className="max-w-[960px] mx-auto px-4 md:px-6 lg:px-8 py-8">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-64 bg-[var(--bg-surface-subtle)] rounded" />
              <div className="h-64 bg-[var(--bg-surface-subtle)] rounded-2xl" />
            </div>
          </div>
        </div>
      ) : account ? (
        <AccountForm mode="edit" account={account} />
      ) : (
        <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center">
          <p className="text-[var(--text-dim)]">Account not found.</p>
        </div>
      )}
    </AdminAuth>
  );
}
