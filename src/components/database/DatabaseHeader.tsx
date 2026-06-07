"use client";

/* ---------------------------------------------------------------------------
   DatabaseHeader — shared header for the Database app.

   Two-level navigation that mirrors the real hierarchy:

   • Top row (always): Database datasets — Home · Visual Library · Issue Reports.
   • Sub row (only inside Visual Library): the Visual Library's own sub-sections —
     General Icons · Collections · Classification · Review Board.

   Visual Library is the "visual identity" hub: everything visual lives under it.
   Rendering the two levels as two STABLE rows (instead of one bar that swaps its
   whole contents by route) keeps the nav organized and lets each row's sliding
   indicator glide smoothly — fixing the earlier "scrolling bar not right" report
   without flattening the hierarchy the user wants.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import type { PageTab } from "@/components/ui/PageHeader";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import { useTranslation, type Translations } from "@/lib/i18n";

/* Visual Library owns these routes (it's the parent "visual identity" section). */
const VL_PREFIXES = [
  "/database/visual-library",
  "/database/collections",
  "/database/visual-registry",
  "/database/review",
  "/database/brands",
  "/database/components",
];

const VL_SUBTABS: Array<{ key: string; label: string; icon: RrIconName; i18nKey: string }> = [
  { key: "/database/visual-library",  label: "General Icons", icon: "palette",          i18nKey: "db.nav.generalIcons" },
  { key: "/database/brands",          label: "Brands",        icon: "award",            i18nKey: "db.nav.brands" },
  { key: "/database/collections",     label: "Collections",   icon: "books",            i18nKey: "db.nav.collections" },
  { key: "/database/visual-registry", label: "Classification", icon: "box-circle-check", i18nKey: "db.nav.registry" },
  { key: "/database/components",      label: "UI Components", icon: "box-open",         i18nKey: "db.nav.components" },
  { key: "/database/review",          label: "Review Board",  icon: "badge-check",      i18nKey: "db.nav.reviewBoard" },
];

const T: Translations = {
  "db.nav.home":          { en: "Home",           zh: "首页",     ar: "الرئيسية" },
  "db.nav.visualLibrary": { en: "Visual Library", zh: "视觉库",   ar: "مكتبة الصور" },
  "db.nav.issues":        { en: "Issue Reports",  zh: "问题报告", ar: "بلاغات المشاكل" },
  "db.nav.generalIcons":  { en: "General Icons",  zh: "通用图标", ar: "الأيقونات العامة" },
  "db.nav.brands":        { en: "Brands",         zh: "品牌",     ar: "العلامات التجارية" },
  "db.nav.collections":   { en: "Collections",    zh: "合集",     ar: "المجموعات" },
  "db.nav.reviewBoard":   { en: "Review Board",   zh: "审核台",   ar: "لوحة المراجعة" },
  "db.nav.registry":      { en: "Classification", zh: "分类",     ar: "التصنيف" },
  "db.nav.components":    { en: "UI Components",  zh: "界面组件", ar: "مكوّنات الواجهة" },
  "db.search.placeholder": { en: "Search the Visual Library…", zh: "搜索视觉库…", ar: "ابحث في مكتبة الصور…" },
  "db.search.issues":      { en: "Search issue reports…",     zh: "搜索问题报告…", ar: "ابحث في بلاغات المشاكل…" },
};

function isOn(pathname: string, key: string): boolean {
  return pathname === key || pathname.startsWith(key + "/");
}

export default function DatabaseHeader({
  title, subtitle, action, controls, meta, showTabs = true,
}: {
  title: string; subtitle?: string; action?: ReactNode; controls?: ReactNode; meta?: ReactNode; showTabs?: boolean;
}) {
  const { t } = useTranslation(T);
  const pathname = usePathname() ?? "/database";
  const inVL = VL_PREFIXES.some((p) => isOn(pathname, p));
  const inIssues = isOn(pathname, "/database/issues");
  // On Issue Reports we hide the generic header search entirely — that page has
  // its OWN smart search (live title/tag/module/reporter suggestions) in the
  // filter row, so a second plain box here was redundant and confusing.
  // Elsewhere the header search drives the Visual Library.
  const searchPlaceholder = inIssues ? undefined : t("db.search.placeholder", "Search the Visual Library…");
  const searchHref = inIssues ? undefined : "/database/visual-library";

  /* Top-level dataset tabs. Active state is forced so the Visual Library tab
     stays lit on every sub-section route (Collections, Classification, …),
     and Home doesn't steal the highlight via prefix matching. */
  const topTabs: PageTab[] = [
    { key: "/database",                label: t("db.nav.home"),          icon: "home",      active: pathname === "/database" },
    { key: "/database/visual-library", label: t("db.nav.visualLibrary"), icon: "palette",   active: inVL },
    { key: "/database/issues",         label: t("db.nav.issues"),        icon: "megaphone", active: isOn(pathname, "/database/issues") },
  ];

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        icon="database"
        action={action}
        controls={controls}
        meta={meta}
        tabs={topTabs}
        showTabs={showTabs}
        searchPlaceholder={searchPlaceholder}
        searchHref={searchHref}
      />

      {/* Visual Library sub-sections — a stable second level shown only inside
          the Visual Library hub. */}
      {showTabs && inVL && (
        <nav
          aria-label="Visual Library sections"
          className="-mt-1 flex items-center gap-1 overflow-x-auto rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {VL_SUBTABS.map((s) => {
            const activeSub = isOn(pathname, s.key);
            return (
              <Link
                key={s.key}
                href={s.key}
                aria-current={activeSub ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[10px] px-3.5 py-2 text-[12.5px] transition-colors ${
                  activeSub
                    ? "bg-[var(--bg-inverted)] font-semibold text-[var(--text-inverted)] shadow-sm"
                    : "font-medium text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span aria-hidden className={activeSub ? "opacity-90" : "opacity-70"}>
                  <RrIcon name={s.icon} size={14} />
                </span>
                {(() => { const tr = t(s.i18nKey); return tr === s.i18nKey ? s.label : tr; })()}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
