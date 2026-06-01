import type { Translations } from "@/lib/i18n";

/* Shared, app-wide translation keys used by reusable UI components such as
   ProfileCompletenessBar. Import via `commonT` and pass to useTranslation. */

export const commonT: Translations = {
  "translate.showOriginal": { en: "show original", zh: "显示原文", ar: "عرض الأصل" },
  "translate.autoTranslated": { en: "auto-translated", zh: "自动翻译", ar: "ترجمة آلية" },
  "profile.completeness.title": {
    en: "Profile completeness",
    zh: "资料完成度",
    ar: "اكتمال الملف",
  },
  /* Placeholders: {filled}, {total}, {pct} */
  "profile.completeness.fields": {
    en: "{filled} / {total} fields · {pct}%",
    zh: "{filled} / {total} 字段 · {pct}%",
    ar: "{filled} / {total} حقول · {pct}%",
  },
};
