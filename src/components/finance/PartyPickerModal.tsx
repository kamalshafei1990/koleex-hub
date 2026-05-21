"use client";

/* ---------------------------------------------------------------------------
   PartyPickerModal — searchable picker for Customers OR Suppliers.

   Wraps /api/finance/parties. Two callers:
     type="customer"   →  pick a customer for an order's customer field
     type="supplier"   →  pick a supplier for an order_supplier line

   Visual differences from CustomerPickerModal in Quotations:
     · shows country flag from contacts.country_code
     · shows tier badge (silver/gold/platinum/diamond) for customers
     · shows logo / avatar when present
     · shows previously-configured payment terms + credit status

   Returns the full FinancePartyRow so the caller can write back BOTH
   the FK id (customer_id / supplier_id) AND the convenience snapshot
   fields (display_name, country, tier) on the order row.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef, useState } from "react";
import RrIcon from "@/components/ui/RrIcon";
import { COUNTRIES } from "@/lib/commercial-policy/countries";
import type { FinancePartyRow } from "@/app/api/finance/parties/route";
import { useTranslation } from "@/lib/i18n";
import { financeT } from "@/lib/translations/finance";

export type { FinancePartyRow };

const TIER_COLORS: Record<NonNullable<FinancePartyRow["customer_tier"]>, string> = {
  end_user: "bg-gray-500/15 text-[var(--text-highlight)]",
  silver:   "bg-zinc-400/15 text-zinc-200",
  gold:     "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  platinum: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  diamond:  "bg-violet-500/15 text-violet-600 dark:text-violet-300",
};

function countryFlag(code: string | null | undefined): string | null {
  if (!code) return null;
  const up = code.toUpperCase();
  const hit = COUNTRIES.find((c) => c.code === up);
  return hit?.flag ?? null;
}

export default function PartyPickerModal({
  open,
  type,
  onClose,
  onPick,
}: {
  open: boolean;
  type: "customer" | "supplier";
  onClose: () => void;
  onPick: (row: FinancePartyRow) => void;
}) {
  const { t } = useTranslation(financeT);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<FinancePartyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setRows([]);
    setError(null);
    const handle = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/finance/parties?type=${type}&q=${encodeURIComponent(query)}&limit=250`,
          { credentials: "include", signal: controller.signal },
        );
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setError(j.error ?? `Search failed (${res.status})`);
          setRows([]);
          return;
        }
        const json = (await res.json()) as { parties: FinancePartyRow[] };
        setRows(json.parties ?? []);
        setError(null);
      } catch (e) {
        if ((e as { name?: string })?.name !== "AbortError") {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(handle);
    };
  }, [open, query, type]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const sorted = useMemo(() => rows, [rows]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm px-4 py-12" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {type === "customer" ? t("party.pickCustomer", "Pick a customer") : t("party.pickSupplier", "Pick a supplier")}
            </h2>
            <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">
              {type === "customer"
                ? t("party.customerHint", "Linked from the Contacts app. Type to filter.")
                : t("party.supplierHint", "Linked from the Contacts app — suppliers only.")}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-highlight)]">
            <RrIcon name="cross" size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={type === "customer" ? t("party.searchCustomer", "Search by name, company, or email…") : t("party.searchSupplier", "Search by supplier name or company…")}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-ghost)] focus:border-emerald-500/50 focus:outline-none"
          />
        </div>

        {/* List */}
        <div className="max-h-[420px] overflow-y-auto px-2 pb-3">
          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-[var(--text-dim)]">
              <RrIcon name="loading" size={14} className="animate-spin" />
              <span className="ml-2 text-sm">{t("party.searching", "Searching contacts…")}</span>
            </div>
          ) : error ? (
            <div className="px-3 py-6 text-sm text-rose-600 dark:text-rose-400">{error}</div>
          ) : sorted.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-[var(--text-dim)]">
              {query
                ? t("party.noMatches", "No matches. Try a different search.")
                : type === "customer"
                  ? t("party.noCustomers", "No customers in Contacts yet. Add one in the Contacts app, then come back here.")
                  : t("party.noSuppliers", "No suppliers in Contacts yet. Add one in the Contacts app, then come back here.")}
            </div>
          ) : (
            <ul className="space-y-1">
              {sorted.map((row) => {
                const flag = countryFlag(row.country_code);
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => onPick(row)}
                      className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition hover:border-[var(--border-subtle)] hover:bg-[var(--bg-surface-subtle)]"
                    >
                      {/* Avatar / logo */}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[11px] font-semibold text-[var(--text-highlight)]">
                        {row.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.photo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          (row.display_name || row.company || "?").slice(0, 1).toUpperCase()
                        )}
                      </div>
                      {/* Identity */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 truncate">
                          <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                            {row.display_name || row.company || t("party.unnamed", "Unnamed")}
                          </span>
                          {row.customer_tier && row.customer_tier !== "end_user" && (
                            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${TIER_COLORS[row.customer_tier]}`}>
                              {row.customer_tier}
                            </span>
                          )}
                          {row.credit_status && row.credit_status !== "good" && (
                            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                              {row.credit_status}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-[var(--text-dim)]">
                          {row.company && row.company !== row.display_name ? row.company + " · " : ""}
                          {flag && <span className="mr-1">{flag}</span>}
                          {row.country || row.email || row.phone || ""}
                          {row.payment_terms ? ` · ${row.payment_terms}` : ""}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
