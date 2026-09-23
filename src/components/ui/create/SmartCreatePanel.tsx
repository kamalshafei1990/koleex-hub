"use client";

/* ---------------------------------------------------------------------------
   SmartCreatePanel — the drawer's contents (see SmartCreateDrawer).

   Its own chunk on purpose: the drawer is mounted in the root layout, so
   anything it imports ships on every route. The tiles, translations and the
   permission lookup load only the first time someone opens the drawer.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import { useTranslation, type Translations } from "@/lib/i18n";
import { smartCreateT } from "@/lib/translations/smart-create";
import { usePermissions } from "@/lib/permissions";
import { requestOpenNew } from "@/lib/use-open-on-new-param";

type Kind =
  | "quotation" | "invoice" | "so" | "po" | "bill" | "expense" | "customer" | "supplier" | "contact"
  | "item" | "task" | "event" | "fx" | "asset" | "bank";

interface Tile {
  k: Kind;
  /** Translation key; `${key}.h` is the hint. */
  key: string;
  icon: RrIconName;
  href: string;
  /** Permission module (the app's registry name) that must allow "create". */
  module: string;
  affects?: Array<"accounting" | "inventory">;
  /** Extra search words (English abbreviations people type). */
  words?: string;
}

const TILES: Tile[] = [
  { k: "quotation", key: "sc.quotation", icon: "document",            href: "/quotations?new=1",            module: "Quotations", words: "quote offer proforma" },
  { k: "invoice",   key: "sc.invoice",   icon: "file-invoice-dollar", href: "/invoices?new=1",              module: "Invoices",   affects: ["accounting"], words: "bill ar" },
  { k: "so",        key: "sc.so",        icon: "file-invoice",        href: "/sales/orders?new=1",          module: "Orders",     affects: ["inventory"], words: "so sales order" },
  { k: "po",        key: "sc.po",        icon: "shipping-fast",       href: "/purchase/orders?new=1",       module: "Purchases",  affects: ["inventory"], words: "po purchase buy" },
  { k: "bill",      key: "sc.bill",      icon: "file-invoice",        href: "/purchase/bills?new=1",        module: "Purchases",  affects: ["accounting"], words: "vendor bill ap payable" },
  { k: "expense",   key: "sc.expense",   icon: "receipt",             href: "/create/expense",              module: "Expenses",   affects: ["accounting"], words: "cost spend" },
  { k: "customer",  key: "sc.customer",  icon: "users",               href: "/create/customer",             module: "Customers",  words: "client buyer" },
  { k: "supplier",  key: "sc.supplier",  icon: "id-badge",            href: "/create/supplier",             module: "Suppliers",  words: "vendor factory" },
  { k: "contact",   key: "sc.contact",   icon: "user-headset",        href: "/contacts?new=1",              module: "Contacts",   words: "person company people" },
  { k: "item",      key: "sc.item",      icon: "box-open",            href: "/create/inventory-item",       module: "Inventory",  affects: ["inventory"], words: "sku stock product" },
  { k: "task",      key: "sc.task",      icon: "clipboard",           href: "/todo?new=1",                  module: "To-do",      words: "todo to-do reminder" },
  { k: "event",     key: "sc.event",     icon: "calendar",            href: "/calendar?new=1",              module: "Calendar",   words: "meeting appointment" },
  { k: "fx",        key: "sc.fxrate",    icon: "balance-scale-left",  href: "/finance/fx-rates?new=1",      module: "Finance",    affects: ["accounting"], words: "fx currency exchange rate" },
  { k: "asset",     key: "sc.asset",     icon: "briefcase",           href: "/create/asset",                module: "Finance",    affects: ["accounting"], words: "equipment capex" },
  { k: "bank",      key: "sc.bank",      icon: "bank",                href: "/finance/bank-accounts?new=1", module: "Finance",    words: "treasury account" },
];

/* The app you are in → the kinds it is about, most likely first. */
const CONTEXT: Array<[string, Kind[]]> = [
  ["/quotations", ["quotation", "customer"]],
  ["/invoices",   ["invoice", "customer"]],
  ["/sales",      ["so", "quotation", "invoice", "customer"]],
  ["/crm",        ["customer", "quotation", "contact"]],
  ["/customers",  ["customer", "quotation"]],
  ["/suppliers",  ["supplier", "po"]],
  ["/contacts",   ["contact", "customer", "supplier"]],
  ["/purchase",   ["po", "bill", "supplier", "item"]],
  ["/inventory",  ["item", "po"]],
  ["/expenses",   ["expense"]],
  ["/finance",    ["expense", "invoice", "bill", "bank", "fx", "asset"]],
  ["/todo",       ["task"]],
  ["/calendar",   ["event", "task"]],
];

function suggestedFor(path: string): Kind[] {
  const hit = CONTEXT.find(([p]) => path === p || path.startsWith(`${p}/`));
  return hit ? hit[1] : [];
}

/* Recent kinds, per browser. Storage can throw (private mode, blocked site
   data); the drawer then simply has no Recent row. */
const RECENT_KEY = "kx-smart-create-recent";
function readRecent(): Kind[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((k): k is Kind => TILES.some((x) => x.k === k)).slice(0, 3) : [];
  } catch {
    return [];
  }
}
function pushRecent(k: Kind) {
  try {
    const next = [k, ...readRecent().filter((x) => x !== k)].slice(0, 3);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* no storage — nothing to remember */
  }
}

/* Every language's label + hint, so "عرض" finds Quotation while the Hub is
   in English and "quote" finds it while it is in Arabic. */
function haystack(tile: Tile, dict: Translations): string {
  const parts = [tile.words ?? ""];
  for (const key of [tile.key, `${tile.key}.h`]) {
    const e = dict[key];
    if (e) parts.push(e.en, e.zh, e.ar);
  }
  return parts.join(" ").toLowerCase();
}

export default function SmartCreatePanel({ closing, onClose }: { closing: boolean; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const { t } = useTranslation(smartCreateT);
  const perms = usePermissions();
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState(0);
  const [recent] = useState<Kind[]>(readRecent);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  /* While the role is still loading every tile shows; the target app gates
     itself too, so the brief optimism can't create anything it shouldn't. */
  const { loading: permsLoading, can } = perms;
  const allowed = useMemo(
    () => (permsLoading ? TILES : TILES.filter((x) => can(x.module, "create"))),
    [permsLoading, can],
  );

  const sections = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (q) {
      const hits = allowed.filter((x) => haystack(x, smartCreateT).includes(q));
      return [{ id: "results", title: "", tiles: hits }];
    }
    const byKind = (k: Kind) => allowed.find((x) => x.k === k);
    const rec = recent.map(byKind).filter((x): x is Tile => !!x);
    const sug = suggestedFor(pathname).map(byKind).filter((x): x is Tile => !!x && !rec.includes(x));
    const rest = allowed.filter((x) => !rec.includes(x) && !sug.includes(x));
    const out = [];
    if (rec.length) out.push({ id: "recent", title: t("sc.recent"), tiles: rec });
    if (sug.length) out.push({ id: "suggested", title: t("sc.suggested"), tiles: sug });
    out.push({ id: "all", title: out.length ? t("sc.all") : "", tiles: rest });
    return out;
  }, [filter, allowed, recent, pathname, t]);

  const flat = useMemo(() => sections.flatMap((s) => s.tiles), [sections]);
  /* Index of each section's first tile in `flat`, for the arrow keys. */
  const starts = useMemo(() => {
    let n = 0;
    return sections.map((s) => { const at = n; n += s.tiles.length; return at; });
  }, [sections]);
  const activeIdx = Math.min(active, Math.max(0, flat.length - 1));

  /* Keep the highlighted tile in view as the arrows move it. */
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="1"]')?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  function pick(tile: Tile) {
    pushRecent(tile.k);
    onClose();
    const url = new URL(tile.href, window.location.origin);
    /* Same page: a push would not remount it, so ask it to open the form. */
    if (url.pathname === window.location.pathname && url.searchParams.get("new") === "1") {
      requestOpenNew(url.pathname);
      return;
    }
    router.push(tile.href);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeIdx + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIdx - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const tile = flat[activeIdx];
      if (tile) pick(tile);
    }
  }

  const [tipBefore, tipAfter] = t("sc.tip").split("{key}");

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className={`fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-sm p-3 transition-opacity duration-150 sm:items-center sm:p-6 ${closing ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kx-smart-create-title"
        className={`kx-glass-pop kx-pop-in ${closing ? "kx-pop-closing" : ""} w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl shadow-black/40`}
      >
        <header className="border-b border-[var(--border-subtle)] px-5 py-3.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">{t("sc.eyebrow")}</div>
              <h2 id="kx-smart-create-title" className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{t("sc.title")}</h2>
            </div>
            <button type="button" onClick={onClose}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-ghost)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                    aria-label={t("sc.close")}>
              <RrIcon name="cross" size={11} />
            </button>
          </div>
          <input
            autoFocus
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setActive(0); }}
            onKeyDown={onInputKey}
            placeholder={t("sc.filter")}
            role="combobox"
            aria-expanded="true"
            aria-controls="kx-smart-create-list"
            aria-activedescendant={flat[activeIdx] ? `kx-sc-${flat[activeIdx].k}` : undefined}
            className="mt-3 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[12.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)] focus:border-[var(--border-focus)]"
          />
        </header>

        <div ref={listRef} id="kx-smart-create-list" role="listbox" aria-label={t("sc.title")} className="max-h-[60vh] overflow-y-auto p-4">
          {flat.length === 0 && (
            <div className="px-3 py-6 text-center text-[11.5px] text-[var(--text-dim)]">
              {filter.trim() ? t("sc.noMatch").replace("{q}", filter.trim()) : t("sc.nothing")}
            </div>
          )}
          {sections.map((s, si) => s.tiles.length > 0 && (
            <section key={s.id} className="mb-3 last:mb-0">
              {s.title && (
                <h3 className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">{s.title}</h3>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {s.tiles.map((tile, ti) => {
                  const i = starts[si] + ti;
                  const on = i === activeIdx;
                  return (
                    <button
                      key={`${s.id}-${tile.k}`}
                      id={`kx-sc-${tile.k}`}
                      type="button"
                      role="option"
                      aria-selected={on}
                      data-active={on ? "1" : "0"}
                      onClick={() => pick(tile)}
                      onMouseMove={() => { if (!on) setActive(i); }}
                      className={`group flex items-center gap-3 rounded-xl border px-3 py-3 text-start transition-colors ${
                        on
                          ? "border-[var(--border-focus)] bg-[var(--bg-surface)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]"
                      }`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] ${on ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                        <RrIcon name={tile.icon} size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-medium text-[var(--text-primary)]">{t(tile.key)}</div>
                        <div className="truncate text-[10.5px] text-[var(--text-dim)]">{t(`${tile.key}.h`)}</div>
                      </div>
                      {(tile.affects ?? []).length > 0 && (
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {tile.affects?.includes("accounting") && (
                            <span title={t("sc.fx.accHint")} className="rounded-full border border-amber-600/25 bg-amber-500/10 px-1.5 py-px text-[9.5px] font-medium text-amber-700 dark:border-amber-300/20 dark:text-amber-200/90">
                              {t("sc.fx.acc")}
                            </span>
                          )}
                          {tile.affects?.includes("inventory") && (
                            <span title={t("sc.fx.invHint")} className="rounded-full border border-blue-600/25 bg-blue-500/10 px-1.5 py-px text-[9.5px] font-medium text-blue-700 dark:border-blue-300/20 dark:text-blue-200/90">
                              {t("sc.fx.inv")}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-[var(--border-subtle)] px-5 py-2.5 text-[10px] text-[var(--text-dim)]">
          <span className="hidden sm:inline">
            {tipBefore}
            <kbd className="rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-1.5 py-0.5 font-mono text-[9.5px]">c</kbd>
            {tipAfter}
          </span>
          {(permsLoading || can("Finance", "view")) && (
            <button
              type="button"
              onClick={() => { onClose(); router.push("/finance/data-entry"); }}
              className="text-emerald-700 hover:text-emerald-600 dark:text-emerald-200 dark:hover:text-emerald-100"
            >
              {t("sc.dataEntry")} <span aria-hidden className="inline-block rtl:-scale-x-100">→</span>
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
