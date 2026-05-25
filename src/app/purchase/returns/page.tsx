"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import PurchaseHeader from "@/components/purchase/PurchaseHeader";
import ReturnsModule from "@/components/purchase/modules/Returns";

export default function PurchaseReturnsRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-16 text-[var(--text-primary)] md:pb-6">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <PurchaseHeader
          title="Vendor Returns"
          subtitle="Send goods back to a supplier. Produces a credit memo and reverses stock."
        />
        <ReturnsModule t={t} lang={lang} />
      </div>
    </div>
  );
}
