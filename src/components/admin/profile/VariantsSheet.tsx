"use client";

/* ---------------------------------------------------------------------------
   VariantsSheet — the Variants tab of the product profile, editable in place.

   THE EDITOR'S VARIANTS STEP, READ-ONLY UNTIL EDIT — its two cards:

     Purchase Options    head-only / complete-set purchase flags (product row)
     Models & Variants   one card per model: photo · name · slug · KOLEEX code ·
                         supplier reference · tagline · status · stock ·
                         visible · barcode, and the TECHNICAL DIFFERENCES —
                         the spec keys where this model departs from the
                         product's specifications (everything else inherits).

   Edit keeps the layout; models can be added, reordered and removed. Save
   PATCHes each changed model with its optimistic lock, POSTs new ones,
   DELETEs removed ones, and moves a model's photo through product_media.
   Prices live on the Price tab, packing on Packing & Logistics.
   --------------------------------------------------------------------------- */

import { IMG } from "@/lib/cdn";
import { updateProduct, updateModel, createModel, deleteModel, uploadProductFile, createProductMedia, deleteProductMedia } from "@/lib/products-admin";
import { slugify } from "@/types/product-form";
import KdsSelect from "@/components/kds/Select";
import Toggle from "@/components/kds/Toggle";
import BoundIcon from "@/components/common/BoundIcon";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import ShoppingCartIcon from "@/components/icons/ui/ShoppingCartIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import { Group, FieldRow, Blank, YesNo, INP_B } from "./primitives";
import { useSheetEdit } from "./useSheetEdit";

type Row = Record<string, unknown>;
type SpecField = { key: string; label: string; unit: string | null; fieldType: string; options: Array<{ value: string; label: string }> };
type ModelD = {
  _k: string; id?: string; updated_at: string | null; _photoFile: File | null; _photoPreview: string | null; _photoRemoved: boolean;
  model_name: string; slug: string; primary_model: string; reference_model: string; tagline: string;
  status: string; stock_status: string; visible: boolean; barcode: string; order: number;
  specs_overrides: Record<string, unknown>;
};
type Draft = { supports_head_only: boolean; supports_complete_set: boolean; models: ModelD[] };
type Card = "purchase" | "models";

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default function VariantsSheet({
  product, models, media, schemaGroups, productId, t, motion, canEdit, onDirtyChange, onSaved, notSet, glyph,
}: {
  product: Row | undefined;
  models: Row[];
  media: Row[];
  schemaGroups: Array<{ fields?: Array<Row & { key: string; label?: string; unit?: string }> }>;
  productId: string | undefined;
  t: (k: string, fb?: string) => string;
  motion: string;
  canEdit: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (u: { product?: Row; reload?: boolean }) => void;
  notSet: string;
  glyph: (label: string) => React.ReactNode;
}) {
  /* The spec keys a model may override — the editor's own filter. */
  const specFields: SpecField[] = schemaGroups.flatMap((g) => (g.fields ?? [])
    .filter((f) => !["file", "image", "long_text"].includes(str(f.fieldType)))
    .map((f) => ({ key: f.key, label: str(f.label) || f.key, unit: f.unit ? String(f.unit) : null, fieldType: str(f.fieldType), options: Array.isArray(f.options) ? (f.options as Array<{ value: string; label: string }>) : [] })));
  const fieldByKey = new Map(specFields.map((f) => [f.key, f]));
  const productSpecs = (product?.schema_specs as Record<string, unknown> | null) ?? {};
  const photoOf = (id: string) => str(media.find((m) => m.type === "model_image" && str(m.model_id) === id)?.url) || null;
  const modelOf = (m: Row, i: number): ModelD => ({
    _k: str(m.id) || `n${i}`, id: str(m.id) || undefined, updated_at: (m.updated_at as string | null) ?? null, _photoFile: null, _photoPreview: null, _photoRemoved: false,
    model_name: str(m.model_name), slug: str(m.slug), primary_model: str(m.primary_model), reference_model: str(m.reference_model), tagline: str(m.tagline),
    status: str(m.status) || "active", stock_status: str(m.stock_status), visible: m.visible !== false, barcode: str(m.barcode),
    order: typeof m.order === "number" ? m.order : i,
    specs_overrides: (m.specs_overrides as Record<string, unknown> | null) ?? {},
  });

  const sheet = useSheetEdit<Card, Draft>({
    t, onDirtyChange,
    makeDraft: () => ({ supports_head_only: !!product?.supports_head_only, supports_complete_set: !!product?.supports_complete_set, models: models.map(modelOf) }),
    valid: (c, d) => c !== "models" || (d.models.length > 0 && d.models.every((m) => m.model_name.trim().length > 0)),
    commit: async (card, d) => {
      if (!productId) return;
      if (card === "purchase") {
        const patch = { supports_head_only: d.supports_head_only, supports_complete_set: d.supports_complete_set };
        await updateProduct(productId, patch);
        onSaved({ product: patch });
        return;
      }
      const fail = (conflict?: boolean) => new Error(conflict ? t("pr.conflict", "This variant was changed by someone else — reload and try again.") : t("pr.saveFailed", "Couldn't save — try again."));
      /* Removed models first, then changed, then new — order is renumbered. */
      const keepIds = new Set(d.models.map((m) => m.id).filter(Boolean));
      for (const m of models) if (m.id && !keepIds.has(str(m.id))) { if (!(await deleteModel(str(m.id)))) throw fail(); }
      for (let i = 0; i < d.models.length; i++) {
        const m = d.models[i];
        const body: Row = {
          model_name: m.model_name.trim(), slug: m.slug.trim() || slugify(m.model_name), primary_model: m.primary_model.trim().toUpperCase() || null,
          reference_model: m.reference_model.trim() || null, tagline: m.tagline.trim() || null, status: m.status || "active",
          stock_status: m.stock_status || null, visible: m.visible, barcode: m.barcode.trim() || null, order: i,
          specs_overrides: Object.fromEntries(Object.entries(m.specs_overrides).filter(([, v]) => v !== "" && v !== null && v !== undefined)),
        };
        let id = m.id;
        if (!id) {
          const created = await createModel({ ...body, product_id: productId });
          if (!created?.id) throw fail();
          id = String(created.id);
        } else {
          const before = modelOf(models.find((x) => str(x.id) === id) ?? {}, i);
          const changed = JSON.stringify({ ...before, _k: "", updated_at: null }) !== JSON.stringify({ ...m, _k: "", updated_at: null, _photoFile: null, _photoPreview: null, _photoRemoved: false });
          if (changed) {
            const r = await updateModel(id, { ...body, _expected_updated_at: m.updated_at });
            if (!r.ok) throw fail(r.conflict);
          }
        }
        if (m._photoFile || m._photoRemoved) {
          const old = media.filter((x) => x.type === "model_image" && str(x.model_id) === id);
          if (m._photoFile) {
            const up = await uploadProductFile(m._photoFile);
            if (!up) throw new Error(t("media.uploadFailed", "Couldn't upload {name}.").replace("{name}", m._photoFile.name));
            await createProductMedia({ product_id: productId, model_id: id, type: "model_image", url: up.url, file_path: up.file_path, alt_text: null, order: 0 });
          }
          for (const o of old) if (o.id) await deleteProductMedia(str(o.id));
        }
      }
      onSaved({ reload: true });
    },
  });
  const d = sheet.draft;
  const eP = sheet.editing === "purchase";
  const eM = sheet.editing === "models";
  const rows: ModelD[] = eM && d ? d.models : models.map(modelOf);
  const upd = (k: string, u: Partial<ModelD>) => sheet.patch((dd) => ({ ...dd, models: dd.models.map((m) => (m._k === k ? { ...m, ...u } : m)) }));
  const move = (k: string, dir: -1 | 1) => sheet.patch((dd) => {
    const i = dd.models.findIndex((m) => m._k === k); const j = i + dir;
    if (i < 0 || j < 0 || j >= dd.models.length) return dd;
    const next = [...dd.models]; [next[i], next[j]] = [next[j], next[i]];
    return { ...dd, models: next.map((m, idx) => ({ ...m, order: idx })) };
  });

  const yes = t("pp.yes", "Yes"); const no = t("pp.no", "No");
  const grid = "grid grid-cols-1 sm:grid-cols-2 gap-x-8 [&>*]:border-b [&>*]:border-[var(--border-subtle)] [&>*:last-child]:border-b-0";
  const inp = `${INP_B} w-full`;
  const sel = `${INP_B} w-full pe-8 text-start`;
  const tob = (x: string, mono?: boolean) => (x ? <span className={mono ? "font-mono text-[12.5px] font-medium" : ""}>{x}</span> : <Blank label={notSet} />);
  const statusOpts = [{ value: "active", label: t("mv.stActive", "Active") }, { value: "discontinued", label: t("mv.stDiscontinued", "Discontinued") }];
  const stockOpts = [{ value: "in_stock", label: t("mv.ssInStock", "In stock") }, { value: "made_to_order", label: t("mv.ssMto", "Made to order") }, { value: "pre_order", label: t("mv.ssPreOrder", "Pre-order") }, { value: "sold_out", label: t("mv.ssSoldOut", "Sold out") }];
  const labelOf = (o: { value: string; label: string }[], v: string) => o.find((x) => x.value === v)?.label ?? v;
  const fmtVal = (v: unknown, f?: SpecField) => {
    if (v === null || v === undefined || v === "") return "—";
    const s = Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? yes : no) : String(v);
    const lbl = f?.options.find((o) => o.value === s)?.label ?? s;
    return f?.unit ? `${lbl} ${f.unit}` : lbl;
  };

  return (
    <div className="space-y-4" onKeyDown={sheet.onKeyDown}>
      {/* ── Purchase Options ──────────────────────────────────────────── */}
      <Group motion={motion} icon={<ShoppingCartIcon className="h-4 w-4" />} title={t("technical.purchaseOptions", "Purchase Options")} count={t("technical.purchaseBadge", "Head-only · Complete set")} {...sheet.gp("purchase", canEdit)}>
        <p className="mb-2 text-[11px] text-[var(--text-ghost)]">{t("technical.purchaseHint", "Which configurations can customers actually order for this product.")}</p>
        <div className={grid}>
          <FieldRow label={t("technical.supportsHeadOnly", "Supports head-only purchase")} glyph={glyph(t("pp.f.headPrice", "Head-only price"))}
            value={<YesNo v={eP && d ? d.supports_head_only : !!product?.supports_head_only} yes={yes} no={no} />}
            input={eP && d ? <Toggle checked={d.supports_head_only} onChange={(v) => sheet.patch({ supports_head_only: v })} /> : undefined} />
          <FieldRow label={t("technical.supportsCompleteSet", "Supports complete set purchase")} glyph={glyph(t("pp.f.setPrice", "Complete-set price"))}
            value={<YesNo v={eP && d ? d.supports_complete_set : !!product?.supports_complete_set} yes={yes} no={no} />}
            input={eP && d ? <Toggle checked={d.supports_complete_set} onChange={(v) => sheet.patch({ supports_complete_set: v })} /> : undefined} />
        </div>
      </Group>

      {/* ── Models & Variants ─────────────────────────────────────────── */}
      <Group motion={motion} icon={<BoundIcon semanticKey="field.family" className="h-4 w-4" fallback={<BoxesIcon className="h-4 w-4" />} />} title={t("pp.sec.variants", "Variants")} count={String(rows.length)} {...sheet.gp("models", canEdit)}>
        {rows.length === 0 && !eM ? (
          <p className="text-[12px] text-[var(--text-ghost)] italic">{t("pp.e.noVariant", "No variant recorded — a product needs at least one.")}</p>
        ) : (
          <div className="space-y-3">
            {rows.map((m, i) => {
              const photo = m._photoRemoved ? null : (m._photoPreview ?? (m.id ? photoOf(m.id) : null));
              const entries = Object.entries(m.specs_overrides);
              return (
                <div key={m._k} className="rounded-xl border border-[var(--border-subtle)] p-3 sm:p-4">
                  <div className="flex items-center gap-2.5 mb-3 min-w-0">
                    <label className={`h-11 w-11 shrink-0 rounded-lg bg-white border border-[var(--border-subtle)] overflow-hidden flex items-center justify-center ${eM ? "cursor-pointer hover:border-[var(--border-focus)]" : ""}`} title={eM ? t("models.photoReplace", "Replace") : undefined}>
                      {photo ? <img src={m._photoPreview ? photo : IMG.thumb(photo)} alt="" className="h-full w-full object-contain p-0.5" /> : <BoxesIcon className="h-4 w-4 text-gray-400" />}
                      {eM && <input type="file" accept="image/*" className="hidden" onChange={(ev) => { const f = ev.target.files?.[0]; if (!f) return; if (!/^image\//.test(f.type)) { sheet.setError(t("media.mainNotImage", "{name} is not an image.").replace("{name}", f.name)); return; } upd(m._k, { _photoFile: f, _photoPreview: URL.createObjectURL(f), _photoRemoved: false }); }} />}
                    </label>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-[var(--text-primary)] truncate">{m.model_name || t("mv.untitled", "Untitled Variant")}</span>
                      <span className="block text-[10.5px] text-[var(--text-ghost)]">{photo ? t("models.photoOwn", "This model shows its own photo.") : t("models.photoInherits", "No photo — this model inherits the family's main photo.")}{eM && photo ? <> · <button type="button" onClick={() => upd(m._k, { _photoFile: null, _photoPreview: null, _photoRemoved: true })} className="underline hover:text-rose-300">{t("models.photoRemove", "Remove")}</button></> : null}</span>
                    </span>
                    <span className="text-[11px] font-mono text-[var(--text-dim)] shrink-0">{m.primary_model || "—"}</span>
                    {i === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)] shrink-0">{t("pp.primary", "Primary")}</span>}
                    <span className="flex-1" />
                    {eM && (
                      <span className="inline-flex items-center gap-0.5 shrink-0">
                        <button type="button" aria-label={t("mv.moveUp", "Move up")} disabled={i === 0} onClick={() => move(m._k, -1)} className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-[var(--text-primary)] disabled:opacity-30"><AngleDownIcon className="h-3.5 w-3.5 rotate-180" /></button>
                        <button type="button" aria-label={t("mv.moveDown", "Move down")} disabled={i === rows.length - 1} onClick={() => move(m._k, 1)} className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-[var(--text-primary)] disabled:opacity-30"><AngleDownIcon className="h-3.5 w-3.5" /></button>
                        <button type="button" aria-label={t("vs.remove", "Remove variant")} disabled={rows.length <= 1} onClick={() => sheet.patch((dd) => ({ ...dd, models: dd.models.filter((x) => x._k !== m._k).map((x, idx) => ({ ...x, order: idx })) }))} className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-rose-300 disabled:opacity-30"><CrossIcon className="h-3.5 w-3.5" /></button>
                      </span>
                    )}
                  </div>
                  <div className={grid}>
                    <FieldRow label={t("mv.variantName", "Variant Name")} glyph={glyph(t("pp.f.variantName", "Variant name"))} value={tob(m.model_name)}
                      input={eM ? <input value={m.model_name} onChange={(ev) => upd(m._k, { model_name: ev.target.value, ...(m.id ? {} : { slug: slugify(ev.target.value) }) })} className={inp} /> : undefined} />
                    <FieldRow label={t("mv.slugSku", "Slug / SKU")} glyph={glyph(t("pp.f.sku", "Internal SKU"))} value={tob(m.slug, true)}
                      input={eM ? <input value={m.slug} onChange={(ev) => upd(m._k, { slug: slugify(ev.target.value) })} className={`${inp} font-mono`} /> : undefined} />
                    <FieldRow label={t("pp.f.koleexCode", "KOLEEX code")} glyph={glyph(t("pp.f.koleexCode", "KOLEEX code"))} value={tob(m.primary_model, true)}
                      help={i === 0 ? t("vs.codeOnHero", "The primary model's code is checked and approved on the Hero tab.") : undefined}
                      input={eM && i !== 0 ? <input value={m.primary_model} onChange={(ev) => upd(m._k, { primary_model: ev.target.value.toUpperCase().replace(/\s+/g, "") })} className={`${inp} font-mono`} /> : undefined} />
                    <FieldRow label={t("mv.supplierRef", "Supplier Reference Model")} glyph={glyph(t("pp.f.supRef", "Supplier reference"))} value={tob(m.reference_model, true)}
                      input={eM ? <input value={m.reference_model} placeholder={t("mv.phFactoryCode", "e.g. Factory model code")} onChange={(ev) => upd(m._k, { reference_model: ev.target.value })} className={`${inp} font-mono`} /> : undefined} />
                    <FieldRow label={t("mv.tagline", "Tagline")} glyph={glyph(t("pp.f.tagline", "Tagline"))} wide value={tob(m.tagline)}
                      input={eM ? <input value={m.tagline} placeholder={t("mv.phTagline", "Short sub-title shown under the model name")} onChange={(ev) => upd(m._k, { tagline: ev.target.value })} className={inp} /> : undefined} />
                    <FieldRow label={t("mv.status", "Status")} glyph={glyph(t("pp.f.status", "Status"))} value={labelOf(statusOpts, m.status)}
                      input={eM ? <KdsSelect value={m.status} onChange={(v) => upd(m._k, { status: v })} options={statusOpts} triggerClassName={sel} /> : undefined} />
                    <FieldRow label={t("mv.stockStatus", "Stock Status")} glyph={glyph(t("pp.f.stock", "Stock status"))} value={m.stock_status ? labelOf(stockOpts, m.stock_status) : <Blank label={notSet} />}
                      input={eM ? <KdsSelect value={m.stock_status} onChange={(v) => upd(m._k, { stock_status: v })} options={stockOpts} placeholder={notSet} triggerClassName={sel} /> : undefined} />
                    <FieldRow label={t("pp.f.visible", "Visible")} glyph={glyph(t("pp.f.visible", "Visible to customers"))} value={<YesNo v={m.visible} yes={yes} no={no} />}
                      input={eM ? <Toggle checked={m.visible} onChange={(v) => upd(m._k, { visible: v })} /> : undefined} />
                    <FieldRow label={t("mv.barcodeOverride", "Barcode Override")} glyph={glyph(t("pp.f.barcode", "Barcode"))} value={tob(m.barcode, true)}
                      help={t("mv.phBarcode", "Leave empty = auto from SKU")}
                      input={eM ? <input value={m.barcode} placeholder={t("mv.phBarcode", "Leave empty = auto from SKU")} onChange={(ev) => upd(m._k, { barcode: ev.target.value })} className={`${inp} font-mono`} /> : undefined} />
                  </div>

                  {/* Technical differences vs product specs */}
                  <div className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 p-2.5">
                    <div className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--text-ghost)] mb-1.5">{t("pp.f.techDiff", "Technical differences vs product specs")}</div>
                    {entries.length === 0 && !eM ? (
                      <p className="text-[11px] text-[var(--text-ghost)] italic">{t("pp.f.inheritsSpecs", "Inherits all product specifications — no per-model differences recorded yet.")}</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                        {entries.map(([k, v]) => {
                          const f = fieldByKey.get(k);
                          const fam = fmtVal(productSpecs[k], f);
                          return (
                            <div key={k} className="flex items-center justify-between gap-3 text-[12px]">
                              <span className="min-w-0">
                                <span className="block text-[var(--text-dim)] truncate">{f?.label ?? k}</span>
                                <span className="block text-[10px] text-[var(--text-ghost)]">{t("models.familyValue", "Family")}: {fam}</span>
                              </span>
                              {eM ? (
                                <span className="flex items-center gap-1 shrink-0">
                                  {f && f.fieldType === "select" && f.options.length ? (
                                    <KdsSelect value={str(v)} onChange={(nv) => upd(m._k, { specs_overrides: { ...m.specs_overrides, [k]: nv } })} options={f.options} placeholder="—" triggerClassName={`${INP_B} h-8 text-[12px] pe-8 text-start w-[170px]`} />
                                  ) : f && f.fieldType === "boolean" ? (
                                    <KdsSelect value={v === true || v === "true" ? "true" : v === false || v === "false" ? "false" : ""} onChange={(nv) => upd(m._k, { specs_overrides: { ...m.specs_overrides, [k]: nv === "true" } })} options={[{ value: "true", label: yes }, { value: "false", label: no }]} placeholder="—" triggerClassName={`${INP_B} h-8 text-[12px] pe-8 text-start w-[120px]`} />
                                  ) : (
                                    <input value={Array.isArray(v) ? v.join(", ") : str(v)} onChange={(ev) => upd(m._k, { specs_overrides: { ...m.specs_overrides, [k]: ev.target.value } })} className={`${INP_B} h-8 text-[12px] w-[170px] tabular-nums`} />
                                  )}
                                  {f?.unit && <span className="text-[10px] text-[var(--text-ghost)]">{f.unit}</span>}
                                  <button type="button" aria-label={t("cc.remove", "Remove")} onClick={() => { const next = { ...m.specs_overrides }; delete next[k]; upd(m._k, { specs_overrides: next }); }} className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-rose-300"><CrossIcon className="h-3 w-3" /></button>
                                </span>
                              ) : (
                                <span className="text-[var(--text-primary)] font-medium tabular-nums text-end">{fmtVal(v, f)}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {eM && specFields.some((sf) => !(sf.key in m.specs_overrides)) && (
                      <div className="mt-2">
                        <KdsSelect value="" onChange={(k) => { if (k) upd(m._k, { specs_overrides: { ...m.specs_overrides, [k]: "" } }); }}
                          options={specFields.filter((sf) => !(sf.key in m.specs_overrides)).map((sf) => ({ value: sf.key, label: `${sf.label}${fmtVal(productSpecs[sf.key], sf) !== "—" ? ` — ${t("models.familyValue", "Family")}: ${fmtVal(productSpecs[sf.key], sf)}` : ""}` }))}
                          placeholder={t("vs.addOverride", "+ Add a spec that differs on this model…")} triggerClassName={`${INP_B} h-8 text-[11px] pe-8 text-start w-full sm:w-auto sm:min-w-[320px]`} />
                      </div>
                    )}
                  </div>
                  {!eM && <p className="mt-2 text-[10.5px] text-[var(--text-ghost)]">{t("vs.elsewhere", "Prices on the Price tab · packing on Packing & Logistics.")}</p>}
                </div>
              );
            })}
            {eM && (
              <button type="button" onClick={() => sheet.patch((dd) => ({ ...dd, models: [...dd.models, { ...modelOf({}, dd.models.length), _k: crypto.randomUUID(), order: dd.models.length }] }))}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-dashed border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]">
                <PlusIcon className="h-3 w-3" /> {t("mv.addWhenMultiple", "Add a variant when this product has multiple versions")}
              </button>
            )}
          </div>
        )}
      </Group>
    </div>
  );
}
