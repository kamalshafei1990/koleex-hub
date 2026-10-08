import type { Translations } from "@/lib/i18n";

/* Finance — the `party.*` strings, split out of the one 287 KB dictionary.
   See the header of ../finance.ts for why. */

export const FIN_PARTY: Translations = {
  /* PartyPicker + PartyChip */
  "party.pickCustomer":        { en: "Pick a customer",                 zh: "选择客户",                ar: "اختر عميلاً" },
  "party.pickSupplier":        { en: "Pick a supplier",                 zh: "选择供应商",              ar: "اختر موردًا" },
  "party.customerHint":        { en: "Linked from the Contacts app. Type to filter.",
                                  zh: "来自通讯录应用。输入以筛选。",
                                  ar: "مرتبطة بتطبيق جهات الاتصال. اكتب للتصفية." },
  "party.supplierHint":        { en: "Linked from the Contacts app — suppliers only.",
                                  zh: "来自通讯录应用 — 仅供应商。",
                                  ar: "مرتبطة بتطبيق جهات الاتصال — الموردون فقط." },
  "party.searchCustomer":      { en: "Search by name, company, or email…",
                                  zh: "按姓名、公司或邮箱搜索…",
                                  ar: "ابحث بالاسم أو الشركة أو البريد…" },
  "party.searchSupplier":      { en: "Search by supplier name or company…",
                                  zh: "按供应商名称或公司搜索…",
                                  ar: "ابحث باسم المورد أو الشركة…" },
  "party.searching":           { en: "Searching contacts…",             zh: "正在搜索联系人…",          ar: "جارٍ البحث في جهات الاتصال…" },
  "party.noMatches":           { en: "No matches. Try a different search.",
                                  zh: "未找到匹配项。请尝试其他搜索。",
                                  ar: "لا توجد نتائج. حاول بحثًا مختلفًا." },
  "party.noCustomers":         { en: "No customers in Contacts yet. Add one in the Contacts app, then come back here.",
                                  zh: "通讯录中尚无客户。请先在通讯录应用添加，然后返回此处。",
                                  ar: "لا يوجد عملاء في جهات الاتصال بعد. أضِف عميلًا في تطبيق جهات الاتصال ثم عُد إلى هنا." },
  "party.noSuppliers":         { en: "No suppliers in Contacts yet. Add one in the Contacts app, then come back here.",
                                  zh: "通讯录中尚无供应商。请先在通讯录应用添加，然后返回此处。",
                                  ar: "لا يوجد موردون في جهات الاتصال بعد. أضِف موردًا في تطبيق جهات الاتصال ثم عُد إلى هنا." },
  "party.unnamed":              { en: "Unnamed",                         zh: "未命名",                  ar: "بدون اسم" },
  "party.change":               { en: "Change",                          zh: "更换",                    ar: "تغيير" },
  "party.clear":                { en: "Clear",                           zh: "清除",                    ar: "مسح" },
};
