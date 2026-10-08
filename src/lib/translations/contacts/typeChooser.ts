import type { Translations } from "@/lib/i18n";

/* Contacts — the `typeChooser.*` strings, split out of the one 225 KB dictionary.
   See the header of ../contacts.ts for why. */

export const CT_TYPECHOOSER: Translations = {
  /* ── Type Chooser Modal ── */
  "typeChooser.title":       { en: "New Contact",              zh: "新建联系人",            ar: "جهة اتصال جديدة" },
  "typeChooser.desc":        { en: "Choose the contact type",  zh: "选择联系人类型",         ar: "اختر نوع جهة الاتصال" },
  "typeChooser.customerQ":   { en: "What type of customer?",   zh: "什么类型的客户？",       ar: "ما نوع العميل؟" },
  "typeChooser.customerDesc":{ en: "Select the customer entity type", zh: "选择客户实体类型", ar: "اختر نوع كيان العميل" },
  "typeChooser.individual":  { en: "Individual",               zh: "个人",                 ar: "فرد" },
  "typeChooser.business":    { en: "Business",                 zh: "企业",                 ar: "شركة" },
  "typeChooser.individualDesc": { en: "A person you do business with", zh: "与您有业务往来的个人", ar: "شخص تتعامل معه تجارياً" },
  "typeChooser.businessDesc":   { en: "A company or organization",     zh: "公司或组织",          ar: "شركة أو مؤسسة" },
};
