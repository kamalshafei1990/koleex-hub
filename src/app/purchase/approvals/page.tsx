"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import PurchaseRouteShell from "@/components/purchase/PurchaseRouteShell";
import ApprovalsModule from "@/components/purchase/modules/Approvals";

export default function PurchaseApprovalsRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return (
    <PurchaseRouteShell title="Approval Rules" subtitle="Threshold-driven approval routing. Who needs to sign off on what spend.">
      <ApprovalsModule t={t} lang={lang} />
    </PurchaseRouteShell>
  );
}
