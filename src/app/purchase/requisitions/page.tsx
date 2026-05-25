"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import RequisitionsModule from "@/components/purchase/modules/Requisitions";

export default function PurchaseRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return <RequisitionsModule t={t} lang={lang} />;
}
