"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import ReturnsModule from "@/components/purchase/modules/Returns";

export default function PurchaseRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return <ReturnsModule t={t} lang={lang} />;
}
