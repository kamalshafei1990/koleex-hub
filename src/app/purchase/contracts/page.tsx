"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import ContractsModule from "@/components/purchase/modules/Contracts";

export default function PurchaseRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return <ContractsModule t={t} lang={lang} />;
}
