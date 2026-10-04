import type { Translations } from "@/lib/i18n";

/* Finance — the `workflow.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_WORKFLOW: Translations = {
  /* Workflow rail items */
  "workflow.followUp":         { en: "Follow up collection",            zh: "跟进收款",                ar: "متابعة التحصيل" },
  "workflow.paySuppliers":     { en: "Pay suppliers",                   zh: "支付供应商",              ar: "ادفع للموردين" },
  "workflow.recordPayment":    { en: "Record payment",                  zh: "记录付款",                ar: "تسجيل دفعة" },
  "workflow.addExpense":       { en: "Add expense",                     zh: "添加费用",                ar: "إضافة مصروف" },
  "workflow.newOrder":         { en: "New order",                       zh: "新建订单",                ar: "طلب جديد" },
  "workflow.reminders":        { en: "Reminders",                       zh: "提醒事项",                ar: "التذكيرات" },
  "workflow.clear":            { en: "Clear",                           zh: "已清",                    ar: "خالٍ" },
};
