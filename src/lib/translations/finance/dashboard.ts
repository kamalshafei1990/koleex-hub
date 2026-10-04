import type { Translations } from "@/lib/i18n";

/* Finance — the `dashboard.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_DASHBOARD: Translations = {
  "dashboard.title.long":   { en: "Financial Intelligence",       zh: "财务智能分析",            ar: "الذكاء المالي" },

  /* ── Dashboard / Intelligence ──────────────────────────────────── */
  "dashboard.title":        { en: "Financial Intelligence",       zh: "财务智能分析",            ar: "الذكاء المالي" },
  "dashboard.subtitle":     { en: "The deep-view dashboard — anomalies, pressure, concentration, and intelligence narratives.",
                              zh: "深度分析仪表板 — 异常、压力、集中度与智能解读。",
                              ar: "لوحة العرض المعمّق — الشذوذ والضغط والتركّز وقراءات الذكاء." },
  "dashboard.mode.operational":{en:"Operational",                 zh: "运营",                  ar: "تشغيلي" },
  "dashboard.mode.executive":{ en: "Executive",                   zh: "高管",                  ar: "تنفيذي" },
  "dashboard.period.week":  { en: "Week",                         zh: "本周",                  ar: "أسبوع" },
  "dashboard.period.quarter":{ en: "Quarter",                     zh: "本季度",                ar: "ربع سنوي" },
  "dashboard.period.year":  { en: "Year",                         zh: "本年",                  ar: "سنوي" },
};
