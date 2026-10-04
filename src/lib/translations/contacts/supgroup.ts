import type { Translations } from "@/lib/i18n";

/* Contacts — the `supgroup.*` strings, split out of the one 225 KB dictionary.
   See the header of ../contacts.ts for why. */

export const CT_SUPGROUP: Translations = {
  /* Supplier form group bands (Add / Edit supplier) */
  "supgroup.identity": { en: "Identity & profile", zh: "身份与概况", ar: "الهوية والملف التعريفي" },
  "supgroup.communication": { en: "Contacts & communication", zh: "联系人与沟通", ar: "جهات الاتصال والتواصل" },
  "supgroup.legal": { en: "Legal & compliance", zh: "法律与合规", ar: "القانونية والامتثال" },
  "supgroup.commercial": { en: "Commercial & logistics", zh: "商务与物流", ar: "التجارة والخدمات اللوجستية" },
  "supgroup.production": { en: "Products & production", zh: "产品与生产", ar: "المنتجات والإنتاج" },
  "supgroup.intelligence": { en: "Intelligence", zh: "情报", ar: "المعلومات" },
  "supgroup.records": { en: "Records & notes", zh: "记录与备注", ar: "السجلات والملاحظات" },
};
