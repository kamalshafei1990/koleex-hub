import type { Translations } from "@/lib/i18n";

/* Finance — the `error.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_ERROR: Translations = {
  /* Toasts / errors */
  "error.generic":        { en: "Something went wrong. Please try again.",
                            zh: "出现错误，请重试。",
                            ar: "حدث خطأ ما. حاول مرة أخرى." },
  "error.loadFailed":     { en: "Couldn't load data.", zh: "无法加载数据。",   ar: "تعذّر تحميل البيانات." },
};
