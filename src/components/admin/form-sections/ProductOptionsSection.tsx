"use client";

/* ---------------------------------------------------------------------------
   ProductOptionsSection — the Options tab of Product Data.

   The questions a buyer answers to reach the right configuration: the stand,
   its thickness, the wheels, the wheel size, the colour, the voltage note.
   Owner's brief (2026-08-25): options differ per product with NO rule across
   products, so they are entered per product — with "copy from another
   product" so twenty similar machines are not twenty re-entries.

   ── What is deliberately NOT entered here ───────────────────────────────────
   · "Which model" — that IS the family's model list (Variants tab).
   · "Head only vs complete set" — derived from supports_head_only /
     supports_complete_set on the product (owner decision: automatic).
   Entering either here would be a second copy of an existing fact.

   ── An answer prices itself one of three ways ───────────────────────────────
   · linked to a product (optionally one model of it) → price AND weight AND
     cbm come from that model, live. No numbers typed here, ever — the API and
     a DB trigger both refuse them.
   · manual deltas (¥ / kg / cbm) — for choices that are not products.
   · nothing — informational (voltage, plug); recorded, never priced.

   Self-contained like FeatureHighlightsSection: loads and saves through
   /api/product-options, needs a saved product id.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import { uploadProductFile } from "@/lib/products-admin";

/* ── shapes ── */
interface OptValue {
  key: string;
  label: string;
  label_i18n: Record<string, string>;
  image_url: string | null;
  linked_product_id: string | null;
  linked_model_id: string | null;
  /* display-only, resolved at link time or on load */
  linked_name?: string | null;
  price_delta_cny: string;
  weight_delta_kg: string;
  cbm_delta: string;
  is_default: boolean;
}
interface Opt {
  key: string;
  title: string;
  title_i18n: Record<string, string>;
  kind: "choice" | "yes_no" | "info";
  required: boolean;
  depends_on_value_key: string | null;
  values: OptValue[];
}

/* ── Unsaved-edit survival across tab switches ───────────────────────────────
   The form's tab pane is KEYED on the current step (the Hub's route-tab
   motion pattern), so switching to Variants and back REMOUNTS this whole
   section — useState alone would silently discard unsaved questions, which is
   exactly the kind of loss that makes people stop trusting an editor.
   Mount-once inside the pane cannot help: the keyed pane remounts everything
   in it. So unsaved drafts live OUTSIDE the tree, in this module-scoped map,
   keyed by product. Restored on remount, discarded on save or clean load.
   In-memory on purpose: a page reload drops it, same as any unsaved form. */
const unsavedDrafts = new Map<string, Opt[]>();

let seq = 0;
const freshKey = () => `k${Date.now().toString(36)}${(seq++).toString(36)}`;

const emptyValue = (): OptValue => ({
  key: freshKey(), label: "", label_i18n: {}, image_url: null,
  linked_product_id: null, linked_model_id: null, linked_name: null,
  price_delta_cny: "", weight_delta_kg: "", cbm_delta: "", is_default: false,
});
const emptyOption = (kind: Opt["kind"] = "choice"): Opt => ({
  key: freshKey(), title: "", title_i18n: {}, kind, required: false,
  depends_on_value_key: null,
  values: kind === "yes_no" ? [{ ...emptyValue(), label: "Yes" }] : [emptyValue()],
});

const KIND_LABEL: Record<Opt["kind"], string> = {
  choice: "Choice list",
  yes_no: "Yes / No",
  info: "Info only",
};

const INPUT =
  "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--text-primary)] outline-none transition focus:border-[var(--border-strong)] placeholder:text-[var(--text-dim)]";
/* NOT derived from INPUT: that string starts with w-full, and "w-full w-20"
   resolves by stylesheet order, not by which class was written last — the
   numeric boxes rendered full-width. Sized classes live only on the caller. */
const NUM =
  "rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[12px] text-[var(--text-primary)] outline-none transition focus:border-[var(--border-strong)] placeholder:text-[var(--text-dim)] tabular-nums";

export default function ProductOptionsSection({ productId }: { productId: string }) {
  const [options, setOptions] = useState<Opt[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [linkFor, setLinkFor] = useState<{ optKey: string; valKey: string } | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  /* ── load ── */
  useEffect(() => {
    if (!productId) return;
    /* A remount with an unsaved draft resumes it — fetching would overwrite
       the person's work with the database's older truth. */
    const draft = unsavedDrafts.get(productId);
    if (draft) {
      setOptions(draft);
      setDirty(true);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/product-options?product_id=${productId}`, { cache: "no-store" });
        const json = (await res.json()) as { options?: Array<Record<string, unknown>> };
        if (!alive) return;
        const rows = json.options ?? [];
        /* Server rows carry real ids; re-key them client-side and translate
           depends_on_value_id back into key space. */
        const valueKeyById = new Map<string, string>();
        const opts: Opt[] = rows.map((o) => {
          const values = ((o.values as Array<Record<string, unknown>>) ?? []).map((v) => {
            const key = freshKey();
            valueKeyById.set(v.id as string, key);
            return {
              key,
              label: (v.label as string) ?? "",
              label_i18n: (v.label_i18n as Record<string, string>) ?? {},
              image_url: (v.image_url as string) ?? null,
              linked_product_id: (v.linked_product_id as string) ?? null,
              linked_model_id: (v.linked_model_id as string) ?? null,
              linked_name: null,
              price_delta_cny: v.price_delta_cny == null ? "" : String(v.price_delta_cny),
              weight_delta_kg: v.weight_delta_kg == null ? "" : String(v.weight_delta_kg),
              cbm_delta: v.cbm_delta == null ? "" : String(v.cbm_delta),
              is_default: v.is_default === true,
            };
          });
          return {
            key: freshKey(),
            title: (o.title as string) ?? "",
            title_i18n: (o.title_i18n as Record<string, string>) ?? {},
            kind: (o.kind as Opt["kind"]) ?? "choice",
            required: o.required === true,
            depends_on_value_key: o.depends_on_value_id ? (valueKeyById.get(o.depends_on_value_id as string) ?? null) : null,
            values,
          };
        });
        setOptions(opts);
        /* Resolve linked product names for display — one slim read. */
        const ids = [...new Set(opts.flatMap((o) => o.values.map((v) => v.linked_product_id).filter(Boolean)))] as string[];
        if (ids.length) void resolveLinkedNames(ids, setOptions);
      } catch {
        if (alive) { setError("Could not load options."); setOptions([]); }
      }
    })();
    return () => { alive = false; };
  }, [productId]);

  const patch = useCallback((updater: (prev: Opt[]) => Opt[]) => {
    setOptions((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      unsavedDrafts.set(productId, next);
      return next;
    });
    setDirty(true);
    setSavedTick(false);
  }, [productId]);

  const patchOpt = (optKey: string, p: Partial<Opt>) =>
    patch((prev) => prev.map((o) => (o.key === optKey ? { ...o, ...p } : o)));
  const patchVal = (optKey: string, valKey: string, p: Partial<OptValue>) =>
    patch((prev) => prev.map((o) =>
      o.key === optKey ? { ...o, values: o.values.map((v) => (v.key === valKey ? { ...v, ...p } : v)) } : o,
    ));

  /* Deleting a value silently orphans any question that depended on it —
     unhook those dependencies explicitly so the editor shows them as
     unconditional instead of saving a dangling reference. */
  const removeValue = (optKey: string, valKey: string) =>
    patch((prev) => prev.map((o) => ({
      ...o,
      depends_on_value_key: o.depends_on_value_key === valKey ? null : o.depends_on_value_key,
      values: o.key === optKey ? o.values.filter((v) => v.key !== valKey) : o.values,
    })));
  const removeOption = (optKey: string) =>
    patch((prev) => {
      const gone = new Set(prev.find((o) => o.key === optKey)?.values.map((v) => v.key) ?? []);
      return prev
        .filter((o) => o.key !== optKey)
        .map((o) => (o.depends_on_value_key && gone.has(o.depends_on_value_key) ? { ...o, depends_on_value_key: null } : o));
    });

  const move = (optKey: string, dir: -1 | 1) =>
    patch((prev) => {
      const i = prev.findIndex((o) => o.key === optKey);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  /* ── photo on a value: click / drop / paste, same behaviour as the
     Feature Highlights cards ── */
  const setImage = useCallback(async (optKey: string, valKey: string, file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    setError(null);
    const up = await uploadProductFile(file);
    if (!up?.url) { setError("Image upload failed — try again."); return; }
    patchVal(optKey, valKey, { image_url: up.url });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── save ── */
  const save = useCallback(async () => {
    if (!options) return;
    for (const o of options) {
      if (!o.title.trim()) { setError("Every question needs a title."); return; }
      for (const v of o.values) {
        if (!v.label.trim()) { setError(`"${o.title}": every answer needs a label.`); return; }
      }
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/product-options", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          options: options.map((o) => ({
            key: o.key,
            title: o.title, title_i18n: o.title_i18n, kind: o.kind,
            required: o.required, depends_on_value_key: o.depends_on_value_key,
            values: o.values.map((v) => ({
              key: v.key, label: v.label, label_i18n: v.label_i18n, image_url: v.image_url,
              linked_product_id: v.linked_product_id, linked_model_id: v.linked_model_id,
              price_delta_cny: v.price_delta_cny || null,
              weight_delta_kg: v.weight_delta_kg || null,
              cbm_delta: v.cbm_delta || null,
              is_default: v.is_default,
            })),
          })),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Save failed.");
      unsavedDrafts.delete(productId);
      setDirty(false);
      setSavedTick(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [options, productId]);

  /* ── copy from another product ── */
  const copyFrom = useCallback(async (sourceProductId: string) => {
    setCopyOpen(false);
    try {
      const res = await fetch(`/api/product-options?product_id=${sourceProductId}`, { cache: "no-store" });
      const json = (await res.json()) as { options?: Array<Record<string, unknown>> };
      const rows = json.options ?? [];
      if (!rows.length) { setError("That product has no options to copy."); return; }
      const valueKeyById = new Map<string, string>();
      const copied: Opt[] = rows.map((o) => {
        const values = ((o.values as Array<Record<string, unknown>>) ?? []).map((v) => {
          const key = freshKey();
          valueKeyById.set(v.id as string, key);
          return {
            key,
            label: (v.label as string) ?? "",
            label_i18n: (v.label_i18n as Record<string, string>) ?? {},
            image_url: (v.image_url as string) ?? null,
            linked_product_id: (v.linked_product_id as string) ?? null,
            linked_model_id: (v.linked_model_id as string) ?? null,
            linked_name: null,
            price_delta_cny: v.price_delta_cny == null ? "" : String(v.price_delta_cny),
            weight_delta_kg: v.weight_delta_kg == null ? "" : String(v.weight_delta_kg),
            cbm_delta: v.cbm_delta == null ? "" : String(v.cbm_delta),
            is_default: v.is_default === true,
          };
        });
        return {
          key: freshKey(),
          title: (o.title as string) ?? "",
          title_i18n: (o.title_i18n as Record<string, string>) ?? {},
          kind: (o.kind as Opt["kind"]) ?? "choice",
          required: o.required === true,
          depends_on_value_key: o.depends_on_value_id ? (valueKeyById.get(o.depends_on_value_id as string) ?? null) : null,
          values,
        };
      });
      patch((prev) => [...prev, ...copied]);
      const ids = [...new Set(copied.flatMap((o) => o.values.map((v) => v.linked_product_id).filter(Boolean)))] as string[];
      if (ids.length) void resolveLinkedNames(ids, setOptions);
    } catch {
      setError("Could not copy options.");
    }
  }, [patch]);

  /* Answers available for "show only when…" — every value of every EARLIER
     question (the API refuses forward references, so the picker never offers
     one). */
  const dependTargets = useMemo(() => {
    const out: { valKey: string; label: string }[] = [];
    for (const o of options ?? []) {
      for (const v of o.values) out.push({ valKey: v.key, label: `${o.title || "…"} → ${v.label || "…"}` });
    }
    return out;
  }, [options]);

  if (!productId) {
    return (
      <p className="text-[12px] text-[var(--text-dim)]">
        Save the product first — options attach to a saved product.
      </p>
    );
  }
  if (options === null) {
    return (
      <div className="flex items-center justify-center py-10 text-[var(--text-secondary)]">
        <SpinnerIcon size={22} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <p className="text-[11.5px] leading-relaxed text-[var(--text-muted)] flex-1 min-w-[260px]">
          The questions a buyer answers to configure this product. &ldquo;Which model&rdquo; and
          &ldquo;head only / complete set&rdquo; are NOT entered here — they come from the Variants
          tab and the product&rsquo;s own flags automatically. An answer linked to a product takes
          its price and weight from that product, live; manual ¥ / kg are for answers that are
          not products; an info question is recorded but never priced.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" onClick={() => setCopyOpen(true)}>Copy from product…</Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? "Saving…" : savedTick ? "Saved ✓" : "Save options"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-400">
          {error}
        </div>
      )}

      {options.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] px-6 py-10 text-center">
          <p className="text-[13px] font-medium text-[var(--text-primary)]">No options yet</p>
          <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
            This product sells as-is. Add a question below, or copy the set from a similar product.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {options.map((o, oi) => (
          <div key={o.key} className="kx-glass rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
            {/* ── question header ── */}
            <div className="flex flex-wrap items-center gap-2 px-3 pt-3">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--bg-surface)] font-mono text-[11px] text-[var(--text-secondary)]">
                {oi + 1}
              </span>
              <input
                value={o.title}
                onChange={(e) => patchOpt(o.key, { title: e.target.value })}
                placeholder='Question — e.g. "Stand thickness"'
                className={`${INPUT} flex-1 min-w-[180px] font-medium`}
              />
              <select
                value={o.kind}
                onChange={(e) => {
                  const kind = e.target.value as Opt["kind"];
                  patchOpt(o.key, {
                    kind,
                    values: kind === "yes_no"
                      ? [{ ...(o.values[0] ?? emptyValue()), label: o.values[0]?.label || "Yes" }]
                      : o.values,
                  });
                }}
                className={`${NUM} w-auto text-[12px]`}
              >
                {(Object.keys(KIND_LABEL) as Opt["kind"][]).map((k) => (
                  <option key={k} value={k}>{KIND_LABEL[k]}</option>
                ))}
              </select>
              <label className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--text-secondary)]">
                <input type="checkbox" checked={o.required} onChange={(e) => patchOpt(o.key, { required: e.target.checked })} />
                Required
              </label>
              <div className="ms-auto flex items-center gap-1">
                <button type="button" onClick={() => move(o.key, -1)} disabled={oi === 0}
                  className="rounded-md p-1.5 text-[var(--text-dim)] hover:text-[var(--text-primary)] disabled:opacity-30" title="Move up">↑</button>
                <button type="button" onClick={() => move(o.key, 1)} disabled={oi === options.length - 1}
                  className="rounded-md p-1.5 text-[var(--text-dim)] hover:text-[var(--text-primary)] disabled:opacity-30" title="Move down">↓</button>
                <button type="button" onClick={() => removeOption(o.key)}
                  className="rounded-md p-1.5 text-[var(--text-dim)] hover:text-red-400" title="Delete question">
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* ── show only when… ── */}
            <div className="flex flex-wrap items-center gap-2 px-3 pt-2">
              <span className="text-[11px] text-[var(--text-dim)]">Show only when</span>
              <select
                value={o.depends_on_value_key ?? ""}
                onChange={(e) => patchOpt(o.key, { depends_on_value_key: e.target.value || null })}
                className={`${NUM} w-auto text-[11.5px]`}
              >
                <option value="">— always shown —</option>
                {dependTargets
                  .filter((t) => !o.values.some((v) => v.key === t.valKey))
                  .map((t) => <option key={t.valKey} value={t.valKey}>{t.label}</option>)}
              </select>
            </div>

            {/* ── answers ── */}
            <div className="space-y-2 p-3">
              {o.values.map((v) => (
                /* One answer = one card: a REAL photo tile on the left (the
                   answers become visual cards in the buyer's chooser, so the
                   photo is first-class here, not a 36px afterthought — owner:
                   "the photo place is too small, I want it big"), and two
                   rows beside it: identity, then pricing. Paste lands a
                   screenshot straight in, same as the Feature Highlights
                   cards. */
                <div
                  key={v.key}
                  onPaste={(e) => {
                    const item = [...(e.clipboardData?.items ?? [])].find((it) => it.type.startsWith("image/"));
                    if (!item) return;
                    e.preventDefault();
                    void setImage(o.key, v.key, item.getAsFile());
                  }}
                  /* Column on phones: the 128px tile plus the input row cannot share
                     375px, and shrinking the photo defeats the owner's whole request —
                     so the photo sits ON TOP at full size and the rows follow. */
                  className="flex flex-col sm:flex-row gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/40 p-2.5"
                >
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => fileRefs.current[v.key]?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); void setImage(o.key, v.key, e.dataTransfer.files?.[0] ?? null); }}
                      className="h-32 w-32 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-gradient-to-b from-white to-[#f4f5f7] flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-[var(--border-strong)] transition-colors"
                      title="Click, drop or paste a photo"
                    >
                      {v.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.image_url} alt={v.label || "option"} className="h-full w-full object-cover" />
                      ) : (
                        <>
                          <ImageRawIcon className="h-9 w-9 text-gray-300" />
                          <span className="px-1 text-center text-[10px] leading-tight">Click · drop · paste</span>
                        </>
                      )}
                    </button>
                    {/* A wrong photo needs a way OUT, not only a way in — the
                        old chip could replace but never clear. */}
                    {v.image_url && (
                      <button
                        type="button"
                        onClick={() => patchVal(o.key, v.key, { image_url: null })}
                        title="Remove photo"
                        className="absolute -top-1.5 -end-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/25 bg-black/70 text-white/85 backdrop-blur-sm hover:bg-black/85 hover:text-red-400"
                      >
                        <CrossIcon size={9} />
                      </button>
                    )}
                  </div>
                  <input
                    ref={(el) => { fileRefs.current[v.key] = el; }}
                    type="file" accept="image/*" className="hidden" aria-hidden tabIndex={-1}
                    onChange={(e) => void setImage(o.key, v.key, e.target.files?.[0] ?? null)}
                  />

                  {/* justify-center: the tile is taller than the two content rows,
                      and top-hung rows leave the card visually bottom-empty. */}
                  <div className="min-w-0 flex-1 flex flex-col justify-center gap-2">
                    {/* row 1 — identity */}
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={v.label}
                        onChange={(e) => patchVal(o.key, v.key, { label: e.target.value })}
                        placeholder={o.kind === "yes_no" ? "Yes" : 'Answer — e.g. "2 mm"'}
                        className={`${INPUT} flex-1 min-w-[130px]`}
                      />
                      <label className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                        <input type="checkbox" checked={v.is_default}
                          onChange={(e) => patch((prev) => prev.map((po) =>
                            po.key !== o.key ? po : {
                              ...po,
                              /* one default per question */
                              values: po.values.map((pv) => ({ ...pv, is_default: pv.key === v.key ? e.target.checked : false })),
                            }))} />
                        default
                      </label>
                      {o.kind !== "yes_no" && (
                        <button type="button" onClick={() => removeValue(o.key, v.key)}
                          className="rounded-md p-1 text-[var(--text-dim)] hover:text-red-400" title="Delete answer">
                          <CrossIcon size={12} />
                        </button>
                      )}
                    </div>

                    {/* row 2 — what choosing it adds */}
                    <div className="flex flex-wrap items-center gap-2">
                      {v.linked_product_id ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-400">
                          linked · {v.linked_name ?? "product"}
                          <button type="button" title="Unlink"
                            onClick={() => patchVal(o.key, v.key, { linked_product_id: null, linked_model_id: null, linked_name: null })}
                            className="text-emerald-400/70 hover:text-emerald-300"><CrossIcon size={10} /></button>
                        </span>
                      ) : o.kind !== "info" ? (
                        <>
                          <button type="button" onClick={() => setLinkFor({ optKey: o.key, valKey: v.key })}
                            className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]">
                            Link product…
                          </button>
                          <input value={v.price_delta_cny} onChange={(e) => patchVal(o.key, v.key, { price_delta_cny: e.target.value })}
                            placeholder="+¥" className={`${NUM} w-20`} inputMode="decimal" />
                          <input value={v.weight_delta_kg} onChange={(e) => patchVal(o.key, v.key, { weight_delta_kg: e.target.value })}
                            placeholder="+kg" className={`${NUM} w-20`} inputMode="decimal" />
                          <input value={v.cbm_delta} onChange={(e) => patchVal(o.key, v.key, { cbm_delta: e.target.value })}
                            placeholder="+cbm" className={`${NUM} w-20`} inputMode="decimal" />
                        </>
                      ) : (
                        <span className="text-[11px] text-[var(--text-dim)]">recorded on the document — not priced</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {o.kind !== "yes_no" && (
                <button type="button"
                  onClick={() => patch((prev) => prev.map((po) => (po.key === o.key ? { ...po, values: [...po.values, emptyValue()] } : po)))}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-1.5 text-[11.5px] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]">
                  <PlusIcon className="h-3 w-3" /> Add answer
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(["choice", "yes_no", "info"] as const).map((k) => (
          <button key={k} type="button"
            onClick={() => patch((prev) => [...prev, emptyOption(k)])}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[12px] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition">
            <PlusIcon className="h-3.5 w-3.5" /> {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {copyOpen && <PickProductDialog title="Copy options from…" onClose={() => setCopyOpen(false)} onPick={(pid) => void copyFrom(pid)} excludeId={productId} requireOptions />}
      {linkFor && (
        <PickProductDialog
          title="Link a product"
          onClose={() => setLinkFor(null)}
          excludeId={productId}
          onPickModel={(pid, mid, name) => {
            patchVal(linkFor.optKey, linkFor.valKey, {
              linked_product_id: pid, linked_model_id: mid, linked_name: name,
              price_delta_cny: "", weight_delta_kg: "", cbm_delta: "",
            });
            setLinkFor(null);
          }}
        />
      )}
    </div>
  );
}

/* Fill in display names for linked products after load/copy. */
async function resolveLinkedNames(ids: string[], setOptions: React.Dispatch<React.SetStateAction<Opt[] | null>>) {
  try {
    const res = await fetch(`/api/quotations/catalog-search?q=&limit=2000`, { cache: "force-cache" });
    const json = (await res.json()) as { rows?: Array<{ product_id: string; product_name: string; model_id: string; model_name: string }> };
    const byProduct = new Map<string, string>();
    const byModel = new Map<string, string>();
    for (const r of json.rows ?? []) {
      if (!byProduct.has(r.product_id)) byProduct.set(r.product_id, r.product_name);
      byModel.set(r.model_id, `${r.product_name} · ${r.model_name}`);
    }
    setOptions((prev) => prev?.map((o) => ({
      ...o,
      values: o.values.map((v) => v.linked_product_id && !v.linked_name
        ? { ...v, linked_name: (v.linked_model_id && byModel.get(v.linked_model_id)) || byProduct.get(v.linked_product_id) || "product" }
        : v),
    })) ?? prev);
  } catch { /* names are cosmetic — the ids are what saves */ }
}

/* ── minimal product/model picker over catalog-search ─────────────────────── */
function PickProductDialog({
  title, onClose, onPick, onPickModel, excludeId, requireOptions,
}: {
  title: string;
  onClose: () => void;
  onPick?: (productId: string) => void;
  onPickModel?: (productId: string, modelId: string | null, name: string) => void;
  excludeId?: string;
  requireOptions?: boolean;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Array<{ product_id: string; product_name: string; model_id: string; model_name: string; image_url: string | null }> | null>(null);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/quotations/catalog-search?q=${encodeURIComponent(q)}&limit=${q ? 60 : 40}`, { cache: "no-store" });
        const json = (await res.json()) as { rows?: typeof rows };
        if (alive) setRows((json.rows ?? []).filter((r) => r!.product_id !== excludeId) as typeof rows);
      } catch { if (alive) setRows([]); }
    }, 200);
    return () => { alive = false; clearTimeout(t); };
  }, [q, excludeId]);

  /* For "copy from": one row per product. For "link": one row per model. */
  const products = useMemo(() => {
    const seen = new Map<string, { product_id: string; product_name: string; image_url: string | null; models: { model_id: string; model_name: string }[] }>();
    for (const r of rows ?? []) {
      const p = seen.get(r.product_id) ?? { product_id: r.product_id, product_name: r.product_name, image_url: r.image_url, models: [] };
      p.models.push({ model_id: r.model_id, model_name: r.model_name });
      seen.set(r.product_id, p);
    }
    return [...seen.values()];
  }, [rows]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)" }} onClick={onClose}>
      <div className="kx-pop-clear flex flex-col"
        style={{ maxWidth: 640, width: "100%", maxHeight: "80vh", borderRadius: 16, border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 pt-4 pb-3">
          <h2 className="min-w-0 flex-1 text-[14px] font-semibold text-[var(--text-primary)]">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]" aria-label="Close">
            <CrossIcon size={14} />
          </button>
        </div>
        <div className="relative px-5 pb-3">
          <SearchIcon className="pointer-events-none absolute start-8 top-1/2 h-3.5 w-3.5 -translate-y-[80%] text-[var(--text-dim)]" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…"
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-2 ps-9 pe-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {rows === null ? (
            <div className="flex justify-center py-8 text-[var(--text-secondary)]"><SpinnerIcon size={20} /></div>
          ) : products.length === 0 ? (
            <p className="py-8 text-center text-[12.5px] text-[var(--text-secondary)]">Nothing found.</p>
          ) : (
            <ul className="space-y-1.5">
              {products.map((p) => (
                <li key={p.product_id}>
                  {onPick ? (
                    <button type="button" onClick={() => onPick(p.product_id)}
                      className="flex w-full items-center gap-2.5 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-start hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]">
                      <Thumb url={p.image_url} />
                      <span className="truncate text-[12.5px] text-[var(--text-primary)]">{p.product_name}</span>
                    </button>
                  ) : (
                    <div className="rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <Thumb url={p.image_url} />
                        <span className="truncate text-[12.5px] font-medium text-[var(--text-primary)]">{p.product_name}</span>
                        {/* whole-product link: price follows the product's primary/default model */}
                        <button type="button" onClick={() => onPickModel?.(p.product_id, null, p.product_name)}
                          className="ms-auto shrink-0 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-[10.5px] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]">
                          Link product
                        </button>
                      </div>
                      {p.models.length > 1 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5 ps-9">
                          {p.models.map((m) => (
                            <button key={m.model_id} type="button"
                              onClick={() => onPickModel?.(p.product_id, m.model_id, `${p.product_name} · ${m.model_name}`)}
                              className="rounded-md border border-[var(--border-subtle)] px-2 py-0.5 text-[10.5px] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]">
                              {m.model_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {requireOptions && (
            <p className="mt-3 text-[11px] text-[var(--text-dim)]">
              Products without options simply add nothing — picking one tells you so.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Thumb({ url }: { url: string | null }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-8 w-8 shrink-0 rounded-md border border-[var(--border-subtle)] bg-white object-cover" />
  ) : (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[9px] text-[var(--text-dim)]">—</span>
  );
}
