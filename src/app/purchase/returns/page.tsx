"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import PurchaseRouteShell from "@/components/purchase/PurchaseRouteShell";
import ReturnsModule from "@/components/purchase/modules/Returns";

export default function PurchaseReturnsRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return (
    <PurchaseRouteShell title="Vendor Returns" subtitle="Send goods back to a supplier. Produces a credit memo and reverses stock.">
      <ReturnsModule t={t} lang={lang} />
    </PurchaseRouteShell>
  );
}
