"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import ReceiptsModule from "@/components/purchase/modules/Receipts";

export default function PurchaseRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return <ReceiptsModule t={t} lang={lang} />;
}
