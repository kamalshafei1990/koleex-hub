"use client";

/* ---------------------------------------------------------------------------
   DatabaseHeader — shared PageHeader for the Database app.

   The Database is a CONTAINER of data systems. Navigation is two-level:
   • At the Database home → dataset-level tabs (Home · Visual Library · …).
   • Inside a Visual Library route → that system's section tabs
     (‹ Database · Library · Collections · Classification · Review Board).
   This keeps the Database from looking like a single "icons" app — the Visual
   Library is clearly just one dataset that owns its own sub-sections.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import type { PageTab } from "@/components/ui/PageHeader";
import { useTranslation, type Translations } from "@/lib/i18n";

/* Routes that belong to the Visual Library system. */
const VL_PREFIXES = ["/database/visual-library", "/database/collections", "/database/review", "/database/visual-registry"];

const DATASET_TABS: Array<PageTab & { i18nKey: string }> = [
  { key: "/database",                label: "Home",           icon: "home",    i18nKey: "db.nav.home" },
  { key: "/database/visual-library", label: "Visual Library", icon: "palette", i18nKey: "db.nav.visualLibrary" },
];

const VL_SECTION_TABS: Array<PageTab & { i18nKey: string }> = [
  { key: "/database",                 label: "Database",       icon: "database",        i18nKey: "db.nav.database" },
  { key: "/database/visual-library",  label: "Library",        icon: "palette",         i18nKey: "db.nav.library" },
  { key: "/database/collections",     label: "Collections",    icon: "books",           i18nKey: "db.nav.collections" },
  { key: "/database/visual-registry", label: "Classification", icon: "box-circle-check", i18nKey: "db.nav.registry" },
  { key: "/database/review",          label: "Review Board",   icon: "badge-check",     i18nKey: "db.nav.reviewBoard" },
];

const T: Translations = {
  "db.nav.home":          { en: "Home",           zh: "首页",     ar: "الرئيسية" },
  "db.nav.database":      { en: "Database",       zh: "数据库",   ar: "قاعدة البيانات" },
  "db.nav.visualLibrary": { en: "Visual Library", zh: "视觉库",   ar: "مكتبة الصور" },
  "db.nav.library":       { en: "Library",        zh: "图库",     ar: "المكتبة" },
  "db.nav.collections":   { en: "Collections",    zh: "合集",     ar: "المجموعات" },
  "db.nav.reviewBoard":   { en: "Review Board",   zh: "审核台",   ar: "لوحة المراجعة" },
  "db.nav.registry":      { en: "Classification", zh: "分类",     ar: "التصنيف" },
};

export default function DatabaseHeader({
  title, subtitle, action, controls, meta, showTabs = true,
}: {
  title: string; subtitle?: string; action?: ReactNode; controls?: ReactNode; meta?: ReactNode; showTabs?: boolean;
}) {
  const { t } = useTranslation(T);
  const pathname = usePathname() ?? "/database";
  const inVisualLibrary = VL_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p));

  const raw = inVisualLibrary ? VL_SECTION_TABS : DATASET_TABS;
  const tabs: PageTab[] = raw.map((tab) => {
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
