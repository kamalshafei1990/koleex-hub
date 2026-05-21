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
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";

interface EntryRow {
  href: string;
  icon: RrIconName;
  labelKey: string;  labelFallback: string;
  meaningKey: string; meaningFallback: string;
  tag?: "required" | "recommended" | "optional";
}

const STARTING_DATA: EntryRow[] = [
  { href: "/finance/setup#base_currency",   icon: "coins",             labelKey: "de.start.baseCurrency.label", labelFallback: "Main Operating Currency", meaningKey: "de.start.baseCurrency.meaning", meaningFallback: "Currency your books are kept in (KOLEEX → CNY).", tag: "required" },
  { href: "/finance/setup#bank_accounts",   icon: "bank",              labelKey: "de.start.banks.label",        labelFallback: "Bank Accounts",            meaningKey: "de.start.banks.meaning",        meaningFallback: "Every operating, savings, and foreign-currency bank account.", tag: "required" },
  { href: "/finance/fx-rates",              icon: "balance-scale-left",labelKey: "de.start.fx.label",           labelFallback: "Exchange Rates",           meaningKey: "de.start.fx.meaning",           meaningFallback: "Conversion rates between currencies (e.g. USD → CNY).", tag: "required" },
  { href: "/finance/setup#cash_accounts",   icon: "money",             labelKey: "de.start.cash.label",         labelFallback: "Cash Accounts",            meaningKey: "de.start.cash.meaning",         meaningFallback: "Physical cash boxes and petty-cash floats.", tag: "optional" },
  { href: "/finance/setup#customers_ar",    icon: "users",             labelKey: "de.start.ar.label",           labelFallback: "Money Customers Owe Us",   meaningKey: "de.start.ar.meaning",           meaningFallback: "Outstanding invoices customers haven't paid yet (technical: AR).", tag: "recommended" },
  { href: "/finance/setup#suppliers_ap",    icon: "id-badge",          labelKey: "de.start.ap.label",           labelFallback: "Money We Owe Suppliers",   meaningKey: "de.start.ap.meaning",           meaningFallback: "Outstanding bills you haven't paid yet (technical: AP).", tag: "recommended" },
  { href: "/finance/setup#assets",          icon: "briefcase",         labelKey: "de.start.assets.label",       labelFallback: "Assets",                   meaningKey: "de.start.assets.meaning",       meaningFallback: "Equipment, vehicles, IT, machinery — anything depreciated over time.", tag: "recommended" },
  { href: "/finance/setup#loans",           icon: "contract",          labelKey: "de.start.loans.label",        labelFallback: "Loans & Liabilities",      meaningKey: "de.start.loans.meaning",        meaningFallback: "Bank loans and long-term obligations.", tag: "optional" },
  { href: "/finance/setup#equity",          icon: "shield-check",      labelKey: "de.start.equity.label",       labelFallback: "Owner Capital",            meaningKey: "de.start.equity.meaning",       meaningFallback: "Money the owners invested at formation (technical: Equity).", tag: "recommended" },
];

const DAILY_ENTRIES: EntryRow[] = [
  { href: "/create/expense",                 icon: "receipt",             labelKey: "de.daily.expense.label",  labelFallback: "Record an Expense",    meaningKey: "de.daily.expense.meaning",  meaningFallback: "Operating cost — rent, salaries, marketing.",                       tag: "required" },
  { href: "/finance/suppliers?new-bill=1",   icon: "file-invoice",        labelKey: "de.daily.bill.label",     labelFallback: "Record a Vendor Bill", meaningKey: "de.daily.bill.meaning",     meaningFallback: "Bill received from a supplier (booked into AP).",                  tag: "recommended" },
  { href: "/invoices?new=1",                 icon: "file-invoice-dollar", labelKey: "de.daily.invoice.label",  labelFallback: "Issue an Invoice",     meaningKey: "de.daily.invoice.meaning",  meaningFallback: "Bill sent to a customer (booked into AR).",                        tag: "required" },
  { href: "/finance/payments?new=1",         icon: "money",               labelKey: "de.daily.payment.label",  labelFallback: "Record a Payment",     meaningKey: "de.daily.payment.meaning",  meaningFallback: "Money in or out, linked to an invoice / bill / expense.",          tag: "required" },
  { href: "/sales/orders?new=1",             icon: "file-invoice-dollar", labelKey: "de.daily.so.label",       labelFallback: "New Sales Order",      meaningKey: "de.daily.so.meaning",       meaningFallback: "Commitment to ship to a customer.",                                tag: "required" },
  { href: "/purchase?new=1",                 icon: "shipping-fast",       labelKey: "de.daily.po.label",       labelFallback: "New Purchase Order",   meaningKey: "de.daily.po.meaning",       meaningFallback: "Commitment to a supplier.",                                        tag: "required" },
  { href: "/create/customer",                icon: "users",               labelKey: "de.daily.customer.label", labelFallback: "New Customer",         meaningKey: "de.daily.customer.meaning", meaningFallback: "A party you sell to.",                                             tag: "required" },
  { href: "/create/supplier",                icon: "id-badge",            labelKey: "de.daily.supplier.label", labelFallback: "New Supplier",         meaningKey: "de.daily.supplier.meaning", meaningFallback: "A party you buy from.",                                            tag: "required" },
  { href: "/create/inventory-item",          icon: "box-open",            labelKey: "de.daily.item.label",     labelFallback: "New Inventory Item",   meaningKey: "de.daily.item.meaning",     meaningFallback: "A product or material you stock or sell.",                         tag: "recommended" },
  { href: "/create/asset",                   icon: "briefcase",           labelKey: "de.daily.asset.label",    labelFallback: "New Asset",            meaningKey: "de.daily.asset.meaning",    meaningFallback: "A new capital purchase, depreciated over time.",                   tag: "optional" },
  { href: "/finance/bank-accounts?new=1",    icon: "bank",                labelKey: "de.daily.newBank.label",  labelFallback: "New Bank Account",     meaningKey: "de.daily.newBank.meaning",  meaningFallback: "Add a new operating / savings / FX account.",                      tag: "optional" },
  { href: "/finance/fx-rates",               icon: "balance-scale-left",  labelKey: "de.daily.fx.label",       labelFallback: "Add an Exchange Rate", meaningKey: "de.daily.fx.meaning",       meaningFallback: "Add a new rate (e.g. when USD → CNY shifts).",                     tag: "recommended" },
];

export default function DataEntryHub() {
  const { t } = useTranslation(financeT);
  return (
    <ErpPage
      title={t("dataEntry.title", "Data Entry")}
      subtitle={t("dataEntry.subtitle", "Where to put your finance data — manually, by hand")}
      icon="pencil"
      backHref="/"
      action={
        <Link href="/finance/setup"
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/40 bg-emerald-300/[0.08] px-3 py-1.5 text-[12px] text-emerald-100 hover:bg-emerald-300/[0.14]">
          <RrIcon name="shield-check" size={12} /> {t("dataEntry.setupProgress", "Setup progress")}
        </Link>
      }
    >
      <div className="rounded-xl border border-emerald-300/30 bg-emerald-300/[0.04] px-4 py-3 text-[12.5px] text-emerald-100">
        {t("dataEntry.lead", "Yes — every finance number can be entered manually. Two routes below: ")}
        <span className="ml-1 text-emerald-200">{t("dataEntry.lead.starting", "starting data")}</span>
        {t("dataEntry.lead.and", " for first-time loading, and ")}
        <span className="text-emerald-200">{t("dataEntry.lead.daily", "day-to-day entries")}</span>
        {t("dataEntry.lead.tail", " for ongoing transactions. Click any row to open the form.")}
      </div>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <ErpEyebrow>{t("dataEntry.section.starting", "① Starting Data · one-time")}</ErpEyebrow>
          <Link href="/finance/setup" className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-highlight)]">{t("dataEntry.openSetup", "Open Finance Setup →")}</Link>
        </div>
        <ErpPanel>
          <ul>
            {STARTING_DATA.map((r) => <EntryRowItem key={r.href} row={r} />)}
          </ul>
        </ErpPanel>
        <p className="mt-2 text-[10.5px] text-[var(--text-dim)]">
          {t("dataEntry.startingFootnote", "You only enter starting data once — when you first set up the company in Koleex. The system uses it as the day-zero snapshot.")}
        </p>
      </section>

      <ErpHairline />

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <ErpEyebrow>{t("dataEntry.section.daily", "② Day-to-Day Entries · ongoing")}</ErpEyebrow>
          <Link href="/create" className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-highlight)]">{t("dataEntry.openAllCreate", "Open all create flows →")}</Link>
        </div>
        <ErpPanel>
          <ul>
            {DAILY_ENTRIES.map((r) => <EntryRowItem key={r.href} row={r} />)}
          </ul>
        </ErpPanel>
        <p className="mt-2 text-[10.5px] text-[var(--text-dim)]">
          {t("dataEntry.dailyFootnote", "These you enter as the company operates — every day, every week. Each one feeds straight into the books, AR/AP balances, and statements.")}
        </p>
      </section>

      <ErpHairline />
    </ErpPage>
  );
}

function EntryRowItem({ row }: { row: EntryRow }) {
  const { t } = useTranslation(financeT);
  const tagCls =
    row.tag === "required"    ? "border-rose-300/40 bg-rose-300/[0.08] text-rose-100" :
    row.tag === "recommended" ? "border-amber-300/40 bg-amber-300/[0.08] text-amber-100" :
                                "border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-highlight)]";
  const tagLabel =
    row.tag === "required"    ? t("dataEntry.tier.required",    "Required") :
    row.tag === "recommended" ? t("dataEntry.tier.recommended", "Recommended") :
    row.tag === "optional"    ? t("dataEntry.tier.optional",    "Optional") :
    null;
  return (
    <li className="border-b border-[var(--border-faint)] last:border-b-0">
      <Link href={row.href} className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-surface-subtle)]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-highlight)]">
          <RrIcon name={row.icon} size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-[12.5px] font-medium">{t(row.labelKey, row.labelFallback)}</span>
            {tagLabel && (
              <span className={`rounded-md border px-1.5 py-px text-[9px] uppercase tracking-[0.06em] ${tagCls}`}>
                {tagLabel}
              </span>
            )}
          </div>
          <div className="text-[10.5px] text-[var(--text-dim)]">{t(row.meaningKey, row.meaningFallback)}</div>
        </div>
        <RrIcon name="arrow-up-right" size={11} className="text-[var(--text-dim)]" />
      </Link>
    </li>
  );
}
