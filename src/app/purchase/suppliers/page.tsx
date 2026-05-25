"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import PurchaseRouteShell from "@/components/purchase/PurchaseRouteShell";
import SuppliersModule from "@/components/purchase/modules/Suppliers";

export default function PurchaseSuppliersRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return (
    <PurchaseRouteShell title="Suppliers" subtitle="Vendor master — scorecards, payment terms, lead times, contacts.">
      <SuppliersModule t={t} lang={lang} />
    </PurchaseRouteShell>
  );
}
