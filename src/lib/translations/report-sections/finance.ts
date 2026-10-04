import type { Translations } from "@/lib/i18n";

/* Reports — the section words of the Finance templates (Phase 5C). */
const PROFIT_LOSS = { en: "Profit and loss", zh: "损益", ar: "الأرباح والخسائر" };

const words: Translations = {
  "tpl.fin_expenses.s.by_category": { en: "Spending by category", zh: "按类别支出", ar: "المصروفات حسب البند" },
  "tpl.fin_expenses.s.list": { en: "The expenses", zh: "费用明细", ar: "تفاصيل المصروفات" },
  "tpl.fin_expenses.s.summary": { en: "The month's spending in short", zh: "本月支出概要", ar: "مصروفات الشهر باختصار" },
  "tpl.fin_expenses.s.summary.hint": { en: "Where the money went, what grew or shrank, and anything unusual.", zh: "钱花在哪里、哪些增加或减少，以及有无异常。", ar: "الفلوس راحت فين، إيه اللي زاد أو قلّ، وأي حاجة مش عادية." },

  "tpl.fin_petty_cash.s.entries": { en: "Received and spent", zh: "收支明细", ar: "الوارد والمنصرف" },
  "tpl.fin_petty_cash.s.entries.c.date": { en: "Date", zh: "日期", ar: "التاريخ" },
  "tpl.fin_petty_cash.s.entries.c.description": { en: "Description", zh: "摘要", ar: "البيان" },
  "tpl.fin_petty_cash.s.entries.c.received": { en: "Received", zh: "收入", ar: "وارد" },
  "tpl.fin_petty_cash.s.entries.c.spent": { en: "Spent", zh: "支出", ar: "منصرف" },
  "tpl.fin_petty_cash.s.balance": { en: "Balance in hand", zh: "手头余额", ar: "الرصيد اللي معاك" },
  "tpl.fin_petty_cash.s.balance.hint": { en: "The cash left with you now — and, if it does not match the entries, why.", zh: "现在手头剩余的现金——如与上面的明细不符，请说明原因。", ar: "الكاش اللي فاضل معاك دلوقتي — ولو مش مطابق للي فوق، قول ليه." },
  "tpl.fin_petty_cash.s.custodian_sign": { en: "Custodian signature", zh: "保管人签字", ar: "توقيع صاحب العهدة" },

  "tpl.fin_budget.s.budget": { en: "Budget and actual, by category", zh: "各类别预算与实际", ar: "الموازنة والفعلي لكل بند" },
  "tpl.fin_budget.s.summary": { en: "Where we stand against the budget", zh: "预算执行情况", ar: "إحنا فين من الموازنة" },
  "tpl.fin_budget.s.summary.hint": { en: "Where we spent more or less than the budget, and why.", zh: "哪些超支、哪些节省，原因是什么。", ar: "صرفنا فين أكتر أو أقل من الموازنة، وليه." },
  "tpl.fin_budget.s.actions": { en: "What we will do", zh: "后续措施", ar: "هنعمل إيه" },
  "tpl.fin_budget.s.actions.hint": { en: "Cuts, moves between categories, or a budget to change.", zh: "削减开支、类别之间调整，或需要修改的预算。", ar: "تخفيض مصروفات، نقل بين البنود، أو موازنة محتاجة تتعدل." },

  "tpl.fin_cash_flow.s.cash": { en: "Bank balances", zh: "银行余额", ar: "أرصدة البنوك" },
  "tpl.fin_cash_flow.s.flow": { en: "Cash flow", zh: "现金流", ar: "التدفق النقدي" },
  "tpl.fin_cash_flow.s.summary": { en: "The month's cash in short", zh: "本月现金概况", ar: "النقدية في الشهر باختصار" },
  "tpl.fin_cash_flow.s.summary.hint": { en: "Where the cash came from and went, and anything to watch.", zh: "现金从哪里来、流向哪里，以及需要关注的事项。", ar: "الفلوس جت منين وراحت فين، وأي حاجة لازم ناخد بالنا منها." },
  "tpl.fin_cash_flow.s.forecast": { en: "The coming months", zh: "未来几个月", ar: "الشهور الجاية" },
  "tpl.fin_cash_flow.s.forecast.hint": { en: "Big payments and collections coming, and whether the cash will cover them.", zh: "即将到来的大额付款和收款，以及现金是否足够。", ar: "مدفوعات وتحصيلات كبيرة جاية، والفلوس هتكفي ولا لأ." },

  "tpl.fin_statements.s.pl": PROFIT_LOSS,
  "tpl.fin_statements.s.ar": { en: "What customers owe, by age", zh: "客户欠款账龄", ar: "اللي لينا عند العملاء حسب المدة" },
  "tpl.fin_statements.s.ap": { en: "What we owe suppliers, by age", zh: "应付供应商账龄", ar: "اللي علينا للموردين حسب المدة" },
  "tpl.fin_statements.s.summary": { en: "What the numbers say", zh: "数字说明了什么", ar: "الأرقام بتقول إيه" },
  "tpl.fin_statements.s.summary.hint": { en: "How the profit looks, and which debts need chasing.", zh: "利润情况如何，哪些欠款需要跟进。", ar: "الربح عامل إزاي، وأنهي ديون محتاجة متابعة." },

  "tpl.fin_month_close.s.checks": { en: "Before closing", zh: "结账前检查", ar: "قبل الإقفال" },
  "tpl.fin_month_close.s.steps": { en: "Closing steps", zh: "结账步骤", ar: "خطوات الإقفال" },
  "tpl.fin_month_close.s.steps.i.bank_reconciled": { en: "Bank accounts reconciled", zh: "银行账户已对账", ar: "حسابات البنوك اتطابقت" },
  "tpl.fin_month_close.s.steps.i.expenses_posted": { en: "Expenses posted", zh: "费用已过账", ar: "المصروفات اترحّلت" },
  "tpl.fin_month_close.s.steps.i.invoices_posted": { en: "Invoices posted", zh: "发票已过账", ar: "الفواتير اترحّلت" },
  "tpl.fin_month_close.s.steps.i.payroll_posted": { en: "Payroll posted", zh: "工资已过账", ar: "المرتبات اترحّلت" },
  "tpl.fin_month_close.s.steps.i.depreciation": { en: "Depreciation posted", zh: "折旧已计提", ar: "الإهلاك اترحّل" },
  "tpl.fin_month_close.s.steps.i.fx_revaluation": { en: "Foreign currencies revalued", zh: "外币已重估", ar: "العملات الأجنبية اتقيّمت بسعر آخر الشهر" },
  "tpl.fin_month_close.s.steps.i.period_locked": { en: "Month locked", zh: "月份已锁定", ar: "الشهر اتقفل" },
  "tpl.fin_month_close.s.pl": PROFIT_LOSS,
  "tpl.fin_month_close.s.comment": { en: "Accountant's comment", zh: "会计说明", ar: "تعليق المحاسب" },
  "tpl.fin_month_close.s.comment.hint": { en: "What is still open, anything odd in the numbers, and what needs a decision.", zh: "尚未完成的事项、数字中的异常，以及需要决定的事项。", ar: "إيه اللي لسه مفتوح، أي حاجة غريبة في الأرقام، وإيه اللي محتاج قرار." },
};

export default words;
