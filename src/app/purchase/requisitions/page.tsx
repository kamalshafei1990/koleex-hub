"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import PurchaseRouteShell from "@/components/purchase/PurchaseRouteShell";
import RequisitionsModule from "@/components/purchase/modules/Requisitions";

export default function PurchaseRequisitionsRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return (
    <PurchaseRouteShell title="Requisitions" subtitle="Internal purchase requests — the first step in procure-to-pay.">
      <RequisitionsModule t={t} lang={lang} />
    </PurchaseRouteShell>
  );
}
