import type { Translations } from "@/lib/i18n";

/* Contacts — the `supplier.*` strings, split out of the one 225 KB dictionary.
   See the header of ../contacts.ts for why. */

export const CT_SUPPLIER: Translations = {
  "supplier.commandCenter":     { en: "Sourcing Command Center",   zh: "寻源指挥中心",           ar: "مركز قيادة التوريد" },
  "supplier.commandCenterDesc": { en: "Tenant-wide procurement intelligence — ranking, dependencies & recommendations", zh: "全租户采购情报 — 排名、依赖关系与建议", ar: "ذكاء المشتريات على مستوى المؤسسة — الترتيب والاعتمادات والتوصيات" },
  "supplier.mainSuppliers":     { en: "Koleex Main Suppliers",     zh: "Koleex 主要供应商",        ar: "موردو Koleex الرئيسيون" },
  "supplier.mainSuppliersDesc": { en: "Sourcing coverage map — main/backup suppliers by division, category & subcategory", zh: "采购覆盖地图 — 按部门、类别和子类别划分的主要/备用供应商", ar: "خريطة تغطية التوريد — الموردون الرئيسيون/الاحتياطيون حسب القسم والفئة والفئة الفرعية" },
};
