import type { Translations } from "@/lib/i18n";

/* Finance — the `movement.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_MOVEMENT: Translations = {
  /* Manual movement drawer */
  "movement.title":         { en: "Manual cash movement",         zh: "手动资金流动",            ar: "حركة نقدية يدوية" },
  "movement.intro":         { en: "Used for bank fees, FX, adjustments, and one-off entries. The movement enters the reconciliation queue as unreconciled.",
                              zh: "用于银行手续费、汇兑、调整和一次性入账。该笔流动将以未对账状态进入对账队列。",
                              ar: "تُستخدم لرسوم البنك والصرف والتسويات والقيود لمرة واحدة. تدخل الحركة طابور المطابقة كغير مطابقة." },
  "movement.field.account": { en: "Bank account",                 zh: "银行账户",               ar: "الحساب البنكي" },
  "movement.field.type":    { en: "Type",                         zh: "类型",                  ar: "النوع" },
  "movement.field.direction":{en: "Direction",                    zh: "方向",                  ar: "الاتجاه" },
  "movement.direction.in":  { en: "Money in",                     zh: "资金流入",               ar: "دخول مال" },
  "movement.direction.out": { en: "Money out",                    zh: "资金流出",               ar: "خروج مال" },
  "movement.field.date":    { en: "Movement date",                zh: "流动日期",               ar: "تاريخ الحركة" },
  "movement.field.ref":     { en: "Bank reference",               zh: "银行参考号",              ar: "مرجع البنك" },
  "movement.field.counter": { en: "Counterparty",                 zh: "对方",                  ar: "الطرف الآخر" },
  "movement.action.record": { en: "Record movement",              zh: "记录流动",               ar: "تسجيل الحركة" },
  "movement.pickAccount":   { en: "Pick an account",              zh: "选择一个账户",            ar: "اختر حسابًا" },

  "movement.field.bankAccount":{ en: "Bank account",                    zh: "银行账户",                ar: "الحساب البنكي" },
  "movement.field.amountWith": { en: "Amount ({ccy})",                  zh: "金额 ({ccy})",            ar: "المبلغ ({ccy})" },
  "movement.err.pickAccount":  { en: "Pick a bank account",             zh: "请选择银行账户",            ar: "اختر حسابًا بنكيًا" },
  "movement.err.positiveAmount":{ en: "Amount must be positive",        zh: "金额必须为正数",            ar: "يجب أن يكون المبلغ موجبًا" },
};
