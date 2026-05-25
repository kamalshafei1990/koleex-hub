"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import PurchaseRouteShell from "@/components/purchase/PurchaseRouteShell";
import ReceiptsModule from "@/components/purchase/modules/Receipts";

export default function PurchaseReceiptsRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return (
    <PurchaseRouteShell title="Goods Receipts" subtitle="Record what physically arrived. Each receipt posts a movement into inventory.">
      <ReceiptsModule t={t} lang={lang} />
    </PurchaseRouteShell>
  );
}
