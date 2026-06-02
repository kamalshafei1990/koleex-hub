"use client";

/* ---------------------------------------------------------------------------
   SuppliersHeader — thin wrapper around the shared Hub PageHeader.

   Gives the Suppliers app the exact same chrome as every other Hub app
   (Inventory, Finance, …): back arrow + app icon + title + the sliding-pill
   tab strip. Owns only Suppliers-specific knowledge:

     · Which routes are primary tabs   (Directory · Command Center)
     · i18n labels for those routes
     · App icon (building)

   All layout/behaviour (sliding pill, sticky tab strip, responsive sizing,
   active-route longest-prefix matching) is delegated to PageHeader so the
   Suppliers app looks and behaves identically to the rest of the Hub.

   Used on the full-page Suppliers surfaces — the Supplier 360 detail and the
   Sourcing Command Center. The directory itself (/suppliers) is the shared
   Contacts master-detail shell and keeps that family's header; its "Directory"
   tab still lights up here via longest-prefix matching.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import PageHeader from "@/components/ui/PageHeader";
import type { PageTab } from "@/components/ui/PageHeader";
import { useTranslation, type Translations } from "@/lib/i18n";

const PRIMARY_TABS_RAW: Array<PageTab & { i18nKey: string }> = [
  /* Ordered as the natural workflow: browse every supplier → see sourcing
     coverage (who covers what, main/backup) → drill into tenant-wide
     intelligence. */
  { key: "/suppliers",          label: "Directory",      icon: "users",         i18nKey: "sup.nav.r.directory" },
  { key: "/suppliers/main",     label: "Main Suppliers", icon: "handshake",     i18nKey: "sup.nav.r.main" },
  { key: "/suppliers/sourcing", label: "Command Center", icon: "bullseye-arrow", i18nKey: "sup.nav.r.sourcing" },
];

const T: Translations = {
  "sup.nav.r.directory": { en: "Directory",      zh: "目录",       ar: "الدليل" },
  "sup.nav.r.sourcing":  { en: "Command Center", zh: "采购指挥中心", ar: "مركز القيادة" },
  "sup.nav.r.main":      { en: "Main Suppliers", zh: "主要供应商",   ar: "الموردون الرئيسيون" },
};

export default function SuppliersHeader({
  title,
  subtitle,
  action,
  controls,
  meta,
  showTabs = true,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  controls?: ReactNode;
  meta?: ReactNode;
  showTabs?: boolean;
}) {
  const { t } = useTranslation(T);

  const tabs: PageTab[] = PRIMARY_TABS_RAW.map((tab) => ({
    key: tab.key,
    icon: tab.icon,
    label: (() => {
      const translated = t(tab.i18nKey);
      return translated === tab.i18nKey ? tab.label : translated;
    })(),
  }));

  return (
    <PageHeader
      title={title}
      subtitle={subtitle}
      icon="building"
      backHref="/suppliers"
      action={action}
      controls={controls}
      meta={meta}
      tabs={tabs}
      showTabs={showTabs}
    />
  );
}
