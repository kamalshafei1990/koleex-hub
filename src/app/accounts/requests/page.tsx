"use client";

/* Lives under /accounts because the outcome of a request IS an account, and
   the reviewer's next step is to go and create one. A separate app in the
   sidebar would have meant a new entry in the registry, in Roles, in the
   launcher and in the performance budgets — for a screen a handful of people
   open a handful of times a month.

   Access is checked by the API on the predicate "are you a reviewer?", not by
   the Accounts module: a Super Admin can nominate anyone onto the rota, and
   gating this page on Accounts permissions would have made that nomination
   quietly useless. */

import AuthGate from "@/components/admin/AuthGate";
import MembershipRequests from "@/components/admin/accounts/MembershipRequests";

export default function MembershipRequestsPage() {
  return (
    <AuthGate>
      <MembershipRequests />
    </AuthGate>
  );
}
