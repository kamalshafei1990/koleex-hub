"use client";

/* ---------------------------------------------------------------------------
   FeatureHighlightsSection — the feature-card EDITOR in the product-card
   layout, round 3 (owner):
   · an explicit ✎ EDIT button — cards rest as clean product cards and open
     into edit mode; a freshly added card starts in edit mode.
   · translate to ANY language, hero-style: a locale picker (the same LOCALES
     list the hero name uses) + one Translate button. 中文/العربية land in
     their first-class columns (the Hub UI reads them); every other locale is
     stored per-code in `translations` jsonb — the product_translations
     philosophy.
   · the photo accepts click-to-upload, DRAG & DROP, and PASTE (a screenshot
     in the clipboard pastes straight into the card in edit mode).
   Self-contained: loads and saves through its own endpoint.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import ArrowRightIcon from "@/components/icons/ui/ArrowRightIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import XCircleIcon from "@/components/icons/ui/XCircleIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import LanguagesIcon from "@/components/icons/ui/LanguagesIcon";
import { LOCALES } from "@/types/product-form";
import {
  fetchProductFeatureHighlights,
  saveProductFeatureHighlights,
  uploadProductFile,
  type ProductFeatureHighlightRow,
} from "@/lib/products-admin";

interface ModelOpt { id: string; code: string }

const localeName = (code: string) =>
  LOCALES.find((l) => l.code === code)?.name ?? code;

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
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [translating, setTranslating] = useState(false);
  const [targetLocale, setTargetLocale] = useState<string>("zh");
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
  const remove = (i: number) => {
    setEditingIdx(null);
    setRows((l) => l.filter((_, j) => j !== i));
  };
  const add = () => {
    setRows((l) => {
      setEditingIdx(l.length);
      return [...l, { title: "", description: "", image_url: null }];
    });
  };

  /* ── photo: click, drag & drop, paste ── */
  const setImage = useCallback(async (i: number, file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    setError(null);
    const up = await uploadProductFile(file);
    if (!up?.url) { setError("Image upload failed — try again."); return; }
    patch(i, { image_url: up.url });
  }, []);
  const onDrop = (i: number) => (e: React.DragEvent) => {
    e.preventDefault();
    void setImage(i, e.dataTransfer.files?.[0] ?? null);
  };
  const onPaste = (i: number) => (e: React.ClipboardEvent) => {
    const item = [...(e.clipboardData?.items ?? [])].find((it) => it.type.startsWith("image/"));
    if (!item) return;
    e.preventDefault();
    void setImage(i, item.getAsFile());
  };

  /* ── translate to the PICKED locale, hero-style ── */
  const translateOne = async (text: string, target: string): Promise<string | null> => {
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
  const translateCard = async (i: number) => {
    const r = rows[i];
    if (!r || (!r.title.trim() && !(r.description ?? "").trim())) return;
    setTranslating(true); setError(null);
    const [tt, dd] = await Promise.all([
      r.title.trim() ? translateOne(r.title, targetLocale) : Promise.resolve(null),
      (r.description ?? "").trim() ? translateOne(r.description as string, targetLocale) : Promise.resolve(null),
    ]);
    setTranslating(false);
    if (!tt && !dd) { setError(`Auto-translate to ${localeName(targetLocale)} is unavailable right now.`); return; }
    if (targetLocale === "zh") {
      patch(i, { ...(tt ? { title_zh: tt } : {}), ...(dd ? { description_zh: dd } : {}) });
    } else if (targetLocale === "ar") {
      patch(i, { ...(tt ? { title_ar: tt } : {}), ...(dd ? { description_ar: dd } : {}) });
    } else {
      const cur = rows[i].translations ?? {};
      patch(i, {
        translations: {
          ...cur,
          [targetLocale]: {
            ...(cur[targetLocale] ?? {}),
            ...(tt ? { title: tt } : {}),
            ...(dd ? { description: dd } : {}),
          },
        },
      });
    }
  };

  /* which locales already carry text on a card (for the chips row) */
  const filledLocales = (r: ProductFeatureHighlightRow): string[] => [
    ...(r.title_zh || r.description_zh ? ["zh"] : []),
    ...(r.title_ar || r.description_ar ? ["ar"] : []),
    ...Object.keys(r.translations ?? {}),
  ];
  const localeValue = (r: ProductFeatureHighlightRow, code: string): { title: string; description: string } =>
    code === "zh"
      ? { title: r.title_zh ?? "", description: r.description_zh ?? "" }
      : code === "ar"
        ? { title: r.title_ar ?? "", description: r.description_ar ?? "" }
        : { title: r.translations?.[code]?.title ?? "", description: r.translations?.[code]?.description ?? "" };
  const setLocaleValue = (i: number, code: string, field: "title" | "description", value: string) => {
    if (code === "zh") patch(i, field === "title" ? { title_zh: value } : { description_zh: value });
    else if (code === "ar") patch(i, field === "title" ? { title_ar: value } : { description_ar: value });
    else {
      const cur = rows[i].translations ?? {};
      patch(i, { translations: { ...cur, [code]: { ...(cur[code] ?? {}), [field]: value } } });
    }
  };

  const save = async () => {
    if (!productId) return;
    setSaving(true); setError(null);
    const ok = await saveProductFeatureHighlights(
      productId,
      rows.filter((r) => r.title.trim()),
    );
    setSaving(false);
    if (ok) { setSavedAt(Date.now()); setEditingIdx(null); }
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
  /* These chips sit ON the card photo, which is usually white — same story
     as the product-card actions: the global Aurora hover would replace their
     fill with 3% white and vanish them over a light image, so each one keeps
     data-kx-keep-hover and manages its own dark-scrim contrast. */
  const chip =
    "h-7 w-7 rounded-lg border backdrop-blur-sm inline-flex items-center justify-center transition-colors";
  const chipDark =
    "bg-black/60 border-white/25 text-white/85 hover:text-white hover:bg-black/75 disabled:opacity-30";

  return (
    <div className="space-y-4">
      <p className="text-[11.5px] text-[var(--text-muted)]">
        Catalog-style feature cards, laid out exactly like product cards. Click
        the pencil to edit a card; the photo accepts click, drag&nbsp;&amp;&nbsp;drop,
        and paste (a screenshot pastes straight in while editing).
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((r, i) => {
          const editing = editingIdx === i;
          return (
            <div
              key={r.id ?? `new-${i}`}
              onPaste={editing ? onPaste(i) : undefined}
              className={`group relative kx-glass bg-[var(--bg-secondary)] rounded-xl border overflow-hidden ${editing ? "border-[#7FA9D6]/60 ring-1 ring-[#7FA9D6]/30" : "border-[var(--border-subtle)] kx-hover-card"}`}
            >
              {/* photo pane — the product card's exact ground */}
              <button
                type="button"
                onClick={() => { if (editing) fileRefs.current[i]?.click(); }}
                onDragOver={editing ? (e) => e.preventDefault() : undefined}
                onDrop={editing ? onDrop(i) : undefined}
                className={`relative block w-full aspect-[4/3] bg-gradient-to-b from-white to-[#f4f5f7] overflow-hidden border-b border-black/5 ${editing ? "cursor-pointer" : "cursor-default"}`}
                title={editing ? "Click, drop or paste a photo" : undefined}
                tabIndex={editing ? 0 : -1}
              >
                {r.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image_url} alt={r.title || "feature"} className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-400">
                    <ImageRawIcon className="h-9 w-9 text-gray-300" />
                    {editing && <span className="text-[10.5px]">Click · drop · paste a photo</span>}
                  </span>
                )}
              </button>
              {editing && r.image_url && (
                <button type="button" data-kx-keep-hover="" onClick={() => patch(i, { image_url: null })}
                  title="Remove photo"
                  className={`${chip} absolute top-2 left-2 z-10 bg-black/60 border-white/25 text-white/85 hover:text-red-400 hover:bg-black/75`}>
                  <XCircleIcon className="h-3.5 w-3.5" />
                </button>
              )}
              <input
                ref={(el) => { fileRefs.current[i] = el; }}
                type="file" accept="image/*" className="hidden" aria-hidden tabIndex={-1}
                onChange={(e) => void setImage(i, e.target.files?.[0] ?? null)}
              />

              {/* card actions — overlay on the photo, product-card style */}
              <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button type="button" data-kx-keep-hover="" onClick={() => setEditingIdx(editing ? null : i)}
                  title={editing ? "Done editing" : "Edit this card"}
                  className={`${chip} ${editing ? "border-[#7FA9D6] bg-[#567FB2] text-white hover:bg-[#4a6f9e]" : chipDark}`}>
                  {editing ? <CheckIcon className="h-3.5 w-3.5" /> : <PencilIcon className="h-3.5 w-3.5" />}
                </button>
                <button type="button" data-kx-keep-hover="" onClick={() => move(i, -1)} disabled={i === 0}
                  title="Move left" className={`${chip} ${chipDark}`}>
                  <ArrowLeftIcon className="h-3.5 w-3.5" />
                </button>
                <button type="button" data-kx-keep-hover="" onClick={() => move(i, 1)} disabled={i === rows.length - 1}
                  title="Move right" className={`${chip} ${chipDark}`}>
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </button>
                <button type="button" data-kx-keep-hover="" onClick={() => remove(i)}
                  title="Delete this card"
                  className={`${chip} bg-black/60 border-white/25 text-white/85 hover:text-red-400 hover:bg-black/75`}>
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* body */}
              {!editing ? (
                <div className="p-3">
                  <div className="text-[13px] font-semibold leading-snug text-[var(--text-primary)]">
                    {r.title || <span className="text-[var(--text-dim)]">Untitled feature — press ✎</span>}
                  </div>
                  {r.description && (
                    <div className="mt-1 text-[11.5px] leading-snug text-[var(--text-muted)]">{r.description}</div>
                  )}
                  {filledLocales(r).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {filledLocales(r).map((c) => (
                        <span key={c} className="rounded border border-[var(--border-subtle)] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[var(--text-dim)]">{c}</span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 space-y-2">
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

                  {/* hero-style translate row: pick ANY locale, one button */}
                  <div className="flex items-center gap-1.5">
                    <select
                      className={`${input} !w-auto flex-1`}
                      value={targetLocale}
                      onChange={(e) => setTargetLocale(e.target.value)}
                    >
                      {LOCALES.map((l) => (
                        <option key={l.code} value={l.code}>{l.name}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => void translateCard(i)} disabled={translating}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#7FA9D6]/50 bg-[#567FB2]/15 px-2.5 py-1.5 text-[11.5px] text-[#BCD8F0] disabled:opacity-40">
                      <LanguagesIcon className="h-3.5 w-3.5" />
                      {translating ? "Translating…" : "Translate"}
                    </button>
                  </div>

                  {/* every locale that carries text, editable in place */}
                  {filledLocales(r).map((code) => {
                    const v = localeValue(r, code);
                    const rtl = code === "ar" || code === "ur";
                    return (
                      <div key={code} className="rounded-lg border border-[var(--border-subtle)] p-2 space-y-1">
                        <div className="text-[9.5px] uppercase tracking-wider text-[var(--text-dim)]">{localeName(code)}</div>
                        <input className={`${bare} text-[12px]`} dir={rtl ? "rtl" : undefined} value={v.title}
                          placeholder="Title"
                          onChange={(e) => setLocaleValue(i, code, "title", e.target.value)} />
                        <textarea className={`${bare} text-[11px] text-[var(--text-muted)] resize-none`} dir={rtl ? "rtl" : undefined} rows={2} value={v.description}
                          placeholder="Description"
                          onChange={(e) => setLocaleValue(i, code, "description", e.target.value)} />
                      </div>
                    );
                  })}

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
              )}
            </div>
          );
        })}

        {/* the "+ add" tile, a ghost product card */}
        <button
          type="button"
          onClick={add}
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-colors sm:aspect-auto sm:min-h-[220px]"
        >
          <PlusIcon className="h-6 w-6" />
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
