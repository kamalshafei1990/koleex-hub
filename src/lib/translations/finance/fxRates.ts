import type { Translations } from "@/lib/i18n";

/* Finance — the `fxRates.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_FXRATES: Translations = {
  "fxRates.subtitle.long":  { en: "Record FX rates used for converting non-base currency transactions.",
                              zh: "记录用于换算非基础币种交易的汇率。",
                              ar: "سجّل أسعار الصرف المستخدمة لتحويل المعاملات بعملة غير الأساسية." },
  "fxRates.title":          { en: "Exchange Rates",               zh: "汇率管理",               ar: "أسعار الصرف" },
  "fxRates.subtitle":       { en: "Record FX rates used for converting non-base currency transactions.",
                              zh: "记录用于换算非基础币种交易的汇率。",
                              ar: "سجّل أسعار الصرف المستخدمة لتحويل المعاملات بعملة غير العملة الأساسية." },
  "fxRates.from":           { en: "From",                         zh: "源币种",                ar: "من" },
  "fxRates.to":             { en: "To",                           zh: "目标币种",               ar: "إلى" },
  "fxRates.rate":           { en: "Rate",                         zh: "汇率",                  ar: "السعر" },
  "fxRates.effective":      { en: "Effective date",               zh: "生效日期",               ar: "تاريخ السريان" },
  "fxRates.addRate":        { en: "Add rate",                     zh: "添加汇率",               ar: "إضافة سعر" },
};
