"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import PurchaseHeader from "@/components/purchase/PurchaseHeader";
import RFQsModule from "@/components/purchase/modules/RFQs";

export default function PurchaseRFQsRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-16 text-[var(--text-primary)] md:pb-6">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <PurchaseHeader
          title="Requests for Quote"
          subtitle="Ask suppliers to bid. Compare quotes side by side, then award to a winner."
        />
        <RFQsModule t={t} lang={lang} />
      </div>
    </div>
  );
}
