/* ---------------------------------------------------------------------------
   searchPlaceholders.ts — canonical search-bar placeholder strings.

   The PageHeader search box in every Hub app shows a one-line "Search X, Y,
   Z…" hint. Each app used to inline its own copy as a string literal, which
   is fine until you want to:

     · audit which apps even have a working search
     · adjust tone or punctuation across the Hub at once
     · translate them all in lock-step (zh / ar)

   This module is the single source of truth. Each app passes the matching
   constant to PageHeader's `searchPlaceholder` prop.

   Convention:
     · Sentence-case verb "Search"
     · Comma-separated noun list of what's actually indexed (3–4 items max)
     · Trailing ellipsis character (…), never three dots (...)
     · Plain English — translations live in i18n if/when the app is localized.
   --------------------------------------------------------------------------- */

export const SEARCH_PLACEHOLDERS = {
  sales:      "Search opportunities, quotes, orders, customers…",
  invoices:   "Search invoices, customers, amounts…",
  expenses:   "Search expenses, categories, payments…",
  projects:   "Search projects, tasks, tags…",
  planning:   "Search shifts, resources, roles…",
  notes:      "Search notes, folders, tags…",
  inventory:  "Search items, serials, batches, movements…",
  hr:         "Search employees, leave, payroll, documents…",
  purchase:   "Search RFQs, POs, suppliers, bills…",
  finance:    "Search customers, suppliers, invoices, payments…",
} as const;

export type SearchPlaceholderKey = keyof typeof SEARCH_PLACEHOLDERS;
