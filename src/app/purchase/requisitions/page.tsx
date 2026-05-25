"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import PurchaseHeader from "@/components/purchase/PurchaseHeader";
import RequisitionsModule from "@/components/purchase/modules/Requisitions";

export default function PurchaseRequisitionsRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-16 text-[var(--text-primary)] md:pb-6">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <PurchaseHeader
          title="Requisitions"
          subtitle="Internal purchase requests — the first step in procure-to-pay."
        />
        <RequisitionsModule t={t} lang={lang} />
      </div>
    </div>
  );
}
