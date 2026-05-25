"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import PurchaseRouteShell from "@/components/purchase/PurchaseRouteShell";
import CategoriesModule from "@/components/purchase/modules/Categories";

export default function PurchaseCategoriesRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return (
    <PurchaseRouteShell title="Spend Categories" subtitle="Classify spend for analytics. Maps to GL expense accounts.">
      <CategoriesModule t={t} lang={lang} />
    </PurchaseRouteShell>
  );
}
