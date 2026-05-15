"use client";

/* ---------------------------------------------------------------------------
   CustomerPickerModal — searchable contacts picker that auto-fills the
   QUOTATION TO card.

   UX matches ProductPickerModal: search bar at the top, scrollable
   result list, click → onPick(customer) → close. The parent's
   onPick handler populates the quote's QUOTATION TO fields from the
   payload's `displayName`, `companyName`, `email`, `phone`, `mobile`,
   `address`, `website` AND stores `customerContactId` on the doc so
   the link survives save/reload.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

export interface CustomerPickResult {
  id: string;
  displayName: string;
  companyName: string;
  email: string;
  phone: string;
  mobile: string;
  address: string;
  website: string;
}

export default function CustomerPickerModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (row: CustomerPickResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<CustomerPickResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setRows([]);
    setError(null);
    const t = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/contacts/search-customers?q=${encodeURIComponent(query)}&limit=500`,
          { credentials: "include", signal: controller.signal },
        );
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j.error || `Search failed (${res.status})`);
          setRows([]);
          return;
        }
        const json = (await res.json()) as { rows: CustomerPickResult[] };
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const pick = useCallback(
    (row: CustomerPickResult) => {
      onPick(row);
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--border-color, #374151)",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 15 }}>Link a customer</div>
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

        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border-color, #374151)" }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, company, or email…"
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
              No customers match {query ? `"${query}"` : "your CRM yet"}.
            </div>
          )}
          {!loading && rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => pick(row)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: 12,
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
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {row.displayName || "—"}
                </div>
                <div style={{ fontSize: 12, opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.companyName || row.email || row.phone || "—"}
                </div>
              </div>
              {row.email && (
                <div style={{ fontSize: 11, opacity: 0.6, fontFamily: "ui-monospace, monospace" }}>
                  {row.email}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
