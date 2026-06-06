"use client";

/* ---------------------------------------------------------------------------
   /database/* layout — renders the page wrapper + DatabaseHeader (sticky pill
   menu) ONCE for every route in the segment, mirroring /inventory/layout.tsx.
   Titles + subtitles are localized (en / zh / ar).
   --------------------------------------------------------------------------- */

import { usePathname } from "next/navigation";
import DatabaseHeader from "@/components/database/DatabaseHeader";
import { useTranslation, type Translations } from "@/lib/i18n";

interface RouteMeta { titleKey: string; titleEn: string; subKey: string; subEn: string }

const ROUTE_META: Record<string, RouteMeta> = {
  "/database":                 { titleKey: "db.page.database.title", titleEn: "Database", subKey: "db.page.database.sub", subEn: "Centralized data systems for the KOLEEX ecosystem." },
  "/database/visual-library":  { titleKey: "db.page.visualLibrary.title", titleEn: "Visual Library", subKey: "db.page.visualLibrary.sub", subEn: "One approved source of truth for every icon, image and visual asset." },
  "/database/collections":     { titleKey: "db.page.collections.title", titleEn: "Collections", subKey: "db.page.collections.sub", subEn: "Curated visual systems & icon packs — the KOLEEX design infrastructure." },
  "/database/review":          { titleKey: "db.page.review.title", titleEn: "Review Board", subKey: "db.page.review.sub", subEn: "Operational approval workflow — review, score and clear assets for production." },
  "/database/visual-registry": { titleKey: "db.page.registry.title", titleEn: "Classification", subKey: "db.page.registry.sub", subEn: "KOLEEX product hierarchy — divisions, categories, subcategories and types." },
  "/database/issues":          { titleKey: "db.page.issues.title", titleEn: "Issue Reports", subKey: "db.page.issues.sub", subEn: "Bugs, UI issues and suggestions reported from across the Hub." },
  "/database/brands":          { titleKey: "db.page.brands.title", titleEn: "Brands", subKey: "db.page.brands.sub", subEn: "Product brands and their logos — part of the KOLEEX visual identity." },
  "/database/components":      { titleKey: "db.page.components.title", titleEn: "UI Components", subKey: "db.page.components.sub", subEn: "Every UI component in the system — the KOLEEX design system in one place." },
};

const T: Translations = {
  "db.page.database.title": { en: "Database", zh: "数据库", ar: "قاعدة البيانات" },
  "db.page.database.sub": { en: "Centralized data systems for the KOLEEX ecosystem.", zh: "为 KOLEEX 生态系统提供集中式数据系统。", ar: "أنظمة بيانات مركزية لمنظومة KOLEEX." },
  "db.page.visualLibrary.title": { en: "Visual Library", zh: "视觉库", ar: "مكتبة الصور" },
  "db.page.visualLibrary.sub": { en: "One approved source of truth for every icon, image and visual asset.", zh: "每个图标、图像和视觉资产的唯一权威来源。", ar: "مصدر موثوق واحد لكل أيقونة وصورة وأصل بصري." },
  "db.page.collections.title": { en: "Collections", zh: "合集", ar: "المجموعات" },
  "db.page.collections.sub": { en: "Curated visual systems & icon packs — the KOLEEX design infrastructure.", zh: "精选视觉系统与图标包 — KOLEEX 设计基础设施。", ar: "أنظمة بصرية وحزم أيقونات منسّقة — البنية التصميمية لـ KOLEEX." },
  "db.page.review.title": { en: "Review Board", zh: "审核台", ar: "لوحة المراجعة" },
  "db.page.review.sub": { en: "Operational approval workflow — review, score and clear assets for production.", zh: "运营审批流程 — 审核、评分并批准资产投入生产。", ar: "سير عمل الموافقة التشغيلي — راجع وقيّم واعتمد الأصول للإنتاج." },
  "db.page.registry.title": { en: "Classification", zh: "分类", ar: "التصنيف" },
  "db.page.registry.sub": { en: "KOLEEX product hierarchy — divisions, categories, subcategories and types.", zh: "KOLEEX 产品层级 — 部门、类别、子类别和类型。", ar: "التسلسل الهرمي لمنتجات KOLEEX — الأقسام والفئات والفئات الفرعية والأنواع." },
  "db.page.issues.title": { en: "Issue Reports", zh: "问题报告", ar: "بلاغات المشاكل" },
  "db.page.issues.sub": { en: "Bugs, UI issues and suggestions reported from across the Hub.", zh: "来自整个 Hub 的缺陷、界面问题和建议。", ar: "الأخطاء ومشاكل الواجهة والاقتراحات الواردة من جميع أنحاء النظام." },
  "db.page.brands.title": { en: "Brands", zh: "品牌", ar: "العلامات التجارية" },
  "db.page.brands.sub": { en: "Product brands and their logos — part of the KOLEEX visual identity.", zh: "产品品牌及其标志 — KOLEEX 视觉识别的一部分。", ar: "علامات المنتجات وشعاراتها — جزء من الهوية البصرية لـ KOLEEX." },
  "db.page.components.title": { en: "UI Components", zh: "界面组件", ar: "مكوّنات الواجهة" },
  "db.page.components.sub": { en: "Every UI component in the system — the KOLEEX design system in one place.", zh: "系统中的全部界面组件 — KOLEEX 设计系统一览。", ar: "كل مكوّنات الواجهة في النظام — نظام تصميم KOLEEX في مكان واحد." },
};

function metaFor(pathname: string): RouteMeta {
  if (ROUTE_META[pathname]) return ROUTE_META[pathname];
  for (const prefix of Object.keys(ROUTE_META)) {
    if (prefix !== "/database" && pathname.startsWith(prefix + "/")) return ROUTE_META[prefix];
  }
  return ROUTE_META["/database"];
}

export default function DatabaseLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/database";
  const { t } = useTranslation(T);
  const meta = metaFor(pathname);
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-16 text-[var(--text-primary)] md:pb-6">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <DatabaseHeader title={t(meta.titleKey, meta.titleEn)} subtitle={t(meta.subKey, meta.subEn)} />
        {children}
      </div>
    </div>
  );
}
