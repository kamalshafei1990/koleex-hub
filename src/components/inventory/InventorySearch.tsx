"use client";

/* ---------------------------------------------------------------------------
   /inventory/search — INV-H5A unified global search.

   One input that searches across:
     · items (by code, name, sku, barcode)
     · serials
     · batches
     · transfers
     · returns
     · movements

   Server-side via /api/inventory/search?q=…  with all results grouped
   by entity type. Debounced (300ms) so we don't hammer the API.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import {
  MobileBottomBar,
  MobileFab,
  SectionEyebrow,
  useDebouncedValue,
  useInventoryShortcuts,
} from "@/components/inventory/InventoryUx";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import { useTranslation } from "@/lib/i18n";
import { inventoryT } from "@/lib/translations/inventory";

interface SearchResult {
  type: "item" | "serial" | "batch" | "transfer" | "return" | "movement";
  id: string;
  label: string;
  sublabel?: string | null;
  href: string;
}

interface SearchResults {
  items: SearchResult[];
  serials: SearchResult[];
  batches: SearchResult[];
  transfers: SearchResult[];
  returns: SearchResult[];
  movements: SearchResult[];
}

const EMPTY: SearchResults = {
  items: [], serials: [], batches: [], transfers: [], returns: [], movements: [],
};

export default function InventorySearch() {
  const { t } = useTranslation(inventoryT);
  useInventoryShortcuts({ isActive: true });
  const params = useSearchParams();
  const initial = params?.get("q") ?? "";

  const [q, setQ] = useState(initial);
  const debounced = useDebouncedValue(q, 300);
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = debounced.trim();
    if (!term) {
      setResults(EMPTY);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const r = await fetch(`/api/inventory/search?q=${encodeURIComponent(term)}`, {
          credentials: "include",
          cache: "no-store",
        });
        const j = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setError(j.error ?? `HTTP ${r.status}`);
          setResults(EMPTY);
        } else {
          setResults(j.results as SearchResults);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debounced]);

  const totalCount = useMemo(
    () =>
      results.items.length +
      results.serials.length +
      results.batches.length +
      results.transfers.length +
      results.returns.length +
      results.movements.length,
    [results],
  );

  const groups: Array<{ key: keyof SearchResults; title: string; icon: RrIconName }> = [
    { key: "items",     title: t("inv.search.group.items"),     icon: "box-open" },
    { key: "serials",   title: t("inv.search.group.serials"),   icon: "fingerprint" },
    { key: "batches",   title: t("inv.search.group.batches"),   icon: "clock" },
    { key: "transfers", title: t("inv.search.group.transfers"), icon: "shipping-fast" },
    { key: "returns",   title: t("inv.search.group.returns"),   icon: "recycle" },
    { key: "movements", title: t("inv.search.group.movements"), icon: "file-invoice" },
  ];

  /* Page wrapper + InventoryHeader provided by /app/inventory/layout.tsx. */
  return (
    <div className="space-y-5">
        <div data-testid="inv-search-input" className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
          <RrIcon name="search" size={14} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("inv.search.placeholder")}
            className="min-h-[44px] flex-1 bg-transparent text-[14px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)]"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1 text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
            >
              <RrIcon name="cross" size={11} />
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        {!q.trim() ? (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-8 text-center text-[12.5px] text-[var(--text-dim)]">
            {t("inv.search.empty")}
          </div>
        ) : loading ? (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/40 px-4 py-8 text-center text-[12px] text-[var(--text-dim)]">
            {t("inv.loading")}
          </div>
        ) : totalCount === 0 ? (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-8 text-center text-[12.5px] text-[var(--text-dim)]">
            {t("inv.search.no_results")}
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => {
              const rows = results[g.key];
              if (rows.length === 0) return null;
              return (
                <section key={g.key} id={g.key.replace(/s$/, "")}>
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)]">
                      <RrIcon name={g.icon} size={11} />
                    </span>
                    <SectionEyebrow>{g.title}</SectionEyebrow>
                    <span className="text-[11px] text-[var(--text-dim)] tabular-nums">{rows.length}</span>
                  </div>
                  {/* INV-H5C — every result shows an icon · primary name · meta ·
                       quick action chip. Type icon (g.icon) renders as the
                       leading visual chip; products lead with their image
                       wherever the API exposes one (sublabel meta). */}
                  <div className="mt-2 divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                    {rows.map((r) => (
                      <Link
                        key={`${g.key}-${r.id}`}
                        href={r.href}
                        className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-[var(--bg-elevated)]"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-dim)]">
                          <RrIcon name={g.icon} size={14} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-medium text-[var(--text-primary)]">{r.label}</div>
                          {r.sublabel && (
                            <div className="truncate text-[11px] text-[var(--text-dim)]">{r.sublabel}</div>
                          )}
                        </div>
                        {g.key === "items" && (
                          <span className="hidden sm:inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1 text-[10.5px] text-[var(--text-dim)]">
                            Open →
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      <MobileFab />
      <MobileBottomBar />
    </div>
  );
}
