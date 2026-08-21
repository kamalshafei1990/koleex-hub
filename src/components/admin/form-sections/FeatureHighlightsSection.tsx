"use client";

/* ---------------------------------------------------------------------------
   FeatureHighlightsSection — the supplier-catalog "feature card" editor
   (owner ask 2026-08-21, pointing at the Sertol/Lingrai pages: small photo +
   name + short explanation — "Sensor", "Adjustment motor", "Wire breakage
   responder"). Not media, not specs: its own rows on
   product_feature_highlights, optionally pinned to one model.

   SELF-CONTAINED on purpose: it fetches and saves through its own endpoint
   (replace-the-set, like certifications), so wiring it into the huge
   ProductForm is one render line — no new tentacles into the form's main
   save machine. Trilingual by the standing rule (EN is the source of truth;
   zh/ar optional). Images go through the existing uploadProductFile helper
   (the public media bucket).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchProductFeatureHighlights,
  saveProductFeatureHighlights,
  uploadProductFile,
  type ProductFeatureHighlightRow,
} from "@/lib/products-admin";

interface ModelOpt { id: string; code: string }

export default function FeatureHighlightsSection({
  productId,
  models = [],
}: {
  productId: string;
  /** Optional member list (id + display code) for pinning a card to one model. */
  models?: ModelOpt[];
}) {
  const [rows, setRows] = useState<ProductFeatureHighlightRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    /* no synchronous setState here (cascading-render rule): the empty-id
       case renders its own message before `loaded` is ever consulted */
    if (!productId) return;
    fetchProductFeatureHighlights(productId).then((r) => {
      if (!cancelled) { setRows(r); setLoaded(true); }
    });
    return () => { cancelled = true; };
  }, [productId]);

  const patch = (i: number, p: Partial<ProductFeatureHighlightRow>) =>
    setRows((l) => l.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const move = (i: number, dir: -1 | 1) =>
    setRows((l) => {
      const j = i + dir;
      if (j < 0 || j >= l.length) return l;
      const next = [...l];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const remove = (i: number) => setRows((l) => l.filter((_, j) => j !== i));
  const add = () => setRows((l) => [...l, { title: "", description: "", image_url: null }]);

  const onPickImage = useCallback(async (i: number, file: File | null) => {
    if (!file) return;
    setError(null);
    const up = await uploadProductFile(file);
    if (!up?.url) { setError("Image upload failed — try again."); return; }
    patch(i, { image_url: up.url });
  }, []);

  const save = async () => {
    if (!productId) return;
    setSaving(true); setError(null);
    const ok = await saveProductFeatureHighlights(
      productId,
      rows.filter((r) => r.title.trim()),
    );
    setSaving(false);
    if (ok) setSavedAt(Date.now());
    else setError("Couldn't save feature highlights.");
  };

  if (!productId) {
    return (
      <p className="text-[12px] text-[var(--text-dim)]">
        Save the product first — feature highlights attach to a saved product.
      </p>
    );
  }
  if (!loaded) return <p className="text-[12px] text-[var(--text-dim)]">Loading feature highlights…</p>;

  const input =
    "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--text-primary)] outline-none";

  return (
    <div className="space-y-3">
      <p className="text-[11.5px] text-[var(--text-muted)]">
        Catalog-style feature cards: a small photo + a name + a short explanation
        (like “Sensor”, “Adjustment motor” in supplier catalogs). They render on
        the product page and feed Koleex AI.
      </p>

      {rows.map((r, i) => (
        <div key={r.id ?? `new-${i}`} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3">
          <div className="flex gap-3">
            {/* photo */}
            <button
              type="button"
              onClick={() => fileRefs.current[i]?.click()}
              className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[10px] text-[var(--text-dim)]"
              title="Upload feature photo"
            >
              {r.image_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={r.image_url} alt={r.title || "feature"} className="h-full w-full object-cover" />
                : "+ photo"}
            </button>
            <input
              ref={(el) => { fileRefs.current[i] = el; }}
              type="file" accept="image/*" className="hidden" aria-hidden tabIndex={-1}
              onChange={(e) => void onPickImage(i, e.target.files?.[0] ?? null)}
            />
            {/* trilingual title + description */}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
                <input className={input} placeholder="Feature title (EN)" value={r.title}
                  onChange={(e) => patch(i, { title: e.target.value })} />
                <input className={input} placeholder="标题 (中文)" value={r.title_zh ?? ""}
                  onChange={(e) => patch(i, { title_zh: e.target.value })} />
                <input className={input} dir="rtl" placeholder="العنوان (عربي)" value={r.title_ar ?? ""}
                  onChange={(e) => patch(i, { title_ar: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
                <textarea className={input} rows={2} placeholder="Short explanation (EN)" value={r.description ?? ""}
                  onChange={(e) => patch(i, { description: e.target.value })} />
                <textarea className={input} rows={2} placeholder="说明 (中文)" value={r.description_zh ?? ""}
                  onChange={(e) => patch(i, { description_zh: e.target.value })} />
                <textarea className={input} dir="rtl" rows={2} placeholder="الشرح (عربي)" value={r.description_ar ?? ""}
                  onChange={(e) => patch(i, { description_ar: e.target.value })} />
              </div>
              {models.length > 0 && (
                <select
                  className={input + " md:w-64"}
                  value={r.model_id ?? ""}
                  onChange={(e) => patch(i, { model_id: e.target.value || null })}
                >
                  <option value="">Whole product (all models)</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>Only {m.code}</option>
                  ))}
                </select>
              )}
            </div>
            {/* order + delete */}
            <div className="flex shrink-0 flex-col items-center gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                className="h-6 w-6 rounded border border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] disabled:opacity-30">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1}
                className="h-6 w-6 rounded border border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] disabled:opacity-30">↓</button>
              <button type="button" onClick={() => remove(i)}
                className="h-6 w-6 rounded border border-[var(--border-subtle)] text-[12px] text-rose-300">×</button>
            </div>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <button type="button" onClick={add}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] text-[var(--text-primary)]">
          ＋ Add feature card
        </button>
        <button type="button" onClick={() => void save()} disabled={saving}
          className="rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-inverted)] disabled:opacity-50">
          {saving ? "Saving…" : "Save highlights"}
        </button>
        {savedAt && !saving && <span className="text-[11px] text-emerald-400">Saved ✓</span>}
        {error && <span className="text-[11px] text-rose-300">{error}</span>}
      </div>
    </div>
  );
}
