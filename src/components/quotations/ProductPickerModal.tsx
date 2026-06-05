"use client";

/* ---------------------------------------------------------------------------
   ProductPickerModal — searchable catalog picker used by the
   Quotation editor's "+ From catalog" button.

   Performance + search quality:
     · The catalog is fetched ONCE when the modal opens (q="" returns the
       full tenant catalog, server-capped at 2000, and is HTTP-cached). All
       subsequent typing filters IN THE BROWSER — zero network per keystroke,
       so search feels instant.
     · Smart ranking: multi-word (every word must match), matches against
       model code + SKU + product name, normalised (case/diacritics/space),
       and ranked exact → prefix → word-start → substring, with model/SKU
       weighted above the product name. Best matches float to the top.
     · Only the top slice is rendered (DOM stays light even with 2000 rows).
     · Keyboard: ↑/↓ to move, Enter to pick, Esc to close.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

export interface PickerRow {
  product_id: string;
  model_id: string;
  model_name: string;
  sku?: string;
  product_name: string;
  price: number;
  image_url: string | null;
}

export interface PickResult {
  model: string;
  description: string;
  unitPrice: number;
  imageUrl: string;
}

/** Max rows painted at once — keeps the DOM light on broad/empty queries. */
const MAX_RENDER = 120;

/* Normalise for matching: lowercase, strip diacritics, collapse whitespace. */
function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* Score one field against one term. 0 = no match. Higher = better:
   exact > whole-prefix > word-start > substring. */
function fieldScore(field: string, term: string): number {
  if (!field || !term) return 0;
  const i = field.indexOf(term);
  if (i === -1) return 0;
  if (field === term) return 100;
  if (i === 0) return 70;
  if (field[i - 1] === " ") return 50;
  return 30;
}

/* Score a row against all search terms. Every term must match SOMEWHERE
   (AND semantics) or the row is excluded (returns -1). Model code + SKU are
   weighted above the product name so a code match ranks first. */
function scoreRow(row: PickerRow, terms: string[]): number {
  const model = norm(row.model_name);
  const sku = norm(row.sku);
  const name = norm(row.product_name);
  let total = 0;
  for (const term of terms) {
    const best = Math.max(
      fieldScore(model, term),
      fieldScore(sku, term),
      fieldScore(name, term) * 0.8,
    );
    if (best <= 0) return -1; // this term matched nothing → drop the row
    total += best;
  }
  return total;
}

export default function ProductPickerModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (row: PickResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [allRows, setAllRows] = useState<PickerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  /* Fetch the catalog ONCE per open. Reset transient UI state too so the
     previous session's query doesn't flash in. */
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setError(null);
    setActiveIdx(0);
    setLoading(true);
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          "/api/quotations/catalog-search?q=&limit=2000",
          { credentials: "include", signal: controller.signal },
        );
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j.error || `Couldn't load the catalog (${res.status})`);
          setAllRows([]);
          return;
        }
        const json = (await res.json()) as { rows: PickerRow[] };
        setAllRows(json.rows ?? []);
        setError(null);
      } catch (e) {
        if ((e as { name?: string })?.name !== "AbortError") {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        setLoading(false);
      }
    })();
    const t = setTimeout(() => inputRef.current?.focus(), 40);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [open]);

  /* Instant client-side ranked filter. Empty query → the whole catalog,
     sorted A→Z, so the modal doubles as a browseable list. */
  const results = useMemo(() => {
    const terms = norm(query).split(" ").filter(Boolean);
    if (terms.length === 0) {
      return allRows
        .slice()
        .sort((a, b) =>
          (a.product_name || "").localeCompare(b.product_name || "") ||
          (a.model_name || "").localeCompare(b.model_name || ""),
        );
    }
    return allRows
      .map((row) => ({ row, score: scoreRow(row, terms) }))
      .filter((x) => x.score >= 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          (a.row.product_name || "").localeCompare(b.row.product_name || ""),
      )
      .map((x) => x.row);
  }, [allRows, query]);

  const shown = results.slice(0, MAX_RENDER);

  /* Keep the active row in range whenever the result set changes. */
  useEffect(() => { setActiveIdx(0); }, [query]);
  useEffect(() => {
    if (activeIdx >= shown.length) setActiveIdx(shown.length > 0 ? shown.length - 1 : 0);
  }, [shown.length, activeIdx]);

  /* Scroll the active row into view as the user arrows through. */
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="1"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const pick = useCallback(
    (row: PickerRow) => {
      onPick({
        model: row.model_name,
        description: row.product_name,
        unitPrice: row.price,
        imageUrl: row.image_url ?? "",
      });
      onClose();
    },
    [onPick, onClose],
  );

  /* Esc-to-close (bound on document so it works wherever focus is). */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, shown.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const row = shown[activeIdx];
        if (row) pick(row);
      }
    },
    [shown, activeIdx, pick],
  );

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-secondary, #1f2937)",
          color: "var(--text-primary, #e5e7eb)",
          width: "100%",
          maxWidth: 720,
          maxHeight: "85vh",
          borderRadius: 14,
          border: "1px solid var(--border-color, #374151)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--border-color, #374151)",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 15 }}>Pick a product</div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
              display: "inline-flex",
            }}
          >
            <CrossIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Search input */}
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border-color, #374151)" }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search model code, SKU or product name…"
            style={{
              width: "100%",
              height: 36,
              borderRadius: 8,
              border: "1px solid var(--border-color, #374151)",
              background: "var(--bg-primary, #111827)",
              color: "inherit",
              padding: "0 12px",
              fontSize: 14,
              outline: "none",
            }}
          />
          {/* Result count / hint — quiet line under the search box. */}
          {!loading && !error && allRows.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, opacity: 0.55, display: "flex", justifyContent: "space-between" }}>
              <span>
                {query.trim()
                  ? `${results.length} match${results.length === 1 ? "" : "es"}`
                  : `${allRows.length} products`}
                {results.length > MAX_RENDER ? ` · showing top ${MAX_RENDER}` : ""}
              </span>
              <span>↑↓ to move · Enter to add</span>
            </div>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: "auto", flex: 1, padding: 8 }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32, gap: 8, opacity: 0.7 }}>
              <SpinnerIcon className="h-4 w-4 animate-spin" />
              <span style={{ fontSize: 13 }}>Loading catalog…</span>
            </div>
          )}
          {!loading && error && (
            <div style={{ padding: 32, textAlign: "center", color: "#f87171", fontSize: 13 }}>{error}</div>
          )}
          {!loading && !error && shown.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", opacity: 0.6, fontSize: 13 }}>
              No products match {query ? `"${query}"` : "your catalog yet"}.
            </div>
          )}
          {!loading && shown.map((row, i) => {
            const active = i === activeIdx;
            return (
              <button
                key={row.model_id}
                type="button"
                data-active={active ? "1" : "0"}
                onClick={() => pick(row)}
                onMouseMove={() => { if (!active) setActiveIdx(i); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: `1px solid ${active ? "var(--border-color, #374151)" : "transparent"}`,
                  background: active ? "var(--bg-primary, #111827)" : "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  textAlign: "left",
                  marginBottom: 2,
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    width: 48,
                    height: 48,
                    flex: "0 0 48px",
                    borderRadius: 8,
                    background: "#ffffff",
                    border: "1px solid var(--border-color, #374151)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {row.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.image_url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  ) : (
                    <span style={{ fontSize: 18, color: "#9ca3af" }}>–</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 600, letterSpacing: "0.02em" }}>
                    {row.model_name || row.sku || "—"}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.85, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.product_name}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                  {row.price > 0 ? `US$ ${row.price.toLocaleString()}` : "—"}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
