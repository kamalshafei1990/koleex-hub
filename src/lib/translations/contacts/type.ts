import type { Translations } from "@/lib/i18n";

/* Contacts — the `type.*` strings, split out of the one 225 KB dictionary.
   See the header of ../contacts.ts for why. */

export const CT_TYPE: Translations = {
  /* ═══════════════════════════════════════════════════════════════════════════
     CONTACT TYPES
     ═══════════════════════════════════════════════════════════════════════════ */
  "type.customer":        { en: "Customer",              zh: "客户",                 ar: "عميل" },
  "type.supplier":        { en: "Supplier",              zh: "供应商",               ar: "مورّد" },
  "type.company":         { en: "Company",               zh: "公司",                 ar: "شركة" },
  "type.people":          { en: "People",                zh: "人脉",                 ar: "شخص" },
  "type.employee":        { en: "Employee",              zh: "员工",                 ar: "موظف" },
};
