import type { Translations } from "@/lib/i18n";

/* Finance — the `profitFlow.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_PROFITFLOW: Translations = {
  /* Profit-flow waterfall (FinanceDashboard.cards) */
  "profitFlow.revenue":     { en: "Revenue",                      zh: "收入",                  ar: "الإيرادات" },
  "profitFlow.supplierCost":{ en: "Supplier cost",                zh: "供应商成本",              ar: "تكلفة المورد" },
  "profitFlow.grossProfit": { en: "Gross profit",                 zh: "毛利",                  ar: "إجمالي الربح" },
  "profitFlow.orderExpenses":{en: "Order expenses",               zh: "订单费用",                ar: "مصروفات الطلب" },
  "profitFlow.taxRefund":   { en: "Tax refund",                   zh: "退税",                  ar: "استرداد ضريبي" },
  "profitFlow.bankCharges": { en: "Bank charges",                 zh: "银行手续费",              ar: "رسوم البنك" },
  "profitFlow.netProfit":   { en: "Net profit",                   zh: "净利润",                ar: "صافي الربح" },
};
