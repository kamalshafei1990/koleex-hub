import type { Translations } from "@/lib/i18n";

/* Shared, app-wide translation keys used by reusable UI components such as
   ProfileCompletenessBar. Import via `commonT` and pass to useTranslation. */

export const commonT: Translations = {
  "translate.showOriginal": { en: "show original", zh: "显示原文", ar: "عرض الأصل" },
  "translate.autoTranslated": { en: "auto-translated", zh: "自动翻译", ar: "ترجمة آلية" },
  "profile.tier.required": { en: "Required", zh: "必填", ar: "مطلوب" },
  "profile.tier.preferred": { en: "Preferred", zh: "建议填写", ar: "مُفضّل" },
  "profile.tier.optional": { en: "Optional", zh: "可选", ar: "اختياري" },
  "profile.tier.overall": { en: "Overall", zh: "总体", ar: "الإجمالي" },
  "profile.ready": { en: "Ready", zh: "已就绪", ar: "جاهز" },
  /* Placeholder: {n} */
  "profile.requiredLeft": { en: "{n} required left", zh: "还差 {n} 项必填", ar: "متبقٍ {n} مطلوب" },
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
