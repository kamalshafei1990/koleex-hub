"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import PriceListsModule from "@/components/purchase/modules/PriceLists";

export default function PurchaseRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return <PriceListsModule t={t} lang={lang} />;
}
