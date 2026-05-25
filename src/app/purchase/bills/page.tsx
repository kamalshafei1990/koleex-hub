"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import PurchaseRouteShell from "@/components/purchase/PurchaseRouteShell";
import BillsModule from "@/components/purchase/modules/Bills";

export default function PurchaseBillsRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return (
    <PurchaseRouteShell title="Vendor Bills" subtitle="Supplier invoices, 3-way matched against POs + receipts before posting to AP.">
      <BillsModule t={t} lang={lang} />
    </PurchaseRouteShell>
  );
}
