"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import PaymentsModule from "@/components/purchase/modules/Payments";

export default function PurchaseRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return <PaymentsModule t={t} lang={lang} />;
}
