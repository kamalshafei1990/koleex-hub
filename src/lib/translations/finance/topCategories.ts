import type { Translations } from "@/lib/i18n";

/* Finance — the `topCategories.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_TOPCATEGORIES: Translations = {
  "topCategories.title":    { en: "Top expense categories",       zh: "主要费用类别",            ar: "أكبر فئات المصروفات" },
  "topCategories.subtitle": { en: "Biggest spend buckets this period.",
                              zh: "本期最大的支出类别。",
                              ar: "أكبر مجموعات الإنفاق في هذه الفترة." },
  "topCategories.empty":    { en: "No expenses recorded for this period.",
                              zh: "本期未记录任何费用。",
                              ar: "لم تُسجَّل مصروفات في هذه الفترة بعد." },
  "topCategories.itemOne":  { en: "item",                         zh: "项",                    ar: "بند" },
  "topCategories.itemMany": { en: "items",                        zh: "项",                    ar: "بنود" },
};
