import type { Translations } from "@/lib/i18n";

/* Shared, app-wide translation keys used by reusable UI components such as
   ProfileCompletenessBar. Import via `commonT` and pass to useTranslation. */

export const commonT: Translations = {
  /* Focus toggle — components/ui/focus/FocusMode.tsx. Lived in a home-only
     dictionary until /home was removed; FocusMode is used by Product Profile,
     Notes, Finance Workspace and the Executive Dashboard, so the keys moved
     here rather than dying with it. */
  "focus.off":       { en: "Focus",    zh: "\u4e13\u6ce8",     ar: "\u062a\u0631\u0643\u064a\u0632" },
  "focus.on":        { en: "Focus on", zh: "\u4e13\u6ce8\u4e2d", ar: "\u0627\u0644\u062a\u0631\u0643\u064a\u0632 \u0634\u063a\u0651\u0627\u0644" },
  "focus.exitTitle": { en: "Exit focus mode", zh: "\u9000\u51fa\u4e13\u6ce8\u6a21\u5f0f", ar: "\u0625\u0646\u0647\u0627\u0621 \u0648\u0636\u0639 \u0627\u0644\u062a\u0631\u0643\u064a\u0632" },
  "focus.enterTitle":{ en: "Hide secondary chrome while you work", zh: "\u5de5\u4f5c\u65f6\u9690\u85cf\u6b21\u8981\u754c\u9762", ar: "\u0625\u062e\u0641\u0627\u0621 \u0627\u0644\u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u062b\u0627\u0646\u0648\u064a\u0629 \u0623\u062b\u0646\u0627\u0621 \u0627\u0644\u0639\u0645\u0644" },
  "ui.loading": { en: "Loading\u2026", zh: "\u52a0\u8f7d\u4e2d\u2026", ar: "\u062c\u0627\u0631\u064d \u0627\u0644\u062a\u062d\u0645\u064a\u0644\u2026" },
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
