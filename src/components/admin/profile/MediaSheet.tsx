"use client";

/* ---------------------------------------------------------------------------
   MediaSheet — the Media & Files tab of the product profile, editable in place.

   THE EDITOR'S MEDIA STEP, READ-ONLY UNTIL EDIT — its two cards:

     Media & Documents   the editor's eleven slots, every one shown filled or
                         empty (an empty "Packing Photos" is exactly what an
                         operator opens this page to discover). Each item: its
                         thumbnail, alt text, the model it belongs to. Edit:
                         add files to a slot, remove, reorder, edit alt text,
                         scope to a model.
     Product Documents   type · title · version · language · file, one row
                         per document; Edit adds, uploads, removes.

   Plus the three identity images (poster, brand mark, OG image) that live on
   the product row — shown here because they ARE photos, edited on Hero.

   Media saves item by item (POST new, PATCH changed, DELETE removed);
   documents replace the set.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import { IMG } from "@/lib/cdn";
import { uploadProductFile, createProductMedia, deleteProductMedia, saveProductDocuments, type ProductDocumentRow } from "@/lib/products-admin";
import { MEDIA_TYPES } from "../form-sections/MediaSection";
import KdsSelect from "@/components/kds/Select";
import BoundIcon from "@/components/common/BoundIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { Group, FieldRow, Blank, INP_B } from "./primitives";
import { useSheetEdit } from "./useSheetEdit";

type Row = Record<string, unknown>;
type Item = { _k: string; id?: string; type: string; url: string; file_path: string | null; file_name: string; alt_text: string; order: number; model_id: string | null; _file?: File };
type Doc = { _k: string; id?: string; doc_type: string; title: string; file_url: string; file_name: string; language: string; version: string; model_ids: string[] };
type Draft = { media: Item[]; documents: Doc[] };
type Card = "media" | "documents";

const DOC_TYPES: { value: string; label: string }[] = [
  { value: "user_manual", label: "User Manual" }, { value: "spare_parts_list", label: "Spare Parts List" }, { value: "exploded_view", label: "Exploded View" },
  { value: "wiring_diagram", label: "Wiring Diagram" }, { value: "installation_guide", label: "Installation Guide" }, { value: "brochure", label: "Brochure" },
  { value: "catalog", label: "Catalog" }, { value: "certificate", label: "Certificate" }, { value: "test_report", label: "Test Report" },
  { value: "packing_list", label: "Packing List" }, { value: "dimension_drawing", label: "Dimension Drawing" }, { value: "cad_3d", label: "3D CAD File" },
];
const LANGS = ["en", "zh", "ar"];
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const isImg = (url: string) => /\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(url);
const fileName = (url: string) => { try { return decodeURIComponent(url.split("?")[0].split("/").pop() || ""); } catch { return url; } };

export default function MediaSheet({
  product, media, documents, models, productId, t, motion, canEdit, onDirtyChange, onSaved, notSet, glyph,
}: {
  product: Row | undefined;
  media: Row[];
  documents: Row[];
  models: Row[];
  productId: string | undefined;
  t: (k: string, fb?: string) => string;
  motion: string;
  canEdit: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (u: { media?: Row[]; documents?: Row[] }) => void;
  notSet: string;
  glyph: (label: string) => React.ReactNode;
}) {
  const itemOf = (m: Row, i: number): Item => ({
    _k: str(m.id) || `n${i}`, id: str(m.id) || undefined, type: str(m.type), url: str(m.url), file_path: (m.file_path as string | null) ?? null,
    file_name: str(m.file_name) || fileName(str(m.url)), alt_text: str(m.alt_text), order: typeof m.order === "number" ? m.order : i, model_id: (m.model_id as string | null) || null,
  });
  const docOf = (d: Row, i: number): Doc => ({
    _k: str(d.id) || `d${i}`, id: str(d.id) || undefined, doc_type: str(d.doc_type) || "user_manual", title: str(d.title), file_url: str(d.file_url),
    file_name: str(d.file_name), language: str(d.language), version: str(d.version), model_ids: Array.isArray(d.model_ids) ? d.model_ids.map(String) : [],
  });
  const [busy, setBusy] = useState<string | null>(null);

  const sheet = useSheetEdit<Card, Draft>({
    t, onDirtyChange,
    makeDraft: () => ({ media: media.filter((m) => m.type !== "model_image").map(itemOf), documents: documents.map(docOf) }),
    valid: (c, d) => c !== "documents" || d.documents.every((x) => x.file_url.trim().length > 0),
    commit: async (card, d) => {
      if (!productId) return;
      const fail = () => new Error(t("pr.saveFailed", "Couldn't save — try again."));
      if (card === "media") {
        const before = new Map(media.filter((m) => m.type !== "model_image").map((m, i) => [str(m.id), itemOf(m, i)]));
        const keep = new Set(d.media.map((x) => x.id).filter(Boolean));
        for (const [id] of before) if (!keep.has(id)) { if (!(await deleteProductMedia(id))) throw fail(); }
        const out: Row[] = media.filter((m) => m.type === "model_image");
        for (const x of d.media) {
          if (!x.id) {
            if (!x._file) continue;
            const up = await uploadProductFile(x._file);
            if (!up) throw new Error(t("media.uploadFailed", "Couldn't upload {name}.").replace("{name}", x._file.name));
            const row = await createProductMedia({ product_id: productId, model_id: x.model_id, type: x.type, url: up.url, file_path: up.file_path, alt_text: x.alt_text.trim() || null, order: x.order });
            out.push((row as Row | null) ?? { type: x.type, url: up.url, file_path: up.file_path, alt_text: x.alt_text || null, order: x.order, model_id: x.model_id });
          } else {
            const b = before.get(x.id);
            const patch: Row = {};
            if (b && b.alt_text !== x.alt_text) patch.alt_text = x.alt_text.trim() || null;
            if (b && b.order !== x.order) patch.order = x.order;
            if (b && b.model_id !== x.model_id) patch.model_id = x.model_id;
            if (Object.keys(patch).length) {
              const res = await fetch(`/api/product-media/${x.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
              if (!res.ok) throw fail();
            }
            const orig = media.find((m) => str(m.id) === x.id) ?? {};
            out.push({ ...orig, ...patch });
          }
        }
        onSaved({ media: out });
      } else {
        const rows: ProductDocumentRow[] = d.documents.map((x, i) => ({
          doc_type: x.doc_type, title: x.title.trim() || null, file_url: x.file_url, file_name: x.file_name || null,
          language: x.language || null, version: x.version.trim() || null, model_ids: x.model_ids, sort_order: i,
        }));
        if (!(await saveProductDocuments(productId, rows))) throw fail();
        onSaved({ documents: rows as unknown as Row[] });
      }
    },
  });
  const d = sheet.draft;
  const eM = sheet.editing === "media";
  const eD = sheet.editing === "documents";
  const items: Item[] = eM && d ? d.media : media.filter((m) => m.type !== "model_image").map(itemOf);
  const docs: Doc[] = eD && d ? d.documents : documents.map(docOf);
  const modelName = (id: string | null) => { if (!id) return null; const m = models.find((x) => str(x.id) === id); return m ? (str(m.model_name) || str(m.primary_model)) : null; };
  const modelOpts = [{ value: "", label: t("md.wholeProduct", "Whole product") }, ...models.map((m) => ({ value: str(m.id), label: str(m.model_name) || str(m.primary_model) || "—" }))];

  const upd = (k: string, u: Partial<Item>) => sheet.patch((dd) => ({ ...dd, media: dd.media.map((x) => (x._k === k ? { ...x, ...u } : x)) }));
  const addFiles = (type: string, files: FileList | null, accept: string, maxMB: number, multiple: boolean) => {
    if (!files?.length) return;
    sheet.patch((dd) => {
      let next = [...dd.media];
      const existing = next.filter((x) => x.type === type);
      if (!multiple) next = next.filter((x) => x.type !== type);
      const picked = Array.from(files).slice(0, multiple ? 50 : 1);
      picked.forEach((f, i) => {
        if (f.size > maxMB * 1024 * 1024) { sheet.setError(t("md.tooBig", "{name} is over {mb} MB.").replace("{name}", f.name).replace("{mb}", String(maxMB))); return; }
        next.push({ _k: crypto.randomUUID(), type, url: URL.createObjectURL(f), file_path: null, file_name: f.name, alt_text: "", order: (multiple ? existing.length : 0) + i, model_id: null, _file: f });
      });
      void accept;
      return { ...dd, media: next };
    });
  };
  const move = (k: string, dir: -1 | 1) => sheet.patch((dd) => {
    const item = dd.media.find((x) => x._k === k); if (!item) return dd;
    const slot = dd.media.filter((x) => x.type === item.type).sort((a, b) => a.order - b.order);
    const i = slot.findIndex((x) => x._k === k); const j = i + dir;
    if (j < 0 || j >= slot.length) return dd;
    const a = slot[i], b = slot[j];
    return { ...dd, media: dd.media.map((x) => (x._k === a._k ? { ...x, order: b.order } : x._k === b._k ? { ...x, order: a.order } : x)) };
  });
  const updDoc = (k: string, u: Partial<Doc>) => sheet.patch((dd) => ({ ...dd, documents: dd.documents.map((x) => (x._k === k ? { ...x, ...u } : x)) }));
  const uploadDoc = async (k: string, file: File | undefined) => {
    if (!file) return;
    setBusy(k);
    try { const up = await uploadProductFile(file); if (up?.url) updDoc(k, { file_url: up.url, file_name: file.name }); }
    finally { setBusy(null); }
  };

  const small = `${INP_B} h-8 text-[12px] w-full`;
  const tile = (x: Item) => (
    <div key={x._k} className={`rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 ${eM ? "w-full sm:w-[calc(50%-4px)] lg:w-[calc(33.333%-6px)]" : "w-[132px]"}`}>
      <a href={x._file ? undefined : (x.url || undefined)} target="_blank" rel="noreferrer" className={`block ${eM ? "h-24" : "h-20"} w-full rounded-md overflow-hidden bg-white border border-[var(--border-subtle)] flex items-center justify-center`}>
        {isImg(x.url) || x._file?.type.startsWith("image/") ? <img src={x._file ? x.url : IMG.thumb(x.url)} alt={x.alt_text} className="h-full w-full object-contain p-0.5" /> : <span className="text-[9.5px] text-gray-500 px-1.5 text-center break-all leading-tight">{x.file_name || fileName(x.url)}</span>}
      </a>
      {eM ? (
        <div className="mt-1.5 space-y-1">
          <input value={x.alt_text} placeholder={t("md.altText", "Alt text / caption")} onChange={(ev) => upd(x._k, { alt_text: ev.target.value })} className={`${small} font-normal`} />
          {models.length > 1 && <KdsSelect value={x.model_id ?? ""} onChange={(v) => upd(x._k, { model_id: v || null })} options={modelOpts} triggerClassName={`${small} pe-8 text-start`} />}
          <div className="flex items-center gap-0.5 justify-end">
            <button type="button" aria-label={t("mv.moveUp", "Move up")} onClick={() => move(x._k, -1)} className="h-6 w-6 inline-flex items-center justify-center rounded text-[var(--text-ghost)] hover:text-[var(--text-primary)]"><AngleDownIcon className="h-3 w-3 rotate-180" /></button>
            <button type="button" aria-label={t("mv.moveDown", "Move down")} onClick={() => move(x._k, 1)} className="h-6 w-6 inline-flex items-center justify-center rounded text-[var(--text-ghost)] hover:text-[var(--text-primary)]"><AngleDownIcon className="h-3 w-3" /></button>
            <button type="button" aria-label={t("media.remove", "Remove")} onClick={() => sheet.patch((dd) => ({ ...dd, media: dd.media.filter((y) => y._k !== x._k) }))} className="h-6 w-6 inline-flex items-center justify-center rounded text-[var(--text-ghost)] hover:text-rose-300"><CrossIcon className="h-3 w-3" /></button>
          </div>
        </div>
      ) : (
        (x.alt_text || x.model_id) ? <div className="mt-1 text-[10px] text-[var(--text-muted)] leading-tight truncate" title={x.alt_text}>{x.alt_text || ""}{x.model_id ? <span className="block text-[var(--text-ghost)]">{modelName(x.model_id) ?? "—"}</span> : null}</div> : null
      )}
    </div>
  );

  return (
    <div className="space-y-4" onKeyDown={sheet.onKeyDown}>
      {/* ── Media & Documents — the eleven slots ─────────────────────── */}
      <Group motion={motion} icon={<BoundIcon semanticKey="field.photos" className="h-4 w-4" fallback={<ImageRawIcon className="h-4 w-4" />} />} title={t("media.filesTitle", "Media & Documents")} count={`${items.length} ${t("md.filesWord", "files")}`} {...sheet.gp("media", canEdit)}>
        <div className="space-y-4">
          {MEDIA_TYPES.map((slot) => {
            const slotItems = items.filter((x) => x.type === slot.type).sort((a, b) => a.order - b.order);
            const label = t(`media.slot.${slot.type}.label`, slot.label);
            return (
              <div key={slot.type}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)]">{label}</span>
                  <span className="text-[10px] text-[var(--text-ghost)]">{slotItems.length}{slot.multiple ? "" : " / 1"}</span>
                  {eM && (
                    <label className="ms-auto inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-dashed border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                      <PlusIcon className="h-3 w-3" /> {slot.multiple ? t("md.addFiles", "Add files") : (slotItems.length ? t("models.photoReplace", "Replace") : t("media.upload", "Upload"))}
                      <input type="file" accept={slot.accept} multiple={slot.multiple} className="hidden" onChange={(ev) => { addFiles(slot.type, ev.target.files, slot.accept, slot.maxSizeMB, slot.multiple); ev.target.value = ""; }} />
                    </label>
                  )}
                </div>
                {slotItems.length === 0
                  ? <span className="text-[12px] text-[var(--text-ghost)] italic">{notSet}</span>
                  : <div className="flex flex-wrap gap-2">{slotItems.map(tile)}</div>}
              </div>
            );
          })}
        </div>
        {/* Identity images live on the product row — photos too, edited on Hero. */}
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
          <div className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-ghost)] mb-2">{t("md.identityImages", "Identity images")} <span className="font-normal normal-case tracking-normal">· {t("md.onHero", "edited on the Hero tab")}</span></div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {([["hero_poster_url", t("pp.f.heroPoster", "Hero poster")], ["brand_mark_url", t("pp.f.brandMark", "Brand mark")], ["og_image_url", t("hs.ogImage", "Social share image (OG)")]] as const).map(([key, lbl]) => {
              const url = str(product?.[key]);
              return (
                <FieldRow key={key} label={lbl} glyph={glyph(lbl)}
                  value={url ? <a href={url} target="_blank" rel="noreferrer" className="block h-20 w-full max-w-[200px] rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-white"><img src={IMG.thumb(url)} alt="" className="h-full w-full object-contain p-0.5" /></a> : <Blank label={notSet} />} />
              );
            })}
          </div>
        </div>
      </Group>

      {/* ── Product Documents ─────────────────────────────────────────── */}
      <Group motion={motion} icon={<DocumentIcon className="h-4 w-4" />} title={t("documents.title", "Product Documents")} count={String(docs.length)} {...sheet.gp("documents", canEdit)}>
        {docs.length === 0 && !eD ? (
          <p className="text-[12px] text-[var(--text-ghost)] italic">{t("md.noDocs", "No documents recorded.")}</p>
        ) : (
          <div className="space-y-2">
            {docs.map((x) => (
              <div key={x._k} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5">
                {eD ? (
                  <div className="grid grid-cols-2 md:grid-cols-[170px_1fr_100px_110px_auto] gap-2 items-end">
                    <div><span className="block text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-ghost)] mb-1">{t("md.type", "Type")}</span><KdsSelect value={x.doc_type} onChange={(v) => updDoc(x._k, { doc_type: v })} options={DOC_TYPES.map((o) => ({ value: o.value, label: t(`md.dt.${o.value}`, o.label) }))} triggerClassName={`${small} pe-8 text-start`} /></div>
                    <div><span className="block text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-ghost)] mb-1">{t("md.title", "Title")}</span><input value={x.title} placeholder="e.g. XSL-9500 Operation Manual" onChange={(ev) => updDoc(x._k, { title: ev.target.value })} className={small} /></div>
                    <div><span className="block text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-ghost)] mb-1">{t("md.version", "Version")}</span><input value={x.version} placeholder="v2.1" onChange={(ev) => updDoc(x._k, { version: ev.target.value })} className={small} /></div>
                    <div><span className="block text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-ghost)] mb-1">{t("md.language", "Language")}</span><KdsSelect value={x.language} onChange={(v) => updDoc(x._k, { language: v })} options={[{ value: "", label: "—" }, ...LANGS.map((l) => ({ value: l, label: l.toUpperCase() }))]} triggerClassName={`${small} pe-8 text-start`} /></div>
                    <div className="flex items-center gap-1.5 col-span-2 md:col-span-1">
                      <label className="h-8 px-2.5 inline-flex items-center rounded-lg border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap">
                        {busy === x._k ? <SpinnerIcon className="h-3 w-3" /> : x.file_url ? t("models.photoReplace", "Replace") : t("media.upload", "Upload")}
                        <input type="file" className="hidden" onChange={(ev) => void uploadDoc(x._k, ev.target.files?.[0])} />
                      </label>
                      <button type="button" aria-label={t("cc.remove", "Remove")} onClick={() => sheet.patch((dd) => ({ ...dd, documents: dd.documents.filter((y) => y._k !== x._k) }))} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-rose-300"><CrossIcon className="h-3 w-3" /></button>
                    </div>
                    {x.file_url ? <a href={x.file_url} target="_blank" rel="noreferrer" className="col-span-full text-[11px] text-[var(--accent,#0066FF)] hover:underline truncate">{x.file_name || fileName(x.file_url)}</a> : <span className="col-span-full text-[11px] text-amber-400/90">{t("md.needsFile", "Upload the file to keep this document.")}</span>}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 min-w-0 text-[12.5px]">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] shrink-0">{t(`md.dt.${x.doc_type}`, DOC_TYPES.find((o) => o.value === x.doc_type)?.label ?? x.doc_type)}</span>
                    <a href={x.file_url} target="_blank" rel="noreferrer" className="text-[var(--text-primary)] hover:underline truncate">{x.title || x.file_name || fileName(x.file_url) || "—"}</a>
                    <span className="flex-1" />
                    {x.version && <span className="text-[11px] font-mono text-[var(--text-muted)] shrink-0">{x.version}</span>}
                    {x.language && <span className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-ghost)] shrink-0">{x.language.toUpperCase()}</span>}
                    {x.model_ids.length > 0 && <span className="text-[10px] text-[var(--text-ghost)] shrink-0">{x.model_ids.map(modelName).filter(Boolean).join(", ")}</span>}
                  </div>
                )}
              </div>
            ))}
            {eD && (
              <button type="button" onClick={() => sheet.patch((dd) => ({ ...dd, documents: [...dd.documents, { _k: crypto.randomUUID(), doc_type: "user_manual", title: "", file_url: "", file_name: "", language: "", version: "", model_ids: [] }] }))}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-dashed border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"><PlusIcon className="h-3 w-3" /> {t("md.addDoc", "Add document")}</button>
            )}
          </div>
        )}
      </Group>
    </div>
  );
}
