"use client";

/* ---------------------------------------------------------------------------
   ProductPickerModal — searchable catalog picker used by the
   Quotation editor's "+ From catalog" button.

   UX:
     · Search bar at the top (debounced 200 ms against /api/quotations/
       catalog-search).
     · Result list with thumbnail | MODEL CODE | product name | price.
     · Click a row → fires onPick({ model, description, unitPrice,
       imageUrl }) and closes the modal.
     · Escape or backdrop click closes without picking.

   The modal is intentionally framework-light — no Headless UI dep,
   just a fixed overlay + a focused input. Keeps the bundle small and
   matches the rest of the editor's tone. */

import { useCallback, useEffect, useRef, useState } from "react";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

export interface PickerRow {
  product_id: string;
  model_id: string;
  model_name: string;
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
  const [rows, setRows] = useState<PickerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  /* Reset state every time the modal opens so the previous session's
     query/results don't flash in. Focus the search input so the user
     can start typing immediately. */
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setRows([]);
    setError(null);
    const t = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, [open]);

  /* Debounced search. Empty query still runs (returns the first 40
     visible models) so the modal is useful as a browseable list,
     not just a search box. */
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          /* Pull the full catalog (server caps at 2000) so the
             picker can find any model, not just the first 60. The
             list is virtualised only if it gets unwieldy — for now
             the modal scrolls cleanly through a tenant-sized
             catalog without UX issues. */
          `/api/quotations/catalog-search?q=${encodeURIComponent(query)}&limit=2000`,
          { credentials: "include", signal: controller.signal },
        );
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j.error || `Search failed (${res.status})`);
          setRows([]);
          return;
        }
        const json = (await res.json()) as { rows: PickerRow[] };
        setRows(json.rows ?? []);
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
      clearTimeout(t);
    };
  }, [open, query]);

  /* Esc-to-close. Bound on the document so the listener works even
     when focus is on the result list. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
            placeholder="Search by model code or product name…"
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
        </div>

        {/* Results */}
        <div style={{ overflowY: "auto", flex: 1, padding: 8 }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32, gap: 8, opacity: 0.7 }}>
              <SpinnerIcon className="h-4 w-4 animate-spin" />
              <span style={{ fontSize: 13 }}>Searching…</span>
            </div>
          )}
          {!loading && error && (
            <div style={{ padding: 32, textAlign: "center", color: "#f87171", fontSize: 13 }}>{error}</div>
          )}
          {!loading && !error && rows.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", opacity: 0.6, fontSize: 13 }}>
              No products match {query ? `"${query}"` : "your catalog yet"}.
            </div>
          )}
          {!loading && rows.map((row) => (
            <button
              key={row.model_id}
              type="button"
              onClick={() => pick(row)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid transparent",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                textAlign: "left",
                marginBottom: 2,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--bg-primary, #111827)";
                e.currentTarget.style.borderColor = "var(--border-color, #374151)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "transparent";
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
                  <img src={row.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (
                  <span style={{ fontSize: 18, color: "#9ca3af" }}>–</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 600, letterSpacing: "0.02em" }}>
                  {row.model_name || "—"}
                </div>
                <div style={{ fontSize: 13, opacity: 0.85, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.product_name}
                </div>
              </div>
              <div style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                {row.price > 0 ? `US$ ${row.price.toLocaleString()}` : "—"}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
