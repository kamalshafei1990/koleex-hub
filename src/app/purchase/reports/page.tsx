"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import PurchaseRouteShell from "@/components/purchase/PurchaseRouteShell";
import ReportsModule from "@/components/purchase/modules/Reports";

export default function PurchaseReportsRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return (
    <PurchaseRouteShell title="Spend Analytics" subtitle="By supplier, category, period. Find savings, monitor variance, score vendors.">
      <ReportsModule t={t} lang={lang} />
    </PurchaseRouteShell>
  );
}
