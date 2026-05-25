"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import BillsModule from "@/components/purchase/modules/Bills";

export default function PurchaseRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return <BillsModule t={t} lang={lang} />;
}
