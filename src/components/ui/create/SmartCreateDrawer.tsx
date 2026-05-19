"use client";

/* ---------------------------------------------------------------------------
   SmartCreateDrawer — universal "+ Create" launcher.

   A single drawer mounted at the layout root that surfaces every
   creation flow. Operators open it from:
     · header chip ("+ Create")
     · mobile action bar
     · any empty state via the openSmartCreate() event
     · keyboard shortcut "c"

   Selecting a tile navigates to the matching SmartCreate page
   (/create/expense, /create/customer, …) so we reuse the polished
   guided forms already built. The drawer itself is a quick chooser —
   no business logic.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";

type Kind = "expense" | "po" | "so" | "invoice" | "item" | "customer" | "supplier" | "fx" | "asset" | "bank";

interface Tile {
  k: Kind;
  label: string;
  icon: RrIconName;
  hint: string;
  href: string;
  affects?: Array<"accounting" | "inventory">;
}

const TILES: Array<Tile> = [
  { k: "expense",  label: "Expense",        icon: "receipt",             hint: "Operating cost",           href: "/create/expense",       affects: ["accounting"] },
  { k: "po",       label: "Purchase Order", icon: "shipping-fast",       hint: "Buy from a supplier",      href: "/purchase?new=1",       affects: ["inventory"] },
  { k: "so",       label: "Sales Order",    icon: "file-invoice-dollar", hint: "Sell to a customer",       href: "/sales/orders?new=1",   affects: ["inventory"] },
  { k: "invoice",  label: "Invoice",        icon: "receipt",             hint: "Bill a customer",          href: "/invoices?new=1",       affects: ["accounting"] },
  { k: "item",     label: "Inventory Item", icon: "box-open",            hint: "New SKU",                  href: "/create/inventory-item",affects: ["inventory"] },
  { k: "customer", label: "Customer",       icon: "users",               hint: "Party you sell to",        href: "/create/customer" },
  { k: "supplier", label: "Supplier",       icon: "id-badge",            hint: "Party you buy from",       href: "/create/supplier" },
  { k: "fx",       label: "FX Rate",        icon: "balance-scale-left",  hint: "Currency pair",            href: "/finance/fx-rates",     affects: ["accounting"] },
  { k: "asset",    label: "Asset",          icon: "briefcase",           hint: "Capital purchase",         href: "/create/asset",         affects: ["accounting"] },
  { k: "bank",     label: "Bank Account",   icon: "bank",                hint: "Add a treasury account",   href: "/finance/bank-accounts?new=1" },
];

const STORE_EVENT = "koleex:smart-create-open";

/** Imperatively open the drawer from anywhere in the app. */
export function openSmartCreate(initialKind?: Kind) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STORE_EVENT, { detail: initialKind ?? null }));
}

export default function SmartCreateDrawer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const close = useCallback(() => { setOpen(false); setFilter(""); }, []);

  useEffect(() => {
    function onOpen() { setOpen(true); }
    function onKey(e: KeyboardEvent) {
      /* Keyboard shortcut: bare "c" toggles the drawer (skips when
         the operator is typing in an input). */
      if (e.key !== "c" || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement | null)?.isContentEditable) return;
      setOpen((o) => !o);
      e.preventDefault();
    }
    window.addEventListener(STORE_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(STORE_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, close]);

  if (!open) return null;

  const visible = filter
    ? TILES.filter((t) => `${t.label} ${t.hint}`.toLowerCase().includes(filter.toLowerCase()))
    : TILES;

  function pick(t: Tile) { close(); router.push(t.href); }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 p-3 sm:items-center sm:p-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/[0.08] bg-[var(--bg-primary)] shadow-2xl">
        <header className="border-b border-white/[0.06] px-5 py-3.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Smart Create</div>
              <h2 className="text-[15px] font-semibold tracking-tight">What do you want to add?</h2>
            </div>
            <button type="button" onClick={close}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.10] bg-white/[0.04] text-gray-400 hover:text-gray-200"
                    aria-label="Close">
              <RrIcon name="cross" size={11} />
            </button>
          </div>
          <input
            autoFocus
            value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder="Type to filter — e.g. expense, supplier, FX…"
            className="mt-3 w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12.5px] outline-none focus:border-white/[0.20]"
          />
        </header>
        <div className="grid max-h-[60vh] grid-cols-1 gap-2 overflow-y-auto p-4 sm:grid-cols-2">
          {visible.length === 0 && (
            <div className="col-span-full px-3 py-6 text-center text-[11.5px] text-gray-500">
              No match. Try "expense", "PO", "invoice", "FX", "bank"…
            </div>
          )}
          {visible.map((t) => (
            <button key={t.k} type="button" onClick={() => pick(t)}
                    className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.012] px-3 py-3 text-left transition-colors hover:bg-white/[0.04]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-gray-300 group-hover:text-gray-100">
                <RrIcon name={t.icon} size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium">{t.label}</div>
                <div className="text-[10.5px] text-gray-500">{t.hint}</div>
              </div>
              {(t.affects ?? []).length > 0 && (
                <div className="flex flex-col items-end gap-0.5">
                  {t.affects?.includes("accounting") && (
                    <span className="text-[9px] uppercase tracking-[0.06em] text-amber-200/80">A/C</span>
                  )}
                  {t.affects?.includes("inventory") && (
                    <span className="text-[9px] uppercase tracking-[0.06em] text-blue-200/80">INV</span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
        <footer className="flex items-center justify-between border-t border-white/[0.06] px-5 py-2.5 text-[10px] text-gray-500">
          <span>
            Tip: press <span className="rounded border border-white/[0.10] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9.5px]">c</span> anywhere to open this drawer.
          </span>
          <button
            type="button"
            onClick={() => { close(); router.push("/finance/data-entry"); }}
            className="text-emerald-200 hover:text-emerald-100"
          >
            Don't see what you need? Open the Data Entry hub →
          </button>
        </footer>
      </div>
    </div>
  );
}
