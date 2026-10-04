import type { Translations } from "@/lib/i18n";

/* Finance — the `kind.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_KIND: Translations = {
  "kind.expense":           { en: "Expense",                      zh: "费用",                   ar: "مصروف" },
  "kind.payment":           { en: "Payment",                      zh: "付款",                   ar: "دفعة" },
  "kind.invoice":           { en: "Invoice",                      zh: "发票",                   ar: "فاتورة" },
  "kind.bill":              { en: "Bill",                         zh: "账单",                   ar: "فاتورة وارد" },
  "kind.fx":                { en: "FX",                           zh: "汇兑",                   ar: "صرف" },
  "kind.journal":           { en: "Journal",                      zh: "日记账",                 ar: "قيد يومية" },
};
