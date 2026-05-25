"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import PurchaseRouteShell from "@/components/purchase/PurchaseRouteShell";
import RFQsModule from "@/components/purchase/modules/RFQs";

export default function PurchaseRFQsRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return (
    <PurchaseRouteShell title="Requests for Quote" subtitle="Ask suppliers to bid, then award to the best offer.">
      <RFQsModule t={t} lang={lang} />
    </PurchaseRouteShell>
  );
}
