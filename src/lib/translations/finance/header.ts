import type { Translations } from "@/lib/i18n";

/* Finance — the `header.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_HEADER: Translations = {
  /* ── Header (FinanceHeader) ────────────────────────────────────── */
  "header.dataEntry":     { en: "Data Entry",        zh: "数据录入",          ar: "إدخال البيانات" },
  "header.create":        { en: "Create",            zh: "创建",              ar: "إنشاء" },
  "header.intelligence":  { en: "Intelligence",      zh: "智能分析",          ar: "الذكاء" },
  "header.setup":         { en: "Setup",             zh: "设置",              ar: "الإعداد" },
  "header.workspace":     { en: "Workspace",         zh: "工作台",            ar: "مساحة العمل" },
  "header.home":          { en: "Home",              zh: "首页",              ar: "الرئيسية" },
  "header.healthHealthy": { en: "Healthy",           zh: "健康",              ar: "صحي" },
  "header.healthHealthyHint":{ en: "Profit positive, cash flowing, nothing overdue.",
                              zh: "盈利、现金流入、无逾期。",
                              ar: "ربح موجب، تدفق نقدي مستمر، لا مستحقات متأخرة." },
  "header.healthWatch":   { en: "Watch",             zh: "关注",              ar: "تنبيه" },
  "header.healthWatchHint":{ en: "Some overdue items or tight cash position.",
                              zh: "存在逾期项或现金紧张。",
                              ar: "بعض البنود متأخرة أو السيولة ضيقة." },
  "header.healthStress":  { en: "Stress",            zh: "压力",              ar: "تحت ضغط" },
  "header.healthStressHint":{ en: "Negative net profit or major overdue exposure.",
                              zh: "净利润为负或存在重大逾期敞口。",
                              ar: "صافي ربح سالب أو انكشاف كبير على متأخرات." },
  "header.healthUnknownHint":{ en: "Not enough activity yet to score.",
                              zh: "活动尚不充足，无法评估。",
                              ar: "النشاط لا يكفي للتقييم بعد." },
  "header.backHub":       { en: "Back to Hub",       zh: "返回 Hub",           ar: "العودة إلى Hub" },
  "header.createTitle":   { en: "Create (c)",        zh: "创建 (c)",           ar: "إنشاء (c)" },
  "header.createAria":    { en: "Open Smart Create drawer (shortcut: c)",
                              zh: "打开 Smart Create 抽屉（快捷键：c）",
                              ar: "افتح درج Smart Create (اختصار: c)" },
};
