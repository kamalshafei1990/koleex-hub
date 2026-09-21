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

   Built on the KDS FormModal (Escape, backdrop, body scroll-lock, the
   pop-in motion) with the Hub's tokens — it used to be a hand-styled
   overlay with its own dark hex fallbacks that ignored the light skin
   and spoke English only.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { FormModal, SearchInput } from "@/components/kds";
import { record } from "@/lib/perf/client";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { useTranslation } from "@/lib/i18n";
import { docsT } from "@/lib/translations/docs";

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
  const { t } = useTranslation(docsT);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<CustomerPickResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* Monotonic token so a slow older response can't overwrite a newer one
     after a rapid type (belt-and-braces with AbortController). */
  const seqRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setRows([]);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const seq = ++seqRef.current;
    const controller = new AbortController();
    const t0 = typeof performance !== "undefined" ? performance.now() : 0;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/contacts/search-customers?q=${encodeURIComponent(query)}&limit=40`,
          { credentials: "include", signal: controller.signal },
        );
        if (seq !== seqRef.current) return;
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j.error || `Search failed (${res.status})`);
          setRows([]);
          return;
        }
        const json = (await res.json()) as { rows: CustomerPickResult[] };
        if (seq !== seqRef.current) return;
        setRows(json.rows ?? []);
        setError(null);
        if (typeof performance !== "undefined") {
          record("quotations.picker.customer_ms", performance.now() - t0);
        }
      } catch (e) {
        if ((e as { name?: string })?.name !== "AbortError" && seq === seqRef.current) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, query]);

  const pick = useCallback(
    (row: CustomerPickResult) => {
      onPick(row);
      onClose();
    },
    [onPick, onClose],
  );

  return (
    <FormModal open={open} onClose={onClose} title={t("picker.customerTitle")} width="max-w-2xl">
      {/* Pinned above the scrolling results — the modal body is the scroll
          container; the negative top margin closes the body padding
          above it so nothing scrolls past the search box. */}
      <div className="sticky top-0 z-[1] -mt-5 bg-[var(--bg-secondary)] pt-5 pb-3">
        <SearchInput value={query} onChange={setQuery} placeholder={t("picker.customerPh")} autoFocus />
      </div>

      <div className="min-h-[200px]">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-[var(--text-dim)]" role="status" aria-live="polite">
            <SpinnerIcon className="h-4 w-4" />
            {t("picker.searching")}
          </div>
        )}
        {!loading && error && (
          <div className="py-8 text-center text-[13px] text-rose-400" role="alert">{error}</div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="py-8 text-center text-[13px] text-[var(--text-dim)]">
            {query ? t("picker.noCustomers").replace("{q}", query) : t("picker.noCustomersYet")}
          </div>
        )}
        {!loading && rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => pick(row)}
            className="mb-0.5 flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-start transition-colors hover:border-[var(--border-subtle)] hover:bg-[var(--bg-surface-subtle)] focus-visible:outline-none focus-visible:border-[var(--border-focus)]"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-semibold text-[var(--text-primary)]">
                {row.displayName || "—"}
              </div>
              <div className="truncate text-[12px] text-[var(--text-dim)]">
                {row.companyName || row.email || row.phone || "—"}
              </div>
            </div>
            {row.email && (
              <div className="shrink-0 font-mono text-[11px] text-[var(--text-faint)]">
                {row.email}
              </div>
            )}
          </button>
        ))}
      </div>
    </FormModal>
  );
}
