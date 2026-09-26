import type { Translations } from "@/lib/i18n";

/* Finance — the `uix.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_UIX: Translations = {
  /* FinanceUiX inline labels */
  "uix.mode.operational":      { en: "Operational",                     zh: "运营",                    ar: "تشغيلي" },
  "uix.mode.executive":        { en: "Executive",                       zh: "高管",                    ar: "تنفيذي" },
  "uix.mode.dailyOps":         { en: "Daily ops",                       zh: "日常运营",                ar: "العمليات اليومية" },
  "uix.mode.strategy":         { en: "Strategy",                        zh: "战略",                    ar: "الاستراتيجية" },
  "uix.mode.aria":             { en: "Finance view mode",               zh: "财务视图模式",            ar: "وضع عرض المالية" },
  "uix.liquidity.pressure":    { en: "Liquidity pressure",              zh: "流动性压力",              ar: "ضغط السيولة" },
  "uix.liquidity.inflow":      { en: "Inflow {pct}%",                   zh: "流入 {pct}%",            ar: "الداخل {pct}%" },
  "uix.aging.line":            { en: "line",                            zh: "行",                      ar: "سطر" },
  "uix.aging.lines":           { en: "lines",                           zh: "行",                      ar: "أسطر" },
  "uix.event.overdue":         { en: "Overdue",                         zh: "逾期",                    ar: "متأخر" },
  "uix.event.settled":         { en: "Settled",                         zh: "已结清",                  ar: "مسوّى" },
  "uix.event.unscheduled":     { en: "Unscheduled",                     zh: "未安排",                  ar: "غير مجدول" },
  "uix.timeline.overdueN":     { en: "{n} overdue",                     zh: "{n} 项逾期",              ar: "{n} متأخر" },
  "uix.timeline.dueSoonN":     { en: "{n} due ≤ 7d",                    zh: "{n} 项 ≤ 7 天到期",      ar: "{n} مستحق ≤ 7 أيام" },
  "uix.timeline.onRadar":      { en: "{n} lines on radar",              zh: "雷达上有 {n} 行",         ar: "{n} سطرًا في الرادار" },
  "uix.timeline.onRadarOne":   { en: "{n} line on radar",               zh: "雷达上有 {n} 行",         ar: "سطر واحد في الرادار" },
  "uix.timeline.nothingHere":  { en: "Nothing scheduled on this horizon.",
                                  zh: "此时间范围内暂无安排。",
                                  ar: "لا شيء مجدول في هذا الأفق." },
  "uix.timeline.dueShort":     { en: "≤ 7 d",                           zh: "≤ 7 天",                  ar: "≤ 7 أيام" },
};
