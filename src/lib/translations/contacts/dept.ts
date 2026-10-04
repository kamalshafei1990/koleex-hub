import type { Translations } from "@/lib/i18n";

/* Contacts — the `dept.*` strings, split out of the one 225 KB dictionary.
   See the header of ../contacts.ts for why. */

export const CT_DEPT: Translations = {
  /* Department filter chips — shown under Profile Completeness on the supplier
     form. Tapping one shows only that department's sections. */
  "dept.filterHint":            { en: "Show fields for",           zh: "按部门筛选字段",         ar: "عرض حقول لـ" },
  "dept.all":                   { en: "All",                       zh: "全部",                 ar: "الكل" },
  "dept.procurement":           { en: "Procurement",               zh: "采购",                 ar: "المشتريات" },
  "dept.finance":               { en: "Finance",                   zh: "财务",                 ar: "المالية" },
  "dept.legal":                 { en: "Legal & Compliance",        zh: "法务与合规",            ar: "القانونية والامتثال" },
  "dept.logistics":             { en: "Logistics",                 zh: "物流",                 ar: "اللوجستيات" },
  "dept.quality":               { en: "Quality & Factory",         zh: "质量与工厂",            ar: "الجودة والمصنع" },
  "dept.commercial":            { en: "Commercial",                zh: "商务",                 ar: "التجاري" },
  "dept.general":               { en: "General",                   zh: "通用",                 ar: "عام" },
};
