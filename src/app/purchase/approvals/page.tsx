"use client";

import { useTranslation } from "@/lib/i18n";
import { purchaseT } from "@/lib/translations/purchase";
import ApprovalsModule from "@/components/purchase/modules/Approvals";

export default function PurchaseRoute() {
  const { t, lang } = useTranslation(purchaseT);
  return <ApprovalsModule t={t} lang={lang} />;
}
