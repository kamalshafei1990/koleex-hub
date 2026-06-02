"use client";

/* ---------------------------------------------------------------------------
   DatabaseHeader — thin wrapper around the shared PageHeader for the
   Database app (home for the KOLEEX Visual Library and future data sets).
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import PageHeader from "@/components/ui/PageHeader";
import type { PageTab } from "@/components/ui/PageHeader";
import { useTranslation, type Translations } from "@/lib/i18n";

const PRIMARY_TABS_RAW: Array<PageTab & { i18nKey: string }> = [
  { key: "/database",                label: "Home",           icon: "database", i18nKey: "db.nav.home" },
  { key: "/database/visual-library", label: "Visual Library", icon: "palette",  i18nKey: "db.nav.visualLibrary" },
  { key: "/database/collections",    label: "Collections",    icon: "books",    i18nKey: "db.nav.collections" },
  { key: "/database/review",         label: "Review Board",   icon: "badge-check", i18nKey: "db.nav.reviewBoard" },
  { key: "/database/visual-registry", label: "Registry",      icon: "box-circle-check", i18nKey: "db.nav.registry" },
];

const T: Translations = {
  "db.nav.home":          { en: "Home",           zh: "首页",     ar: "الرئيسية" },
  "db.nav.visualLibrary": { en: "Visual Library", zh: "视觉库",   ar: "مكتبة الصور" },
  "db.nav.collections":   { en: "Collections",    zh: "合集",     ar: "المجموعات" },
  "db.nav.reviewBoard":   { en: "Review Board",   zh: "审核台",   ar: "لوحة المراجعة" },
  "db.nav.registry":      { en: "Registry",       zh: "注册表",   ar: "السجل" },
};

export default function DatabaseHeader({
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

  const tabs: PageTab[] = PRIMARY_TABS_RAW.map((tab) => {
    const translated = t(tab.i18nKey);
    return { key: tab.key, icon: tab.icon, label: translated === tab.i18nKey ? tab.label : translated };
  });

  return (
    <PageHeader
      title={title}
      subtitle={subtitle}
      icon="database"
      action={action}
      controls={controls}
      meta={meta}
      tabs={tabs}
      showTabs={showTabs}
      searchPlaceholder="Search the Visual Library…"
      searchHref="/database/visual-library"
    />
  );
}
