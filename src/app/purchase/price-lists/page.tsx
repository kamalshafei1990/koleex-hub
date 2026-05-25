"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import PurchaseRouteShell from "@/components/purchase/PurchaseRouteShell";
import PriceListsModule from "@/components/purchase/modules/PriceLists";

export default function PurchasePriceListsRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return (
    <PurchaseRouteShell title="Price Lists" subtitle="Supplier catalog pricing. Drives PO line defaults and price-variance checks.">
      <PriceListsModule t={t} lang={lang} />
    </PurchaseRouteShell>
  );
}
