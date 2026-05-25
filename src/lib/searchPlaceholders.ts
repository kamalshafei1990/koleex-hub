"use client";

/* ---------------------------------------------------------------------------
   searchPlaceholders.ts — canonical search-bar placeholder strings.

   The PageHeader search box in every Hub app shows a one-line "Search X, Y,
   Z…" hint. Each app used to inline its own copy as a string literal, which
   is fine until you want to:

     · audit which apps even have a working search
     · adjust tone or punctuation across the Hub at once
     · translate them all in lock-step (zh / ar)

   This module is the single source of truth.

   Usage at the call site (preferred — picks up the active language):

       import { useSearchPlaceholder } from "@/lib/searchPlaceholders";
       const placeholder = useSearchPlaceholder("sales");
       <PageHeader searchPlaceholder={placeholder} ... />

   Or, for non-React contexts (e.g. tests), reach into the English values:

       import { SEARCH_PLACEHOLDERS } from "@/lib/searchPlaceholders";
       SEARCH_PLACEHOLDERS.sales

   Convention:
     · Sentence-case verb "Search"
     · Comma-separated noun list of what's actually indexed (3–4 items max)
     · Trailing ellipsis character (…), never three dots (...)
   --------------------------------------------------------------------------- */

import { useTranslation, type Translations } from "@/lib/i18n";

export const SEARCH_PLACEHOLDERS = {
  sales:     "Search opportunities, quotes, orders, customers…",
  invoices:  "Search invoices, customers, amounts…",
  expenses:  "Search expenses, categories, payments…",
  projects:  "Search projects, tasks, tags…",
  planning:  "Search shifts, resources, roles…",
  notes:     "Search notes, folders, tags…",
  inventory: "Search items, serials, batches, movements…",
  hr:        "Search employees, leave, payroll, documents…",
  purchase:  "Search RFQs, POs, suppliers, bills…",
  finance:   "Search customers, suppliers, invoices, payments…",
} as const;

export type SearchPlaceholderKey = keyof typeof SEARCH_PLACEHOLDERS;

const T: Translations = {
  "search.placeholder.sales": {
    en: SEARCH_PLACEHOLDERS.sales,
    zh: "搜索商机、报价、订单、客户…",
    ar: "ابحث عن الفرص والعروض والطلبات والعملاء…",
  },
  "search.placeholder.invoices": {
    en: SEARCH_PLACEHOLDERS.invoices,
    zh: "搜索发票、客户、金额…",
    ar: "ابحث عن الفواتير والعملاء والمبالغ…",
  },
  "search.placeholder.expenses": {
    en: SEARCH_PLACEHOLDERS.expenses,
    zh: "搜索费用、类别、付款…",
    ar: "ابحث عن المصروفات والفئات والمدفوعات…",
  },
  "search.placeholder.projects": {
    en: SEARCH_PLACEHOLDERS.projects,
    zh: "搜索项目、任务、标签…",
    ar: "ابحث عن المشاريع والمهام والوسوم…",
  },
  "search.placeholder.planning": {
    en: SEARCH_PLACEHOLDERS.planning,
    zh: "搜索班次、资源、岗位…",
    ar: "ابحث عن الورديات والموارد والأدوار…",
  },
  "search.placeholder.notes": {
    en: SEARCH_PLACEHOLDERS.notes,
    zh: "搜索笔记、文件夹、标签…",
    ar: "ابحث عن الملاحظات والمجلدات والوسوم…",
  },
  "search.placeholder.inventory": {
    en: SEARCH_PLACEHOLDERS.inventory,
    zh: "搜索物品、序列号、批次、出入库…",
    ar: "ابحث عن العناصر والأرقام التسلسلية والدفعات والحركات…",
  },
  "search.placeholder.hr": {
    en: SEARCH_PLACEHOLDERS.hr,
    zh: "搜索员工、休假、薪资、文档…",
    ar: "ابحث عن الموظفين والإجازات والرواتب والمستندات…",
  },
  "search.placeholder.purchase": {
    en: SEARCH_PLACEHOLDERS.purchase,
    zh: "搜索询价单、采购单、供应商、账单…",
    ar: "ابحث عن طلبات العروض وأوامر الشراء والموردين والفواتير…",
  },
  "search.placeholder.finance": {
    en: SEARCH_PLACEHOLDERS.finance,
    zh: "搜索客户、供应商、发票、付款…",
    ar: "ابحث عن العملاء والموردين والفواتير والمدفوعات…",
  },
};

/**
 * Locale-aware placeholder for the given app. Reads the active language from
 * the MainHeader language picker (via the shared i18n hook) and falls back
 * to English if a translation is missing.
 */
export function useSearchPlaceholder(app: SearchPlaceholderKey): string {
  const { t } = useTranslation(T);
  return t(`search.placeholder.${app}`, SEARCH_PLACEHOLDERS[app]);
}
