"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import PurchaseHeader from "@/components/purchase/PurchaseHeader";
import ContractsModule from "@/components/purchase/modules/Contracts";

export default function PurchaseContractsRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-16 text-[var(--text-primary)] md:pb-6">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <PurchaseHeader
          title="Contracts"
          subtitle="Term agreements with suppliers — pricing, volumes, burn-down."
        />
        <ContractsModule t={t} lang={lang} />
      </div>
    </div>
  );
}
