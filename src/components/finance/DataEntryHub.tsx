"use client";

/* ---------------------------------------------------------------------------
   /finance/data-entry — single, unmistakable answer to:
     "How do I put finance data in manually?"

   Two columns:

     1. STARTING DATA (one-time, opens drawer on /finance/setup)
        · Main Operating Currency        → /finance/setup#base_currency
        · Bank Accounts                  → /finance/setup#bank_accounts
        · Cash Accounts                  → /finance/setup#cash_accounts
        · Exchange Rates                 → /finance/fx-rates
        · Money Customers Owe Us         → /finance/setup#customers_ar
        · Money We Owe Suppliers         → /finance/setup#suppliers_ap
        · Assets                         → /finance/setup#assets
        · Loans & Liabilities            → /finance/setup#loans
        · Owner Capital                  → /finance/setup#equity

     2. DAY-TO-DAY ENTRIES (ongoing, opens SmartCreate flow)
        · New Expense                    → /create/expense
        · New Vendor Bill                → /finance/suppliers?new-bill=1
        · New Invoice                    → /invoices?new=1
        · New Payment                    → /finance/payments?new=1
        · New Sales Order                → /sales/orders?new=1
        · New Purchase Order             → /purchase?new=1
        · New Customer                   → /create/customer
        · New Supplier                   → /create/supplier
        · New Inventory Item             → /create/inventory-item
        · New Asset (ongoing)            → /create/asset
        · New Bank Account               → /finance/bank-accounts?new=1
        · New FX Rate                    → /finance/fx-rates

   Every row is a Link, every row has a one-line description so the
   operator never wonders "what does this even mean?".
   --------------------------------------------------------------------------- */

import Link from "next/link";
import { ErpEyebrow, ErpHairline, ErpPage, ErpPanel } from "@/components/ui/erp/ErpUi";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";

interface EntryRow {
  href: string;
  icon: RrIconName;
  label: string;
  meaning: string;
  /** Quick tag — "Required" / "Optional" / "Daily" — so the operator
   *  knows whether to skip or do it. */
  tag?: "required" | "recommended" | "optional";
}

const STARTING_DATA: EntryRow[] = [
  { href: "/finance/setup#base_currency",   icon: "coins",             label: "Main Operating Currency", meaning: "Currency your books are kept in (KOLEEX → CNY).",                        tag: "required" },
  { href: "/finance/setup#bank_accounts",   icon: "bank",              label: "Bank Accounts",            meaning: "Every operating, savings, and foreign-currency bank account.",            tag: "required" },
  { href: "/finance/fx-rates",              icon: "balance-scale-left", label: "Exchange Rates",           meaning: "Conversion rates between currencies (e.g. USD → CNY).",                   tag: "required" },
  { href: "/finance/setup#cash_accounts",   icon: "money",             label: "Cash Accounts",            meaning: "Physical cash boxes and petty-cash floats.",                              tag: "optional" },
  { href: "/finance/setup#customers_ar",    icon: "users",             label: "Money Customers Owe Us",   meaning: "Outstanding invoices customers haven't paid yet (technical: AR).",        tag: "recommended" },
  { href: "/finance/setup#suppliers_ap",    icon: "id-badge",          label: "Money We Owe Suppliers",   meaning: "Outstanding bills you haven't paid yet (technical: AP).",                 tag: "recommended" },
  { href: "/finance/setup#assets",          icon: "briefcase",         label: "Assets",                   meaning: "Equipment, vehicles, IT, machinery — anything depreciated over time.",     tag: "recommended" },
  { href: "/finance/setup#loans",           icon: "contract",          label: "Loans & Liabilities",      meaning: "Bank loans and long-term obligations.",                                   tag: "optional" },
  { href: "/finance/setup#equity",          icon: "shield-check",      label: "Owner Capital",            meaning: "Money the owners invested at formation (technical: Equity).",            tag: "recommended" },
];

const DAILY_ENTRIES: EntryRow[] = [
  { href: "/create/expense",                 icon: "receipt",             label: "Record an Expense",    meaning: "Operating cost — rent, salaries, marketing.",                       tag: "required" },
  { href: "/finance/suppliers?new-bill=1",   icon: "file-invoice",        label: "Record a Vendor Bill", meaning: "Bill received from a supplier (booked into AP).",                  tag: "recommended" },
  { href: "/invoices?new=1",                 icon: "file-invoice-dollar", label: "Issue an Invoice",     meaning: "Bill sent to a customer (booked into AR).",                        tag: "required" },
  { href: "/finance/payments?new=1",         icon: "money",               label: "Record a Payment",     meaning: "Money in or out, linked to an invoice / bill / expense.",          tag: "required" },
  { href: "/sales/orders?new=1",             icon: "file-invoice-dollar", label: "New Sales Order",      meaning: "Commitment to ship to a customer.",                                tag: "required" },
  { href: "/purchase?new=1",                 icon: "shipping-fast",       label: "New Purchase Order",   meaning: "Commitment to a supplier.",                                        tag: "required" },
  { href: "/create/customer",                icon: "users",               label: "New Customer",         meaning: "A party you sell to.",                                             tag: "required" },
  { href: "/create/supplier",                icon: "id-badge",            label: "New Supplier",         meaning: "A party you buy from.",                                            tag: "required" },
  { href: "/create/inventory-item",          icon: "box-open",            label: "New Inventory Item",   meaning: "A product or material you stock or sell.",                         tag: "recommended" },
  { href: "/create/asset",                   icon: "briefcase",           label: "New Asset",            meaning: "A new capital purchase, depreciated over time.",                   tag: "optional" },
  { href: "/finance/bank-accounts?new=1",    icon: "bank",                label: "New Bank Account",     meaning: "Add a new operating / savings / FX account.",                      tag: "optional" },
  { href: "/finance/fx-rates",               icon: "balance-scale-left",  label: "Add an Exchange Rate", meaning: "Add a new rate (e.g. when USD → CNY shifts).",                     tag: "recommended" },
];

export default function DataEntryHub() {
  return (
    <ErpPage
      title="Data Entry"
      subtitle="Where to put your finance data — manually, by hand"
      icon="pencil"
      backHref="/"
      action={
        <Link href="/finance/setup"
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/40 bg-emerald-300/[0.08] px-3 py-1.5 text-[12px] text-emerald-100 hover:bg-emerald-300/[0.14]">
          <RrIcon name="shield-check" size={12} /> Setup progress
        </Link>
      }
    >
      {/* Lead — answers the "how do I put data manually" question
          in a single sentence so an operator opening this page never
          has to read more than this banner if they don't want to. */}
      <div className="rounded-xl border border-emerald-300/30 bg-emerald-300/[0.04] px-4 py-3 text-[12.5px] text-emerald-100">
        Yes — every finance number can be entered manually. Two routes below:
        <span className="ml-1 text-emerald-200">starting data</span> for first-time loading,
        and <span className="text-emerald-200">day-to-day entries</span> for ongoing transactions.
        Click any row to open the form.
      </div>

      {/* Starting data */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <ErpEyebrow>① Starting Data · one-time</ErpEyebrow>
          <Link href="/finance/setup" className="text-[11px] text-gray-400 hover:text-gray-200">Open Finance Setup →</Link>
        </div>
        <ErpPanel>
          <ul>
            {STARTING_DATA.map((r) => <EntryRowItem key={r.href} row={r} />)}
          </ul>
        </ErpPanel>
        <p className="mt-2 text-[10.5px] text-gray-500">
          You only enter starting data once — when you first set up the company in Koleex.
          The system uses it as the day-zero snapshot.
        </p>
      </section>

      <ErpHairline />

      {/* Day-to-day entries */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <ErpEyebrow>② Day-to-Day Entries · ongoing</ErpEyebrow>
          <Link href="/create" className="text-[11px] text-gray-400 hover:text-gray-200">Open all create flows →</Link>
        </div>
        <ErpPanel>
          <ul>
            {DAILY_ENTRIES.map((r) => <EntryRowItem key={r.href} row={r} />)}
          </ul>
        </ErpPanel>
        <p className="mt-2 text-[10.5px] text-gray-500">
          These you enter as the company operates — every day, every week. Each one feeds
          straight into the books, AR/AP balances, and statements.
        </p>
      </section>

      <ErpHairline />
    </ErpPage>
  );
}

/* ─── Row ─── */

function EntryRowItem({ row }: { row: EntryRow }) {
  const tagCls =
    row.tag === "required"    ? "border-rose-300/40 bg-rose-300/[0.08] text-rose-100" :
    row.tag === "recommended" ? "border-amber-300/40 bg-amber-300/[0.08] text-amber-100" :
                                "border-white/[0.10] bg-white/[0.04] text-gray-300";
  return (
    <li className="border-b border-white/[0.025] last:border-b-0">
      <Link href={row.href} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.025]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-gray-300">
          <RrIcon name={row.icon} size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-[12.5px] font-medium">{row.label}</span>
            {row.tag && (
              <span className={`rounded-md border px-1.5 py-px text-[9px] uppercase tracking-[0.06em] ${tagCls}`}>
                {row.tag}
              </span>
            )}
          </div>
          <div className="text-[10.5px] text-gray-500">{row.meaning}</div>
        </div>
        <RrIcon name="arrow-up-right" size={11} className="text-gray-500" />
      </Link>
    </li>
  );
}
