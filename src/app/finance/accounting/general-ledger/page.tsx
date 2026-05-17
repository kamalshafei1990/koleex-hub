"use client";
import { Suspense } from "react";
import FinanceGeneralLedger from "@/components/finance/FinanceGeneralLedger";

/* useSearchParams() must sit under a <Suspense> boundary for the
   Next.js streaming build to work without warnings. */
export default function FinanceGeneralLedgerPage() {
  return (
    <Suspense fallback={<div className="px-6 py-8 text-sm text-gray-500">Loading ledger…</div>}>
      <FinanceGeneralLedger />
    </Suspense>
  );
}
