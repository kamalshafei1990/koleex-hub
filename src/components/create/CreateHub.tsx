"use client";

/* ---------------------------------------------------------------------------
   /create — entry point for every guided creation flow.

   Visual menu. Each card describes what the entity means and what
   happens after saving. No clutter, no nested navigation.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import {
  ErpEyebrow, ErpHairline, ErpPage,
} from "@/components/ui/erp/ErpUi";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";

interface Tile {
  href: string;
  icon: RrIconName;
  label: string;
  meaning: string;
  next: string;
  affects: Array<"accounting" | "inventory">;
}

const GROUPS: Array<{ title: string; tiles: Tile[] }> = [
  {
    title: "Finance",
    tiles: [
      { href: "/create/expense",  icon: "receipt",             label: "New Expense",
        meaning: "Record an operating cost (paid or owed).",
        next: "Submitted → reviewed → approved → posted to journal.",
        affects: ["accounting"] },
      { href: "/finance/payments?new=1", icon: "money",        label: "New Payment",
        meaning: "Money in or out, linked to invoice / bill / expense.",
        next: "Bank movement is recorded; AR or AP balance updates.",
        affects: ["accounting"] },
      { href: "/invoices?new=1",   icon: "file-invoice-dollar", label: "New Invoice",
        meaning: "Bill a customer for goods or services.",
        next: "Confirms revenue + posts AR draft on confirmation.",
        affects: ["accounting"] },
      { href: "/finance/accounting?new=1", icon: "books",      label: "New Journal",
        meaning: "Manual accounting adjustment.",
        next: "Posts when an approver confirms the entry.",
        affects: ["accounting"] },
      { href: "/finance/setup?card=fx-rates",  icon: "balance-scale-left", label: "New FX Exchange",
        meaning: "Move money between currencies.",
        next: "Records two cash legs and any FX gain/loss.",
        affects: ["accounting"] },
      { href: "/finance/setup?card=assets",     icon: "briefcase", label: "New Asset",
        meaning: "Capitalised purchase tracked separately from expenses.",
        next: "Asset register updates; depreciation can post over time.",
        affects: ["accounting"] },
    ],
  },
  {
    title: "Commercial",
    tiles: [
      { href: "/create/customer", icon: "users",         label: "New Customer",
        meaning: "A party you sell to.",
        next: "Linked to SOs, invoices, and AR aging.",
        affects: [] },
      { href: "/create/supplier", icon: "id-badge",      label: "New Supplier",
        meaning: "A party you buy from.",
        next: "Linked to POs, bills, and AP aging.",
        affects: [] },
      { href: "/quotations?new=1", icon: "contract",     label: "New Quotation",
        meaning: "Price offer to a customer (no commitment).",
        next: "Convert to SO when accepted.",
        affects: [] },
      { href: "/sales/orders?new=1", icon: "file-invoice-dollar", label: "New Sales Order",
        meaning: "Commitment to ship to a customer.",
        next: "Ship → invoice → payment.",
        affects: ["inventory"] },
      { href: "/purchase?new=1",     icon: "shipping-fast",      label: "New Purchase Order",
        meaning: "Commitment to a supplier.",
        next: "Receive → bill → payment.",
        affects: ["inventory"] },
    ],
  },
  {
    title: "Inventory",
    tiles: [
      { href: "/create/inventory-item", icon: "box-open", label: "New Inventory Item",
        meaning: "A product or material you stock or sell.",
        next: "Available on PO + SO + receiving + shipping.",
        affects: ["inventory"] },
      { href: "/inventory/warehouses?new=1", icon: "hotel", label: "New Warehouse",
        meaning: "A physical or logical stock location.",
        next: "Used for receiving, transfers, and valuation.",
        affects: ["inventory"] },
    ],
  },
];

export default function CreateHub() {
  return (
    <ErpPage
      title="Create"
      subtitle="Pick what you want to add"
      icon="plus"
      backHref="/"
    >
      {GROUPS.map((g) => (
        <section key={g.title}>
          <div className="mb-2 flex items-baseline justify-between">
            <ErpEyebrow>{g.title}</ErpEyebrow>
            <span className="text-[10.5px] text-gray-500">{g.tiles.length} options</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {g.tiles.map((t) => <Tile key={t.href} tile={t} />)}
          </div>
          <ErpHairline className="mt-6" />
        </section>
      ))}
    </ErpPage>
  );
}

function Tile({ tile }: { tile: Tile }) {
  return (
    <Link href={tile.href}
          className="group block rounded-xl border border-white/[0.05] bg-white/[0.012] p-4 transition-colors hover:bg-white/[0.025]">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-gray-300">
          <RrIcon name={tile.icon} size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">{tile.label}</div>
          <div className="text-[10.5px] text-gray-500">{tile.meaning}</div>
        </div>
        <RrIcon name="arrow-up-right" size={11} className="text-gray-500" />
      </div>
      <ErpHairline className="my-3" />
      <div className="space-y-1.5 text-[10.5px] text-gray-500">
        <div className="flex items-baseline gap-1.5">
          <RrIcon name="signal-stream" size={9} />
          <span>{tile.next}</span>
        </div>
        {tile.affects.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tile.affects.includes("accounting") && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/40 bg-amber-300/[0.08] px-1.5 py-px text-[9px] uppercase tracking-[0.06em] text-amber-200">
                <RrIcon name="books" size={8} /> Affects Accounting
              </span>
            )}
            {tile.affects.includes("inventory") && (
              <span className="inline-flex items-center gap-1 rounded-md border border-blue-300/40 bg-blue-300/[0.08] px-1.5 py-px text-[9px] uppercase tracking-[0.06em] text-blue-200">
                <RrIcon name="box-open" size={8} /> Affects Inventory
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
