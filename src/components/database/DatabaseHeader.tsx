"use client";

/* ---------------------------------------------------------------------------
   DatabaseHeader — shared PageHeader for the Database app.

   The Database is a CONTAINER of data systems. The nav is a SINGLE, stable,
   flat tab set used on every route in the app. Earlier it swapped between two
   different tab sets (dataset-level vs Visual-Library section-level) depending
   on the route — so the bar's contents reshuffled mid-app and the sliding pill
   couldn't glide (reported as "scrolling bar navigation not right"). One
   consistent set keeps it organized and lets the indicator move smoothly
   between any two destinations.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import PageHeader from "@/components/ui/PageHeader";
import type { PageTab } from "@/components/ui/PageHeader";
import { useTranslation, type Translations } from "@/lib/i18n";

const DB_TABS: Array<PageTab & { i18nKey: string }> = [
  { key: "/database",                 label: "Home",           icon: "home",             i18nKey: "db.nav.home" },
  { key: "/database/visual-library",  label: "Visual Library", icon: "palette",          i18nKey: "db.nav.visualLibrary" },
  { key: "/database/collections",     label: "Collections",    icon: "books",            i18nKey: "db.nav.collections" },
  { key: "/database/visual-registry", label: "Classification", icon: "box-circle-check", i18nKey: "db.nav.registry" },
  { key: "/database/review",          label: "Review Board",   icon: "badge-check",      i18nKey: "db.nav.reviewBoard" },
  { key: "/database/issues",          label: "Issue Reports",  icon: "megaphone",        i18nKey: "db.nav.issues" },
];

const T: Translations = {
  "db.nav.home":          { en: "Home",           zh: "首页",     ar: "الرئيسية" },
  "db.nav.visualLibrary": { en: "Visual Library", zh: "视觉库",   ar: "مكتبة الصور" },
  "db.nav.collections":   { en: "Collections",    zh: "合集",     ar: "المجموعات" },
  "db.nav.reviewBoard":   { en: "Review Board",   zh: "审核台",   ar: "لوحة المراجعة" },
  "db.nav.registry":      { en: "Classification", zh: "分类",     ar: "التصنيف" },
  "db.nav.issues":        { en: "Issue Reports",  zh: "问题报告", ar: "بلاغات المشاكل" },
};

export default function DatabaseHeader({
  title, subtitle, action, controls, meta, showTabs = true,
}: {
  title: string; subtitle?: string; action?: ReactNode; controls?: ReactNode; meta?: ReactNode; showTabs?: boolean;
}) {
  const { t } = useTranslation(T);

  const tabs: PageTab[] = DB_TABS.map((tab) => {
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
