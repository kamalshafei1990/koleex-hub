"use client";

/* ---------------------------------------------------------------------------
   ProductPicker — a grid browser for linking products to a task.

   Photo + name + code cards, searchable by name/code and filterable by
   division and category. Multi-select (click a card to toggle); selected
   cards get an accent ring + check. Opens above the Task modal.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { todoT } from "@/lib/translations/todo";
import type { TodoProductRef, ProductRow, DivisionRow, CategoryRow } from "@/types/supabase";
import { fetchProducts, fetchDivisions, fetchCategories, fetchClassificationIcons } from "@/lib/products-admin";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";

/* Storage base for taxonomy icons (divisions/categories live as SVGs under
   media/<level>/<slug>.svg; the classification-icon hub overrides win). */
const STORAGE_BASE = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()}/storage/v1/object/public/media`;
const taxoStorageIcon = (level: "divisions" | "categories", slug: string) =>
  `${STORAGE_BASE}/${level}/${slug}.svg`;

type Opt = { value: string; label: string; icon?: string };

/* A small SVG icon that falls back to a neutral tag glyph if it 404s. */
function TaxoIcon({ src, className = "" }: { src?: string; className?: string }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <PackageIcon className={`${className} text-[var(--text-ghost)]`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={`${className} object-contain`} onError={() => setBad(true)} />;
}

/* Brand-styled select that shows each option's icon (native <select> can't).
   Keyboard-light: click to open, click an option to choose, outside-click to close. */
function IconSelect({
  value,
  onChange,
  options,
  allLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
  allLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const current = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-9 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none flex items-center gap-2 min-w-[150px] focus:border-[var(--border-focus)]"
      >
        {current?.icon && <TaxoIcon src={current.icon} className="h-4 w-4 shrink-0" />}
        <span className="truncate flex-1 text-start">{current ? current.label : allLabel}</span>
        <AngleDownIcon className="h-3.5 w-3.5 text-[var(--text-dim)] shrink-0" />
      </button>
      {/* Solid bg (--bg-secondary) — the popover floats over bright product
          cards, so a translucent --bg-elevated would be unreadable. */}
      {open && (
        <div className="absolute z-50 mt-1 w-[230px] max-h-72 overflow-y-auto rounded-xl bg-[var(--bg-secondary,#111)] border border-[var(--border-subtle)] shadow-[0_12px_40px_rgba(0,0,0,0.55)] p-1">
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
            className={`w-full text-start px-2.5 h-9 rounded-lg text-[12px] flex items-center gap-2 ${value === "" ? "bg-[var(--accent)]/[0.12] text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:bg-[var(--bg-inverted)]/[0.06]"}`}
          >
            {allLabel}
          </button>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-start px-2.5 h-9 rounded-lg text-[12px] flex items-center gap-2 ${o.value === value ? "bg-[var(--accent)]/[0.12] text-[var(--text-primary)]" : "text-[var(--text-primary)] hover:bg-[var(--bg-inverted)]/[0.06]"}`}
            >
              <TaxoIcon src={o.icon} className="h-4 w-4 shrink-0" />
              <span className="truncate">{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Pick = {
  id: string;
  name: string;
  code: string | null;
  image: string | null;
  division_slug: string;
  category_slug: string;
};

export default function ProductPicker({
  open,
  selectedIds,
  onToggle,
  onClose,
}: {
  open: boolean;
  selectedIds: string[];
  onToggle: (ref: TodoProductRef) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(todoT);
  const [products, setProducts] = useState<Pick[]>([]);
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [icons, setIcons] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [div, setDiv] = useState("");
  const [cat, setCat] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const metaP = fetch("/api/products/media-thumbs", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { thumbs: {}, models: {} }))
      .then((j: { thumbs?: Record<string, string>; models?: Record<string, string> }) => ({
        thumbs: j.thumbs ?? {},
        models: j.models ?? {},
      }))
      .catch(() => ({ thumbs: {} as Record<string, string>, models: {} as Record<string, string> }));
    const iconsP = fetchClassificationIcons().catch(() => ({} as Record<string, Record<string, string>>));
    Promise.all([fetchProducts(), fetchDivisions(), fetchCategories(), metaP, iconsP])
      .then(([prods, divs, cats, meta, ico]) => {
        if (cancelled) return;
        const { thumbs, models } = meta;
        setIcons(ico);
        setProducts(
          (prods as ProductRow[]).map((p) => ({
            id: p.id,
            name: p.product_name,
            // Model code is the identifier buyers recognise: KOLEEX model_name /
            // primary_model first, then any legacy SKU.
            code: models[p.id] ?? p.internal_sku ?? p.legacy_code ?? null,
            image: thumbs[p.id] ?? p.hero_poster_url ?? p.og_image_url ?? null,
            division_slug: p.division_slug,
            category_slug: p.category_slug,
          })),
        );
        setDivisions(divs);
        setCategories(cats);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open]);

  /* Categories shown in the dropdown are scoped to the chosen division. */
  const divisionId = useMemo(
    () => divisions.find((d) => d.slug === div)?.id ?? null,
    [divisions, div],
  );
  const visibleCategories = useMemo(
    () => (divisionId ? categories.filter((c) => c.division_id === divisionId) : categories),
    [categories, divisionId],
  );

  /* Options with icons: hub override wins, else the storage SVG by slug. */
  const divisionOpts = useMemo<Opt[]>(
    () =>
      divisions.map((d) => ({
        value: d.slug,
        label: d.name,
        icon: icons.division?.[d.slug] ?? taxoStorageIcon("divisions", d.slug),
      })),
    [divisions, icons],
  );
  const categoryOpts = useMemo<Opt[]>(
    () =>
      visibleCategories.map((c) => ({
        value: c.slug,
        label: c.name,
        icon: icons.category?.[c.slug] ?? taxoStorageIcon("categories", c.slug),
      })),
    [visibleCategories, icons],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products
      .filter((p) => {
        if (div && p.division_slug !== div) return false;
        if (cat && p.category_slug !== cat) return false;
        if (needle && !(p.name.toLowerCase().includes(needle) || (p.code || "").toLowerCase().includes(needle)))
          return false;
        return true;
      })
      // Photos first so the grid opens on real product imagery, not the
      // placeholder cards (products without a photo sink to the bottom).
      .sort((a, b) => (a.image ? 0 : 1) - (b.image ? 0 : 1));
  }, [products, q, div, cat]);

  if (!open) return null;

  const sel = new Set(selectedIds);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 md:p-4 pt-20 md:pt-24 pb-6 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 md:px-5 py-3.5 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <PackageIcon className="h-4 w-4 text-[var(--text-dim)]" />
            <span className="text-[14px] font-semibold text-[var(--text-primary)]">{t("extras.linkProducts")}</span>
            {selectedIds.length > 0 && (
              <span className="text-[11px] font-semibold text-[var(--accent)]">{selectedIds.length} {t("picker.selectedWord")}</span>
            )}
          </div>
          <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:bg-[var(--bg-inverted)]/[0.06] hover:text-[var(--text-primary)]">
            <CrossIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 md:px-5 py-3 border-b border-[var(--border-subtle)]">
          <div className="relative flex-1 min-w-[180px]">
            <SearchIcon className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
            <input
              autoFocus
              className="w-full h-9 ps-9 pe-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
              placeholder={t("picker.search")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <IconSelect
            value={div}
            onChange={(v) => { setDiv(v); setCat(""); }}
            options={divisionOpts}
            allLabel={t("picker.allDivisions")}
          />
          <IconSelect value={cat} onChange={setCat} options={categoryOpts} allLabel={t("picker.allCategories")} />
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5">
          {loading ? (
            <div className="h-40 flex items-center justify-center text-[var(--text-dim)]">
              <SpinnerIcon className="h-5 w-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="h-40 flex items-center justify-center text-[12px] text-[var(--text-ghost)]">{t("picker.noMatch")}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map((p) => {
                const isSel = sel.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onToggle({ id: p.id, name: p.name, code: p.code })}
                    className={`group relative text-start rounded-xl border overflow-hidden transition-all ${
                      isSel
                        ? "border-[var(--accent)] ring-1 ring-[var(--accent)]"
                        : "border-[var(--border-subtle)] hover:border-[var(--border-focus)]"
                    } bg-[var(--bg-surface)]`}
                  >
                    <div className="aspect-square w-full bg-white flex items-center justify-center overflow-hidden p-2">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt={p.name} className="max-h-full max-w-full object-contain" />
                      ) : (
                        <PackageIcon className="h-8 w-8 text-black/20" />
                      )}
                    </div>
                    {isSel && (
                      <span className="absolute top-1.5 end-1.5 h-5 w-5 rounded-full bg-[var(--accent)] text-white inline-flex items-center justify-center shadow">
                        <CheckIcon className="h-3 w-3" />
                      </span>
                    )}
                    <div className="p-2">
                      {/* Model code first (the identifier), product name beneath. */}
                      {p.code && (
                        <p className="text-[11.5px] font-semibold text-[var(--text-primary)] truncate" title={p.code}>{p.code}</p>
                      )}
                      <p
                        className={`text-[10.5px] truncate ${p.code ? "text-[var(--text-dim)]" : "font-medium text-[var(--text-primary)]"}`}
                        title={p.name}
                      >
                        {p.name}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-4 md:px-5 py-3 border-t border-[var(--border-subtle)]">
          <span className="text-[11px] text-[var(--text-ghost)]">{loading ? "" : `${filtered.length} ${t("picker.productsWord")}`}</span>
          <button onClick={onClose} className="h-9 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90">
            {t("common.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
