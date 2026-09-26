import type { Translations } from "@/lib/i18n";

/* Finance — the `notifications.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_NOTIFICATIONS: Translations = {
  "notifications.subtitle.long":{en:"Command center for money to collect and money to pay — colour-coded by severity.",
                              zh: "应收与应付的指挥中心 — 按严重程度颜色编码。",
                              ar: "مركز قيادة للمستحقات الواردة والصادرة — مرمّز بالألوان حسب الخطورة." },
  "notifications.title":    { en: "Reminders",                    zh: "提醒事项",                ar: "التذكيرات" },
  "notifications.subtitle": { en: "Due dates and follow-ups — supplier payments, customer collections, recurring expenses.",
                              zh: "到期日与跟进事项 — 供应商付款、客户收款、定期费用。",
                              ar: "تواريخ الاستحقاق والمتابعات — مدفوعات الموردين، تحصيل العملاء، المصروفات الدورية." },
};
