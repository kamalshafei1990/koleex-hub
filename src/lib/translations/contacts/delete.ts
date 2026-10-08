import type { Translations } from "@/lib/i18n";

/* Contacts — the `delete.*` strings, split out of the one 225 KB dictionary.
   See the header of ../contacts.ts for why. */

export const CT_DELETE: Translations = {
  /* ── Delete Confirmation ── */
  "delete.title":         { en: "Delete Contact",        zh: "删除联系人",            ar: "حذف جهة الاتصال" },
  "delete.titleSupplier": { en: "Delete supplier",       zh: "删除供应商",            ar: "حذف المورّد" },
  "delete.titleCustomer": { en: "Delete customer",       zh: "删除客户",              ar: "حذف العميل" },
  "delete.confirm":       { en: "Are you sure you want to delete", zh: "您确定要删除", ar: "هل أنت متأكد أنك تريد حذف" },
  "delete.customerRecoverable": { en: "The customer's portal login account will be deleted with them. Both are kept in the Recycle Bin (Accounts app) and can be restored any time.", zh: "客户的门户登录账户将随之删除。两者都会保存在回收站（账户应用）中，可随时恢复。", ar: "سيُحذف حساب دخول العميل معه. كلاهما يُحفظ في سلة الاسترجاع (تطبيق الحسابات) ويمكن استرجاعهما في أي وقت." },
  "delete.cannotUndo":    { en: "? This cannot be undone.", zh: "？此操作无法撤销。", ar: "؟ لا يمكن التراجع عن هذا الإجراء." },
};
