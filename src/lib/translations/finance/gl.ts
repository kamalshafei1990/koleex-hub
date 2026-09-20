import type { Translations } from "@/lib/i18n";

/* Finance — the `gl.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_GL: Translations = {
  /* ── General Ledger (FinanceGeneralLedger.tsx) ───────────────────── */
  "gl.openTB":               { en: "Trial Balance",   zh: "试算平衡表",  ar: "ميزان المراجعة" },
  "gl.account":              { en: "Account",         zh: "科目",        ar: "الحساب" },
  "gl.from":                 { en: "From",            zh: "起始",        ar: "من" },
  "gl.to":                   { en: "To",              zh: "截止",        ar: "إلى" },
  "gl.allTime":              { en: "All-time",        zh: "全部时间",    ar: "كل الفترات" },
  "gl.entriesCount":         { en: "{n} entries",     zh: "{n} 条分录",  ar: "{n} قيد" },
  "gl.opening":              { en: "Opening",         zh: "期初",        ar: "افتتاحي" },
  "gl.closing":              { en: "Closing",         zh: "期末",        ar: "ختامي" },
  "gl.type.asset":           { en: "Asset (debit-normal)",     zh: "资产（借方为正）",     ar: "أصل (الرصيد الطبيعي مدين)" },
  "gl.type.contra_asset":    { en: "Contra asset (credit-normal)",     zh: "资产备抵（贷方为正）", ar: "أصل مقابل (الرصيد الطبيعي دائن)" },
  "gl.type.liability":       { en: "Liability (credit-normal)", zh: "负债（贷方为正）",     ar: "خصم (الرصيد الطبيعي دائن)" },
  "gl.type.contra_liability":{ en: "Contra liability (debit-normal)",  zh: "负债备抵（借方为正）", ar: "خصم مقابل (الرصيد الطبيعي مدين)" },
  "gl.type.equity":          { en: "Equity (credit-normal)",    zh: "权益（贷方为正）",     ar: "حقوق ملكية (الرصيد الطبيعي دائن)" },
  "gl.type.contra_equity":   { en: "Contra equity (debit-normal)",     zh: "权益备抵（借方为正）", ar: "حقوق ملكية مقابلة (الرصيد الطبيعي مدين)" },
  "gl.type.revenue":         { en: "Revenue (credit-normal)",   zh: "收入（贷方为正）",     ar: "إيراد (الرصيد الطبيعي دائن)" },
  "gl.type.contra_revenue":  { en: "Contra revenue (debit-normal)",    zh: "收入备抵（借方为正）", ar: "إيراد مقابل (الرصيد الطبيعي مدين)" },
  "gl.type.expense":         { en: "Expense (debit-normal)",    zh: "费用（借方为正）",     ar: "مصروف (الرصيد الطبيعي مدين)" },
  "gl.type.contra_expense":  { en: "Contra expense (credit-normal)",   zh: "费用备抵（贷方为正）", ar: "مصروف مقابل (الرصيد الطبيعي دائن)" },
  "gl.col.date":             { en: "Date",            zh: "日期",        ar: "التاريخ" },
  "gl.col.journal":          { en: "Journal",         zh: "凭证号",      ar: "اليومية" },
  "gl.col.description":      { en: "Description",     zh: "摘要",        ar: "الوصف" },
  "gl.col.source":           { en: "Source",          zh: "来源",        ar: "المصدر" },
  "gl.col.debit":            { en: "Debit",           zh: "借方",        ar: "مدين" },
  "gl.col.credit":           { en: "Credit",          zh: "贷方",        ar: "دائن" },
  "gl.col.balance":          { en: "Balance",         zh: "余额",        ar: "الرصيد" },
  "gl.empty.title":          { en: "No activity",     zh: "无活动",      ar: "لا يوجد نشاط" },
  "gl.empty.hint":           { en: "No posted journal lines hit this account in the selected window.",
                               zh: "所选区间内没有针对该科目的已过账分录。",
                               ar: "لا توجد بنود يومية مرحَّلة على هذا الحساب خلال الفترة المختارة." },
  "gl.pageSummary":          { en: "{from}–{to} of {total}", zh: "第 {from}–{to} 条，共 {total} 条", ar: "{from}–{to} من {total}" },
  "gl.prev":                 { en: "Prev",            zh: "上一页",      ar: "السابق" },
  "gl.next":                 { en: "Next",            zh: "下一页",      ar: "التالي" },
};
