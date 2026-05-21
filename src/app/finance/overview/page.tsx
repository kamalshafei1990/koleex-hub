"use client";

/* /finance/overview — operator-friendly alias for VisualStatements.
   The Coffee-Inc-2-style statements page already exists; this route
   makes it a top-level destination from the new Finance Home tiles. */

import VisualStatements from "@/components/finance/VisualStatements";

export default function FinanceOverviewPage() {
  return <VisualStatements />;
}
