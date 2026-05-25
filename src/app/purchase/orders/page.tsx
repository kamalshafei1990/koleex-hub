"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import OrdersModule from "@/components/purchase/modules/Orders";

export default function PurchaseRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return <OrdersModule t={t} lang={lang} />;
}
