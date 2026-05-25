"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import ReportsModule from "@/components/purchase/modules/Reports";

export default function PurchaseRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return <ReportsModule t={t} lang={lang} />;
}
