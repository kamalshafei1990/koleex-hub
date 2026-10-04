import type { Translations } from "@/lib/i18n";

/* Contacts — the `filter.*` strings, split out of the one 225 KB dictionary.
   See the header of ../contacts.ts for why. */

export const CT_FILTER: Translations = {
  "filter.notActive":     { en: "Inactive",              zh: "停用",                   ar: "غير نشط" },
  "filter.everyone":      { en: "Everyone",              zh: "全部",                   ar: "الجميع" },
  "filter.individuals":   { en: "Individuals",           zh: "个人",                   ar: "أفراد" },
  "filter.companies":     { en: "Companies",             zh: "公司",                   ar: "شركات" },
  "filter.allTiers":      { en: "All Tiers",             zh: "所有级别",               ar: "كل الفئات" },
};
