"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import RFQsModule from "@/components/purchase/modules/RFQs";

export default function PurchaseRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return <RFQsModule t={t} lang={lang} />;
}
