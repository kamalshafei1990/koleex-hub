"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import PurchaseRouteShell from "@/components/purchase/PurchaseRouteShell";
import ContractsModule from "@/components/purchase/modules/Contracts";

export default function PurchaseContractsRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return (
    <PurchaseRouteShell title="Contracts" subtitle="Term agreements with suppliers — pricing, volumes, burn-down.">
      <ContractsModule t={t} lang={lang} />
    </PurchaseRouteShell>
  );
}
