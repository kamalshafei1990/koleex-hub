"use client";

/* ---------------------------------------------------------------------------
   ProductPickerModal — searchable catalog picker used by the
   Quotation editor's "+ From catalog" button.

   Performance + search quality:
     · Bounded server search (Phase 4 Wave 2B.3): a small browse set loads on
       open and each query hits the server's `q` filter with a low cap
       (debounced, abortable, stale-guarded) — no whole-catalog download.
     · Smart ranking: multi-word (every word must match), matches against
       model code + SKU + product name, normalised (case/diacritics/space),
       and ranked exact → prefix → word-start → substring, with model/SKU
       weighted above the product name. Best matches float to the top.
     · Only the top slice is rendered (DOM stays light even with 2000 rows).
     · Keyboard: ↑/↓ to move, Enter to pick, Esc to close.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormModal, SearchInput } from "@/components/kds";
import { useTranslation } from "@/lib/i18n";
import { docsT } from "@/lib/translations/docs";
import { record } from "@/lib/perf/client";
import { cdnImage } from "@/lib/cdn";
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
  const { t } = useTranslation(docsT);
  const [query, setQuery] = useState("");
  const [allRows, setAllRows] = useState<PickerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  /* Monotonic token so a slow older response can never overwrite a newer
     one after a rapid type (in addition to AbortController). */
  const seqRef = useRef(0);

  /* Reset transient UI each time the modal opens so the previous session's
     query doesn't flash in (the search box autofocuses itself). */
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setError(null);
    setActiveIdx(0);
  }, [open]);

  /* Bounded server search (Phase 4 Wave 2B.3). Previously the modal
     downloaded the WHOLE tenant catalog (q="", limit=2000 → ~705 models +
     image urls) on open and filtered client-side. Now each query hits the
     server's `q` filter with a small cap: a browse set on open (empty query)
     and a bounded search page while typing (debounced, abortable,
     stale-guarded). The rich client ranking below still applies — now over
     the bounded server page instead of the full catalog. */
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const seq = ++seqRef.current;
    const controller = new AbortController();
    setLoading(true);
    const t0 = typeof performance !== "undefined" ? performance.now() : 0;
    const timer = setTimeout(
      async () => {
        try {
          const res = await fetch(
            `/api/quotations/catalog-search?q=${encodeURIComponent(q)}&limit=${q ? 60 : 40}`,
            { credentials: "include", signal: controller.signal },
          );
          if (seq !== seqRef.current) return;
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            setError(j.error || `Couldn't load the catalog (${res.status})`);
            setAllRows([]);
            return;
          }
          const json = (await res.json()) as { rows: PickerRow[] };
          if (seq !== seqRef.current) return;
          setAllRows(json.rows ?? []);
          setError(null);
          if (typeof performance !== "undefined") {
            record("quotations.picker.product_ms", performance.now() - t0);
          }
        } catch (e) {
          if ((e as { name?: string })?.name !== "AbortError" && seq === seqRef.current) {
            setError(e instanceof Error ? e.message : String(e));
          }
        } finally {
          if (seq === seqRef.current) setLoading(false);
        }
      },
      q ? 220 : 0,
    );
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, query]);

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

  const hint = !loading && !error && allRows.length > 0
    ? `${query.trim()
        ? t("picker.matches").replace("{n}", String(results.length))
        : t("picker.products").replace("{n}", String(allRows.length))}${
        results.length > MAX_RENDER ? ` · ${t("picker.showingTop").replace("{n}", String(MAX_RENDER))}` : ""}`
    : "";

  return (
    <FormModal open={open} onClose={onClose} title={t("picker.productTitle")} width="max-w-2xl">
      {/* Pinned above the scrolling results — the modal body is the scroll
          container; the negative top margin closes the body padding
          above it so nothing scrolls past the search box. */}
      <div className="sticky top-0 z-[1] -mt-5 bg-[var(--bg-secondary)] pt-5 pb-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          onKeyDown={onInputKeyDown}
          placeholder={t("picker.productPh")}
          autoFocus
        />
        {/* Result count / hint — quiet line under the search box. */}
        {hint && (
          <div className="mt-2 flex justify-between text-[11px] text-[var(--text-dim)]">
            <span>{hint}</span>
            <span className="hidden sm:inline">{t("picker.keys")}</span>
          </div>
        )}
      </div>

      <div ref={listRef} className="min-h-[200px]" role="listbox" aria-label={t("picker.productTitle")}>
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-[var(--text-dim)]" role="status" aria-live="polite">
            <SpinnerIcon className="h-4 w-4" />
            {t("picker.loadingCatalog")}
          </div>
        )}
        {!loading && error && (
          <div className="py-8 text-center text-[13px] text-rose-400" role="alert">{error}</div>
        )}
        {!loading && !error && shown.length === 0 && (
          <div className="py-8 text-center text-[13px] text-[var(--text-dim)]">
            {query ? t("picker.noProducts").replace("{q}", query) : t("picker.noProductsYet")}
          </div>
        )}
        {!loading && shown.map((row, i) => {
          const active = i === activeIdx;
          return (
            <button
              key={row.model_id}
              type="button"
              role="option"
              aria-selected={active}
              data-active={active ? "1" : "0"}
              onClick={() => pick(row)}
              onMouseMove={() => { if (!active) setActiveIdx(i); }}
              className={`mb-0.5 flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-start transition-colors focus-visible:outline-none ${
                active
                  ? "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]"
                  : "border-transparent hover:border-[var(--border-subtle)] hover:bg-[var(--bg-surface-subtle)]"
              }`}
            >
              {/* Thumbnail — white behind it on purpose: product photos are
                  cut-outs on white and read wrong on a dark surface. */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white">
                {row.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cdnImage(row.image_url, { width: 128, quality: 75 })} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[18px] text-gray-400">–</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[12px] font-semibold tracking-[0.02em] text-[var(--text-primary)]">
                  {row.model_name || row.sku || "—"}
                </div>
                <div className="truncate text-[13px] text-[var(--text-secondary)]">
                  {row.product_name}
                </div>
              </div>
              <div className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
                {row.price > 0 ? `US$ ${row.price.toLocaleString("en-US")}` : "—"}
              </div>
            </button>
          );
        })}
      </div>
    </FormModal>
  );
}
