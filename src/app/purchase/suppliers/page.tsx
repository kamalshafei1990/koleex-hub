"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import SuppliersModule from "@/components/purchase/modules/Suppliers";

export default function PurchaseRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return <SuppliersModule t={t} lang={lang} />;
}
