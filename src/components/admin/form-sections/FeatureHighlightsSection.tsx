"use client";

/* ---------------------------------------------------------------------------
   FeatureHighlightsSection — the feature-card EDITOR, in the product-card
   layout (owner: "same style as product card"): a responsive grid of
   vertical cards — 4:3 photo pane on top (click to upload), title +
   description under it, 中文/عربي in a folded "Translations" drawer with an
   auto-translate button. Add as many cards as needed; each edits, reorders
   and deletes. Self-contained: loads and saves through its own endpoint.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
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
  const [translating, setTranslating] = useState<number | null>(null);
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

  /* Auto-translate: fill zh + ar from the English title/description via the
     Hub's translate endpoint (the hero-name contract). fallback:true is
     surfaced honestly instead of writing English into the zh/ar fields. */
  const translateOne = async (text: string, target: "zh" | "ar"): Promise<string | null> => {
    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text, target_lang: target, source_lang: "en" }),
      });
      const data = (await res.json()) as { translated?: string; fallback?: boolean };
      if (!res.ok || data.fallback || !data.translated) return null;
      return data.translated;
    } catch { return null; }
  };
  const autoTranslate = async (i: number) => {
    const r = rows[i];
    if (!r || (!r.title.trim() && !(r.description ?? "").trim())) return;
    setTranslating(i); setError(null);
    const [tZh, tAr, dZh, dAr] = await Promise.all([
      r.title.trim() ? translateOne(r.title, "zh") : Promise.resolve(null),
      r.title.trim() ? translateOne(r.title, "ar") : Promise.resolve(null),
      (r.description ?? "").trim() ? translateOne(r.description as string, "zh") : Promise.resolve(null),
      (r.description ?? "").trim() ? translateOne(r.description as string, "ar") : Promise.resolve(null),
    ]);
    setTranslating(null);
    if (!tZh && !tAr && !dZh && !dAr) { setError("Auto-translate is unavailable right now."); return; }
    patch(i, {
      ...(tZh ? { title_zh: tZh } : {}),
      ...(tAr ? { title_ar: tAr } : {}),
      ...(dZh ? { description_zh: dZh } : {}),
      ...(dAr ? { description_ar: dAr } : {}),
    });
  };

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

  const bare =
    "w-full bg-transparent text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)]";
  const input =
    "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none";
  const chip =
    "h-7 min-w-7 px-1.5 rounded-lg border text-[11px] inline-flex items-center justify-center";

  return (
    <div className="space-y-4">
      <p className="text-[11.5px] text-[var(--text-muted)]">
        Catalog-style feature cards, laid out exactly like product cards: photo
        on top, name + short explanation under it. They render on the product
        page and feed Koleex AI.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((r, i) => (
          <div key={r.id ?? `new-${i}`} className="group relative kx-glass bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-subtle)] overflow-hidden">
            {/* photo pane — the product card's exact ground; click = upload */}
            <button
              type="button"
              onClick={() => fileRefs.current[i]?.click()}
              className="relative block w-full aspect-[4/3] bg-gradient-to-b from-white to-[#f4f5f7] overflow-hidden border-b border-black/5"
              title="Upload feature photo"
            >
              {r.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.image_url} alt={r.title || "feature"} className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-400">
                  <ImageRawIcon className="h-9 w-9 text-gray-300" />
                  <span className="text-[10.5px]">Click to upload photo</span>
                </span>
              )}
            </button>
            <input
              ref={(el) => { fileRefs.current[i] = el; }}
              type="file" accept="image/*" className="hidden" aria-hidden tabIndex={-1}
              onChange={(e) => void onPickImage(i, e.target.files?.[0] ?? null)}
            />

            {/* card actions — overlay on the photo, product-card style */}
            <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              <button type="button" onClick={() => void autoTranslate(i)} disabled={translating === i}
                title="Auto-translate to 中文 + العربية"
                className={`${chip} border-[#7FA9D6]/50 bg-black/60 text-[#BCD8F0]`}>
                {translating === i ? "…" : "文ع"}
              </button>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                className={`${chip} border-white/20 bg-black/60 text-white/80 disabled:opacity-30`}>←</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1}
                className={`${chip} border-white/20 bg-black/60 text-white/80 disabled:opacity-30`}>→</button>
              <button type="button" onClick={() => remove(i)}
                className={`${chip} border-rose-400/40 bg-black/60 text-rose-300`}>×</button>
            </div>

            {/* body — title bold + description subtitle, like the product card */}
            <div className="p-3 space-y-1">
              <input
                className={`${bare} text-[13px] font-semibold`}
                placeholder="Feature title (EN)"
                value={r.title}
                onChange={(e) => patch(i, { title: e.target.value })}
              />
              <textarea
                className={`${bare} text-[11.5px] leading-snug text-[var(--text-muted)] resize-none`}
                rows={2}
                placeholder="Short explanation (EN)"
                value={r.description ?? ""}
                onChange={(e) => patch(i, { description: e.target.value })}
              />

              {/* translations + model pin, folded so the card stays a card */}
              <details className="pt-1">
                <summary className="cursor-pointer list-none text-[10.5px] tracking-wide text-[var(--text-dim)]">
                  中文 · العربية {r.title_zh || r.title_ar ? "✓" : ""} · options
                </summary>
                <div className="mt-2 space-y-1.5">
                  <input className={input} placeholder="标题 (中文)" value={r.title_zh ?? ""}
                    onChange={(e) => patch(i, { title_zh: e.target.value })} />
                  <textarea className={input} rows={2} placeholder="说明 (中文)" value={r.description_zh ?? ""}
                    onChange={(e) => patch(i, { description_zh: e.target.value })} />
                  <input className={input} dir="rtl" placeholder="العنوان (عربي)" value={r.title_ar ?? ""}
                    onChange={(e) => patch(i, { title_ar: e.target.value })} />
                  <textarea className={input} dir="rtl" rows={2} placeholder="الشرح (عربي)" value={r.description_ar ?? ""}
                    onChange={(e) => patch(i, { description_ar: e.target.value })} />
                  {models.length > 0 && (
                    <select
                      className={input}
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
              </details>
            </div>
          </div>
        ))}

        {/* the "+ add" tile, a ghost product card */}
        <button
          type="button"
          onClick={add}
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-colors sm:aspect-auto sm:min-h-[220px]"
        >
          <span className="text-2xl leading-none">＋</span>
          <span className="text-[11.5px]">Add feature card</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
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
