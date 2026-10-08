import type { Translations } from "@/lib/i18n";

/* Contacts — the `owner.*` strings, split out of the one 225 KB dictionary.
   See the header of ../contacts.ts for why. */

export const CT_OWNER: Translations = {
  /* ═══════════════════════════════════════════════════════════════════════════
     SECTION OWNERS — which department / role is responsible for filling a
     section of the supplier record. Shown as a badge on each section header.
     ═══════════════════════════════════════════════════════════════════════════ */
  "owner.label":                { en: "Filled by",                 zh: "填写人",                ar: "يُعبّأ بواسطة" },
  "owner.updatedBy":            { en: "Updated by",                zh: "更新人",                ar: "حُدّث بواسطة" },
  "owner.procurement":          { en: "Procurement",               zh: "采购部",                ar: "المشتريات" },
  "owner.sourcing":             { en: "Sourcing",                  zh: "寻源部",                ar: "التوريد" },
  "owner.compliance":           { en: "Compliance / Legal",        zh: "合规 / 法务",            ar: "الامتثال / القانونية" },
  "owner.finance":              { en: "Finance / Treasury",        zh: "财务 / 资金部",          ar: "المالية / الخزينة" },
  "owner.logistics":            { en: "Logistics",                 zh: "物流部",                ar: "اللوجستيات" },
  "owner.quality":              { en: "Quality (QA)",              zh: "质量部",                ar: "الجودة" },
  "owner.sourcingQuality":      { en: "Sourcing / Quality",        zh: "寻源 / 质量",            ar: "التوريد / الجودة" },
  "owner.product":              { en: "Procurement / Product",     zh: "采购 / 产品",            ar: "المشتريات / المنتجات" },
  "owner.risk":                 { en: "Risk / Procurement Mgmt",   zh: "风控 / 采购管理",         ar: "المخاطر / إدارة المشتريات" },
  "owner.commercial":           { en: "Commercial / Buyer Lead",   zh: "商务 / 采购负责人",        ar: "التجاري / رئيس المشتريات" },
  "owner.management":           { en: "Management",                zh: "管理层",                ar: "الإدارة" },
  "owner.marketing":            { en: "Marketing",                 zh: "市场部",                ar: "التسويق" },
  "owner.anyTeam":              { en: "Any team",                  zh: "任意团队",              ar: "أي فريق" },
};
