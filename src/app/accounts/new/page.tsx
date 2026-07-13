"use client";

import Link from "next/link";
import AuthGate from "@/components/admin/AuthGate";
import AccountForm from "@/components/admin/accounts/AccountForm";

export default function NewAccountPage() {
  return (
    <AuthGate
      title="Accounts Manager"
      subtitle="Super Admin access only"
    >
      {/* Signpost — this is the LOW-LEVEL tool. Real onboarding flows create
          the account together with its person/employee or customer context,
          so records stay linked and nothing is entered twice. */}
      <div className="mx-auto max-w-[860px] mb-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 text-[12px] text-[var(--text-dim)]">
        <span className="font-semibold text-[var(--text-primary)]">Onboarding someone?</span>{" "}
        For a new <Link href="/employees/new" className="underline underline-offset-2 hover:text-[var(--text-primary)]">employee, use the Employees wizard</Link>{" "}
        (creates the person + HR record + login in one step). For a customer login, open the customer in{" "}
        <Link href="/customers" className="underline underline-offset-2 hover:text-[var(--text-primary)]">Customers</Link>{" "}
        and use its <span className="text-[var(--text-primary)]">Account</span> tab. This form creates a bare account only.
      </div>
      <AccountForm mode="create" />
    </AuthGate>
  );
}
