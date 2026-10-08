import type { Translations } from "@/lib/i18n";

/* Finance — the `equity.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_EQUITY: Translations = {
  /* ── Equity (FinanceEquity.tsx) ──────────────────────────────────── */
  "equity.from":             { en: "From",            zh: "起始",        ar: "من" },
  "equity.to":               { en: "To",              zh: "截止",        ar: "إلى" },
  "equity.opening":          { en: "Opening equity",  zh: "期初权益",    ar: "حقوق الملكية الافتتاحية" },
  "equity.empty":            { en: "No equity movements in this period.",
                               zh: "本期无权益变动。",
                               ar: "لا توجد تحركات على حقوق الملكية في هذه الفترة." },
  "equity.netMovement":      { en: "Net equity movement", zh: "权益净变动", ar: "صافي حركة حقوق الملكية" },
  "equity.closing":          { en: "Closing equity",  zh: "期末权益",    ar: "حقوق الملكية الختامية" },
  "equity.retained":         { en: "Retained earnings (3100, period-end balance)",
                               zh: "留存收益（3100，期末余额）",
                               ar: "الأرباح المحتجزة (3100، الرصيد في نهاية الفترة)" },
  "equity.method":           { en: "Method",          zh: "方法",        ar: "المنهجية" },
  "equity.method.body":      { en: "Opening equity = balance of 3xxx accounts at period start. Owner contributions = net change on Owner Capital (3000). Current-year earnings = net profit from the P&L for the same period. Closing equity = opening + contributions + earnings.",
                               zh: "期初权益 = 期初 3xxx 系列科目余额。所有者出资 = 所有者资本（3000）的净变动。本年利润 = 同期损益表的净利润。期末权益 = 期初 + 出资 + 收益。",
                               ar: "حقوق الملكية الافتتاحية = رصيد حسابات 3xxx في بداية الفترة. مساهمات المالك = صافي التغير على رأس مال المالك (3000). أرباح السنة الجارية = صافي ربح قائمة الدخل لنفس الفترة. حقوق الملكية الختامية = الافتتاحية + المساهمات + الأرباح." },
};
