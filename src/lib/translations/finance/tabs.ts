import type { Translations } from "@/lib/i18n";

/* Finance — the `tabs.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_TABS: Translations = {
  /* ── Tabs (FinanceTabs) ────────────────────────────────────────── */
  "tabs.overview":        { en: "Overview",          zh: "概览",              ar: "نظرة عامة" },
  "tabs.operations":      { en: "Operations",        zh: "运营",              ar: "العمليات" },
  "tabs.cashBanking":     { en: "Cash & Banking",    zh: "资金与银行",         ar: "النقد والبنوك" },
  "tabs.accounting":      { en: "Accounting",        zh: "会计",              ar: "المحاسبة" },
  "tabs.reports":         { en: "Reports",           zh: "报表",              ar: "التقارير" },

  "tabs.overview.hint":   { en: "Start here — four clear paths and your essential KPIs. Setup + Intelligence live here too.",
                            zh: "从这里开始 — 四条清晰路径 + 关键指标。设置与智能分析也在这里。",
                            ar: "ابدأ من هنا — أربع مسارات واضحة ومؤشراتك الأساسية. الإعداد والذكاء هنا أيضًا." },
  "tabs.operations.hint": { en: "Daily transactions — orders, customers, suppliers, payments, expenses.",
                            zh: "日常交易 — 订单、客户、供应商、付款、费用。",
                            ar: "المعاملات اليومية — الطلبات والعملاء والموردون والمدفوعات والمصروفات." },
  "tabs.cashBanking.hint":{ en: "Bank balances, statement imports, reconciliation, and forward cash forecast.",
                            zh: "银行余额、对账单导入、银行对账、未来现金预测。",
                            ar: "أرصدة البنوك واستيراد الكشوف والمطابقة والتوقعات النقدية." },
  "tabs.accounting.hint": { en: "Ledger work — review journal drafts, post entries, inspect the ledger.",
                            zh: "账簿工作 — 审核日记账草稿、过账、查看总账。",
                            ar: "أعمال الدفاتر — مراجعة قيود اليومية، وترحيلها، وفحص الدفتر." },
  "tabs.reports.hint":    { en: "Read the books — income statement, balance sheet, cash flow, AR/AP aging.",
                            zh: "查阅账簿 — 利润表、资产负债表、现金流量表、应收/应付账龄。",
                            ar: "قراءة الدفاتر — قائمة الدخل والميزانية والتدفقات النقدية وأعمار المستحقات." },
};
