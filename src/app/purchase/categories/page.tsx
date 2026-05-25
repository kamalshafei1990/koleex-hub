"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import CategoriesModule from "@/components/purchase/modules/Categories";

export default function PurchaseRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return <CategoriesModule t={t} lang={lang} />;
}
