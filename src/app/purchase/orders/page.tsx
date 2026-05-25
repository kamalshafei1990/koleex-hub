"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import PurchaseRouteShell from "@/components/purchase/PurchaseRouteShell";
import OrdersModule from "@/components/purchase/modules/Orders";

export default function PurchaseOrdersRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return (
    <PurchaseRouteShell title="Purchase Orders" subtitle="Confirmed buy commitments. Receive against them as goods arrive.">
      <OrdersModule t={t} lang={lang} />
    </PurchaseRouteShell>
  );
}
