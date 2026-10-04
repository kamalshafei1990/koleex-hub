import type { Translations } from "@/lib/i18n";

/* Finance — the `tb.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_TB: Translations = {
  /* ── Trial Balance (FinanceTrialBalance.tsx) ─────────────────────── */
  "tb.group.assets":         { en: "Assets",          zh: "资产",        ar: "الأصول" },
  "tb.group.liabilities":    { en: "Liabilities",     zh: "负债",        ar: "الخصوم" },
  "tb.group.equity":         { en: "Equity",          zh: "权益",        ar: "حقوق الملكية" },
  "tb.group.revenue":        { en: "Revenue",         zh: "收入",        ar: "الإيرادات" },
  "tb.group.expenses":       { en: "Expenses",        zh: "费用",        ar: "المصروفات" },
  "tb.openGL":               { en: "Open General Ledger", zh: "打开总账", ar: "فتح الدفتر العام" },
  "tb.from":                 { en: "From",            zh: "起始",        ar: "من" },
  "tb.to":                   { en: "To",              zh: "截止",        ar: "إلى" },
  "tb.resetAllTime":         { en: "Reset to all-time", zh: "重置为全部时间", ar: "إعادة إلى كل الفترات" },
  "tb.last365":              { en: "Last 365 days",   zh: "近 365 天",   ar: "آخر 365 يومًا" },
  "tb.asOf":                 { en: "As of {date}",    zh: "截至 {date}", ar: "حتى {date}" },
  "tb.accountsCount":        { en: "{n} accounts",    zh: "{n} 个科目",  ar: "{n} حساب" },
  "tb.col.code":             { en: "Code",            zh: "代码",        ar: "الرمز" },
  "tb.col.account":          { en: "Account",         zh: "科目",        ar: "الحساب" },
  "tb.col.debit":            { en: "Debit",           zh: "借方",        ar: "مدين" },
  "tb.col.credit":           { en: "Credit",          zh: "贷方",        ar: "دائن" },
  "tb.col.balance":          { en: "Balance",         zh: "余额",        ar: "الرصيد" },
  "tb.totals":               { en: "Totals",          zh: "合计",        ar: "الإجماليات" },
  "tb.diff":                 { en: "Difference",      zh: "差额",        ar: "الفرق" },
  "tb.outOfBalance":         { en: "Ledger is out of balance — investigate before relying on this trial balance.",
                               zh: "账目不平衡 — 请先核查后再使用此试算平衡表。",
                               ar: "الدفتر غير متوازن — يلزم التحقق قبل الاعتماد على ميزان المراجعة هذا." },
  "tb.empty.title":          { en: "No accounts yet", zh: "暂无科目",    ar: "لا توجد حسابات بعد" },
  "tb.empty.hint":           { en: "The chart of accounts seeds on first read. If you're seeing this, the tenant has accounts but no posted activity — start by posting a payment or an opening balance.",
                               zh: "首次读取时会自动初始化科目表。若看到此提示，说明科目已建立但尚无已过账活动 — 请先录入一笔付款或期初余额。",
                               ar: "يتم إنشاء دليل الحسابات عند القراءة الأولى. إذا رأيت هذا، فالمستأجر يملك حسابات دون أي نشاط مرحَّل — ابدأ بترحيل دفعة أو رصيد افتتاحي." },
};
