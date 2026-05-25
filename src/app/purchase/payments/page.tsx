"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import PurchaseRouteShell from "@/components/purchase/PurchaseRouteShell";
import PaymentsModule from "@/components/purchase/modules/Payments";

export default function PurchasePaymentsRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return (
    <PurchaseRouteShell title="Payments" subtitle="Outgoing payments to suppliers. Group bills into a payment run, or pay one-off.">
      <PaymentsModule t={t} lang={lang} />
    </PurchaseRouteShell>
  );
}
