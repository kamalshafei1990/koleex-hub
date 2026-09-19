"use client";

/* ---------------------------------------------------------------------------
   HeroSheet — the Hero tab of the product profile, editable in place.

   THE EDITOR'S HERO TAB, READ-ONLY UNTIL EDIT — its cards, in its order:

     Poster                 the hero banner
     Identity & lifecycle   main photo · status · visibility · flagship ·
                            market tier (with the policy's suggestion) ·
                            name · KOLEEX code (checked live) · legacy code ·
                            public URL (checked live) · brand · tagline ·
                            short description (AI drafts)
     Auto-generated codes   barcode + QR                          (CALCULATED)
     Description            the full description (rich text)
     Key highlights         up to five (AI drafts)
     Tags & keywords        (AI drafts)
     Identifiers            manufacturer · MPN · GTIN · internal SKU ·
                            generation · model year · launch / end of life ·
                            available from · last order · status reason ·
                            brand mark · revision history · alternate names
     Search & Social        meta title · meta description · OG image
     Languages & markets    per locale: name · tagline · short description ·
                            description, with Auto-translate

   Every row stays a row and the value becomes the control. The product row
   PATCHes; the primary variant PATCHes for the code and tagline; the main
   photo goes through product_media; translations upsert per locale.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { IMG } from "@/lib/cdn";
import {
  updateProduct, updateModel, uploadProductFile, createProductMedia, deleteProductMedia,
  upsertTranslation, deleteTranslation, fetchUniqueBrands, fetchBrandLogos,
} from "@/lib/products-admin";
import { validatePrimaryModel } from "@/lib/product-coding";
import { LOCALES, slugify } from "@/types/product-form";

import KdsSelect from "@/components/kds/Select";
import Toggle from "@/components/kds/Toggle";
import BoundIcon from "@/components/common/BoundIcon";
import { HighlightsEditor, TagsInput } from "../form-sections/ListEditors";
import { Group, FieldRow, Blank, YesNo, Seg, Chips, CalcBadge, INP_B, TA } from "./primitives";
import { useSheetEdit } from "./useSheetEdit";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import ScanLineIcon from "@/components/icons/ui/ScanLineIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import CheckSquareIcon from "@/components/icons/ui/CheckSquareIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import HashtagIcon from "@/components/icons/ui/HashtagIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/* ⚠️ BOTH OF THESE LOAD ON DEMAND, AND THAT IS NOT AN OPTIMISATION DETAIL.
   BarcodeQRDisplay pulls jsbarcode + qrcode — it was deliberately lazified in
   the editor (2026-08-02) and importing it statically here quietly undid that
   for everyone who merely OPENS a product. RichTextEditor is 750 lines that
   only matter once someone presses Edit. The record is read far more often
   than it is written; nothing that only serves editing may sit in the paint
   path. */
const RichTextEditor = dynamic(() => import("../form-sections/RichTextEditor"), {
  ssr: false,
  loading: () => <div className="h-[220px] rounded-xl border border-dashed border-[var(--border-subtle)] animate-pulse" />,
});
const BarcodeQRDisplay = dynamic(() => import("../form-sections/BarcodeQRDisplay"), { ssr: false, loading: () => null });

type Row = Record<string, unknown>;
type Card = "poster" | "identity" | "description" | "highlights" | "tags" | "identifiers" | "seo" | "languages";
type Rev = { version: string; date: string; note: string };
type Tr = { _k: string; id?: string; locale: string; product_name: string; tagline: string; excerpt: string; description: string };
type Draft = {
  hero_poster_url: string;
  mainFile: File | null; mainPreview: string | null;
  status: string; visible: boolean; featured: boolean; level: string; product_name: string;
  primary_model: string; legacy_code: string; slug: string; brand: string; tagline: string; excerpt: string;
  description: string; highlights: string[]; tags: string[];
  manufacturer: string; mpn: string; gtin: string; internal_sku: string; generation: string; model_year: string;
  launch_date: string; eol_date: string; available_from: string; last_order_date: string; status_reason: string;
  brand_mark_url: string; revision_history: Rev[]; alternate_names: string[];
  meta_title: string; meta_description: string; og_image_url: string;
  translations: Tr[];
};
type Check = { status: "idle" | "checking" | "available" | "taken" | "error"; conflict?: { product_name?: string; primary_model?: string; slug?: string } };

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const day = (v: unknown) => (v ? str(v).slice(0, 10) : "");
/* D/M/Y everywhere on the Hub. */
const fmtDay = (v: unknown) => { const s = day(v); if (!s) return ""; const [y, m, d] = s.split("-"); return d && m && y ? `${d}/${m}/${y}` : s; };

export default function HeroSheet({
  product, models, media, translations, suppliers, subcategoryCode, productId, t, lang, motion, canEdit, onDirtyChange, onSaved, notSet, glyph, aiContext,
}: {
  product: Row | undefined;
  models: Row[];
  media: Row[];
  translations: Row[];
  suppliers: Row[];
  subcategoryCode: string | null;
  productId: string | undefined;
  t: (k: string, fb?: string) => string;
  lang: string;
  motion: string;
  canEdit: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (u: { product?: Row; models?: Record<string, Row>; media?: Row[]; translations?: Row[] }) => void;
  notSet: string;
  glyph: (label: string) => React.ReactNode;
  aiContext: Record<string, unknown>;
}) {
  const primary = models[0];
  const mainMedia = media.find((m) => m.type === "main_image");
  const trOf = (r: Row, i: number): Tr => ({
    _k: str(r.id) || `n${i}`, id: str(r.id) || undefined, locale: str(r.locale), product_name: str(r.product_name),
    tagline: str(r.tagline), excerpt: str(r.excerpt), description: str(r.description),
  });
  const revOf = (v: unknown): Rev[] => (Array.isArray(v) ? v.map((r) => ({ version: str((r as Row).version), date: day((r as Row).date), note: str((r as Row).note) })) : []);

  const [codeCheck, setCodeCheck] = useState<Check>({ status: "idle" });
  const [slugCheck, setSlugCheck] = useState<Check>({ status: "idle" });
  const [tier, setTier] = useState<{ tier: string; levelName: string } | null>(null);
  const [brands, setBrands] = useState<{ names: string[]; logos: Record<string, string> } | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiMsg, setAiMsg] = useState<{ field: string; kind: "ok" | "error"; text: string } | null>(null);
  const [trBusy, setTrBusy] = useState<string | null>(null);
  const [trMsg, setTrMsg] = useState<{ locale: string; kind: "ok" | "error"; text: string } | null>(null);
  const [addLocale, setAddLocale] = useState("ar");
  const [uploading, setUploading] = useState<string | null>(null);

  const sheet = useSheetEdit<Card, Draft>({
    t, onDirtyChange,
    makeDraft: () => ({
      hero_poster_url: str(product?.hero_poster_url),
      mainFile: null, mainPreview: null,
      status: str(product?.status) || "draft", visible: !!product?.visible, featured: !!product?.featured, level: str(product?.level),
      product_name: str(product?.product_name), primary_model: str(primary?.primary_model), legacy_code: str(product?.legacy_code),
      slug: str(product?.slug), brand: str(product?.brand), tagline: str(primary?.tagline), excerpt: str(product?.excerpt),
      description: str(product?.description), highlights: arr(product?.highlights), tags: arr(product?.tags),
      manufacturer: str(product?.manufacturer), mpn: str(product?.mpn), gtin: str(product?.gtin), internal_sku: str(product?.internal_sku),
      generation: str(product?.generation), model_year: str(product?.model_year), launch_date: day(product?.launch_date), eol_date: day(product?.eol_date),
      available_from: day(product?.available_from), last_order_date: day(product?.last_order_date), status_reason: str(product?.status_reason),
      brand_mark_url: str(product?.brand_mark_url), revision_history: revOf(product?.revision_history), alternate_names: arr(product?.alternate_names),
      meta_title: str(product?.meta_title), meta_description: str(product?.meta_description), og_image_url: str(product?.og_image_url),
      translations: translations.map(trOf),
    }),
    valid: (card, d) => {
      if (card !== "identity") return true;
      if (!d.product_name.trim()) return false;
      if (d.primary_model.trim() && !validatePrimaryModel(d.primary_model, subcategoryCode).ok) return false;
      if (codeCheck.status === "taken" || slugCheck.status === "taken") return false;
      return true;
    },
    commit: async (card, d) => {
      if (!productId) return;
      const out: { product?: Row; models?: Record<string, Row>; media?: Row[]; translations?: Row[] } = {};
      const patchProduct = async (patch: Row) => { if (Object.keys(patch).length) { await updateProduct(productId, patch); out.product = patch; } };
      switch (card) {
        case "poster":
          await patchProduct({ hero_poster_url: d.hero_poster_url.trim() || null });
          break;
        case "identity": {
          await patchProduct({
            status: d.status, visible: d.visible, featured: d.featured, level: d.level || null,
            product_name: d.product_name.trim(), legacy_code: d.legacy_code.trim() || null,
            slug: d.slug.trim() || null, brand: d.brand.trim() || null, excerpt: d.excerpt.trim() || null,
          });
          if (primary) {
            const mp: Row = {};
            const code = d.primary_model.trim().toUpperCase();
            if (code !== str(primary.primary_model)) { mp.primary_model = code || null; mp.coding_status = "edited"; if (subcategoryCode) mp.code_prefix = subcategoryCode; }
            if (d.tagline !== str(primary.tagline)) mp.tagline = d.tagline.trim() || null;
            if (Object.keys(mp).length) {
              const r = await updateModel(str(primary.id), { ...mp, _expected_updated_at: primary.updated_at ?? null });
              if (!r.ok) throw new Error(r.conflict ? t("pr.conflict", "This variant was changed by someone else — reload and try again.") : t("pr.saveFailed", "Couldn't save — try again."));
              out.models = { [str(primary.id)]: { ...mp, updated_at: r.updated_at ?? primary.updated_at } };
            }
          }
          if (d.mainFile) {
            const up = await uploadProductFile(d.mainFile);
            if (!up) throw new Error(t("media.uploadFailed", "Couldn't upload {name}.").replace("{name}", d.mainFile.name));
            const row = await createProductMedia({ product_id: productId, model_id: null, type: "main_image", url: up.url, file_path: up.file_path, alt_text: null, order: 0 });
            for (const m of media) if (m.type === "main_image" && m.id) await deleteProductMedia(str(m.id));
            out.media = [...media.filter((m) => m.type !== "main_image"), (row as Row | null) ?? { type: "main_image", url: up.url, file_path: up.file_path, order: 0 }];
          }
          break;
        }
        case "description":
          await patchProduct({ description: d.description.trim() || null });
          break;
        case "highlights":
          await patchProduct({ highlights: d.highlights.map((x) => x.trim()).filter(Boolean).slice(0, 5) });
          break;
        case "tags":
          await patchProduct({ tags: d.tags.map((x) => x.trim()).filter(Boolean) });
          break;
        case "identifiers":
          await patchProduct({
            manufacturer: d.manufacturer.trim() || null, mpn: d.mpn.trim() || null, gtin: d.gtin.trim() || null,
            internal_sku: d.internal_sku.trim() || null, generation: d.generation.trim() || null,
            model_year: d.model_year.trim() ? parseInt(d.model_year, 10) : null,
            launch_date: d.launch_date || null, eol_date: d.eol_date || null, available_from: d.available_from || null,
            last_order_date: d.last_order_date || null, status_reason: d.status_reason.trim() || null,
            brand_mark_url: d.brand_mark_url.trim() || null,
            revision_history: d.revision_history.filter((r) => r.version.trim() || r.date || r.note.trim()),
            alternate_names: d.alternate_names.map((x) => x.trim()).filter(Boolean),
          });
          break;
        case "seo":
          await patchProduct({ meta_title: d.meta_title.trim() || null, meta_description: d.meta_description.trim() || null, og_image_url: d.og_image_url.trim() || null });
          break;
        case "languages": {
          const keep = d.translations.filter((x) => x.product_name.trim() || x.tagline.trim() || x.excerpt.trim() || x.description.trim());
          const keepIds = new Set(keep.map((x) => x.id).filter(Boolean));
          for (const r of translations) if (r.id && !keepIds.has(str(r.id))) await deleteTranslation(str(r.id));
          for (const x of keep) {
            const ok = await upsertTranslation({
              product_id: productId, locale: x.locale, product_name: x.product_name.trim() || str(product?.product_name),
              tagline: x.tagline.trim() || null, excerpt: x.excerpt.trim() || null, description: x.description.trim() || null,
            });
            if (!ok) throw new Error(t("pr.saveFailed", "Couldn't save — try again."));
          }
          out.translations = keep.map((x) => ({ id: x.id, product_id: productId, locale: x.locale, product_name: x.product_name, tagline: x.tagline || null, excerpt: x.excerpt || null, description: x.description || null }));
          break;
        }
      }
      onSaved(out);
    },
  });
  const d = sheet.draft;
  const E = (c: Card) => sheet.editing === c;
  const eI = E("identity");
  /* Read the draft while its card is open, the row otherwise. */
  const p = (k: keyof Draft, card: Card): unknown => (E(card) && d ? d[k] : product?.[k as string]);
  const s = (k: keyof Draft, card: Card) => str(p(k, card));

  /* ── Live checks and lookups while the identity card is open ── */
  useEffect(() => {
    if (!eI || brands) return;
    let alive = true;
    Promise.all([fetchUniqueBrands(), fetchBrandLogos()]).then(([names, logos]) => { if (alive) setBrands({ names, logos }); }).catch(() => {});
    return () => { alive = false; };
  }, [eI, brands]);
  const codeDraft = eI && d ? d.primary_model.trim() : "";
  useEffect(() => {
    if (!eI) { setCodeCheck({ status: "idle" }); return; }
    if (!codeDraft || codeDraft.toUpperCase() === str(primary?.primary_model).toUpperCase() || !validatePrimaryModel(codeDraft, subcategoryCode).ok) { setCodeCheck({ status: "idle" }); return; }
    let cancelled = false;
    setCodeCheck({ status: "checking" });
    const id = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ code: codeDraft });
        if (productId) params.set("excludeProductId", productId);
        const res = await fetch(`/api/products/check-primary-model?${params}`, { credentials: "include" });
        if (cancelled) return;
        if (!res.ok) { setCodeCheck({ status: "error" }); return; }
        const j = await res.json();
        setCodeCheck(j?.available === false && j?.conflict ? { status: "taken", conflict: j.conflict } : { status: "available" });
      } catch { if (!cancelled) setCodeCheck({ status: "error" }); }
    }, 350);
    return () => { cancelled = true; clearTimeout(id); };
  }, [eI, codeDraft, primary?.primary_model, productId, subcategoryCode]);
  const slugDraft = eI && d ? d.slug.trim().toLowerCase() : "";
  useEffect(() => {
    if (!eI || !slugDraft || slugDraft === str(product?.slug).toLowerCase()) { setSlugCheck({ status: "idle" }); return; }
    let cancelled = false;
    setSlugCheck({ status: "checking" });
    const id = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ slug: slugDraft });
        if (productId) params.set("excludeProductId", productId);
        const res = await fetch(`/api/products/check-slug?${params}`, { credentials: "include" });
        if (cancelled) return;
        if (!res.ok) { setSlugCheck({ status: "error" }); return; }
        const j = await res.json();
        setSlugCheck(j?.available === false && j?.conflict ? { status: "taken", conflict: j.conflict } : { status: "available" });
      } catch { if (!cancelled) setSlugCheck({ status: "error" }); }
    }, 350);
    return () => { cancelled = true; clearTimeout(id); };
  }, [eI, slugDraft, product?.slug, productId]);
  /* The policy's tier for this cost — the editor's own suggestion. */
  const link = (suppliers.find((x) => x.is_primary) ?? suppliers[0]) as Row | undefined;
  const tierCost = Number(link?.unit_cost_cny ?? primary?.cost_price ?? NaN);
  useEffect(() => {
    if (!eI || !Number.isFinite(tierCost) || tierCost <= 0) { setTier(null); return; }
    let cancelled = false;
    const LEVEL_TO_TIER: Record<string, string> = { L1: "entry", L2: "mid", L3: "premium", L4: "enterprise" };
    fetch(`/api/products/price-preview?cost_cny=${encodeURIComponent(String(tierCost))}&qty=1`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { base?: { productLevelCode?: string; productLevelName?: string } } | null) => {
        if (cancelled) return;
        const code = j?.base?.productLevelCode; const tr = code ? LEVEL_TO_TIER[code] : undefined;
        setTier(tr ? { tier: tr, levelName: j?.base?.productLevelName || code || "" } : null);
      }).catch(() => {});
    return () => { cancelled = true; };
  }, [eI, tierCost]);

  /* AI drafts — the editor's own endpoint and rules: fill the box, never save. */
  const aiSuggest = async (field: "tagline" | "excerpt" | "highlights" | "tags") => {
    if (aiBusy) return;
    setAiBusy(field); setAiMsg(null);
    try {
      const res = await fetch("/api/ai/product-copy", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ field, context: aiContext }) });
      const data = (await res.json()) as { value?: string; values?: string[]; reason?: string; fallback?: boolean };
      if (!res.ok || data.fallback || (!data.value && !data.values)) {
        setAiMsg({ field, kind: "error", text: data.reason === "no_provider" ? t("ai.noProvider", "AI is off — no provider configured.") : t("ai.failed", "Couldn't draft right now — try again.") });
        return;
      }
      if (field === "tagline" && data.value) sheet.patch({ tagline: data.value.slice(0, 80) });
      if (field === "excerpt" && data.value) sheet.patch({ excerpt: data.value });
      if (field === "highlights" && data.values) sheet.patch({ highlights: data.values.slice(0, 5) });
      if (field === "tags" && data.values) sheet.patch((dd) => { const merged = [...dd.tags]; for (const tag of data.values!) if (!merged.some((x) => x.toLowerCase() === tag.toLowerCase())) merged.push(tag); return { ...dd, tags: merged }; });
      setAiMsg({ field, kind: "ok", text: t("ai.done", "Drafted — review before saving.") });
    } catch {
      setAiMsg({ field, kind: "error", text: t("ai.failed", "Couldn't draft right now — try again.") });
    } finally { setAiBusy(null); }
  };
  const aiButton = (field: "tagline" | "excerpt" | "highlights" | "tags") => (
    <button type="button" onClick={() => void aiSuggest(field)} disabled={!!aiBusy}
      className="kx-ai-glow inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[10.5px] font-bold text-[var(--accent,#0066FF)] border border-[var(--accent,#0066FF)]/30 disabled:opacity-50">
      {aiBusy === field ? <SpinnerIcon className="h-3 w-3" /> : <SparklesIcon className="h-3 w-3" />} {aiBusy === field ? t("ai.generating", "Drafting…") : t("ai.suggest", "AI Suggest")}
    </button>
  );
  const aiText = (field: string) => (aiMsg && aiMsg.field === field ? aiMsg.text : undefined);
  const aiNote = (field: string) => aiMsg && aiMsg.field === field ? <p className={`mt-1 text-[11px] ${aiMsg.kind === "error" ? "text-[var(--state-warning,#FFCC00)]" : "text-[var(--text-muted)]"}`}>{aiMsg.text}</p> : null;

  /* Translate one locale's four fields from English — zh + ar only, as the service allows. */
  const translateRow = async (k: string) => {
    if (!d || trBusy) return;
    const row = d.translations.find((x) => x._k === k); if (!row) return;
    setTrBusy(k); setTrMsg(null);
    try {
      const src: Array<[keyof Tr, string]> = [["product_name", str(product?.product_name)], ["tagline", str(primary?.tagline)], ["excerpt", str(product?.excerpt)], ["description", str(product?.description)]];
      const got: Partial<Tr> = {};
      for (const [field, text] of src) {
        if (!text.trim()) continue;
        const res = await fetch("/api/ai/translate", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ text, target_lang: row.locale, source_lang: "en" }) });
        const j = (await res.json()) as { translated?: string; fallback?: boolean; reason?: string };
        if (!res.ok || j.fallback || !j.translated) {
          setTrMsg({ locale: k, kind: "error", text: j.reason === "no_provider" ? t("ai.noProvider", "AI is off — no provider configured.") : t("hero.translateUnsupported", "Auto-translate covers Chinese and Arabic — type this one by hand.") });
          return;
        }
        (got as Record<string, string>)[field] = j.translated;
      }
      sheet.patch((dd) => ({ ...dd, translations: dd.translations.map((x) => (x._k === k ? { ...x, ...got } : x)) }));
      setTrMsg({ locale: k, kind: "ok", text: t("ai.done", "Drafted — review before saving.") });
    } catch {
      setTrMsg({ locale: k, kind: "error", text: t("ai.failed", "Couldn't draft right now — try again.") });
    } finally { setTrBusy(null); }
  };
  const localeDisplay = (code: string) => {
    try { return new Intl.DisplayNames([lang === "zh" ? "zh" : lang === "ar" ? "ar" : "en"], { type: "language" }).of(code) || code; }
    catch { return LOCALES.find((l) => l.code === code)?.name || code; }
  };

  /* Image fields: paste a URL or pick a file — uploaded at once, the URL lands in the draft. */
  const pickImage = async (files: FileList | null, key: "hero_poster_url" | "brand_mark_url" | "og_image_url") => {
    const file = files?.[0]; if (!file) return;
    if (!/^image\//.test(file.type)) { sheet.setError(t("media.mainNotImage", "{name} is not an image.").replace("{name}", file.name)); return; }
    setUploading(key);
    try { const up = await uploadProductFile(file); if (up?.url) sheet.patch({ [key]: up.url } as Partial<Draft>); }
    finally { setUploading(null); }
  };
  const imageField = (key: "hero_poster_url" | "brand_mark_url" | "og_image_url", card: Card, label: string, big?: boolean) => {
    const url = s(key, card);
    const view = url
      ? <a href={url} target="_blank" rel="noreferrer" className={`block ${big ? "h-40 w-full" : "h-20 w-20"} rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-white`}><img src={IMG.thumb(url)} alt="" className="h-full w-full object-contain p-0.5" /></a>
      : <Blank label={notSet} />;
    const edit = E(card) && d ? (
      <div className="flex items-center gap-2 flex-wrap">
        {url ? <span className="h-12 w-12 shrink-0 rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-white"><img src={IMG.thumb(url)} alt="" className="h-full w-full object-contain p-0.5" /></span> : null}
        <input value={url} onChange={(e) => sheet.patch({ [key]: e.target.value } as Partial<Draft>)} placeholder={t("idf.brandMarkPh", "Paste image URL…")} className={`${INP_B} flex-1 min-w-[160px] font-normal text-[12px]`} />
        <label className="h-9 px-3 inline-flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
          {uploading === key ? t("media.uploading", "Uploading…") : t("media.upload", "Upload")}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => void pickImage(e.target.files, key)} />
        </label>
        {url && <button type="button" onClick={() => sheet.patch({ [key]: "" } as Partial<Draft>)} className="text-[11px] text-[var(--text-ghost)] hover:text-rose-300">{t("media.remove", "Remove")}</button>}
      </div>
    ) : undefined;
    return <FieldRow label={label} glyph={glyph(label)} value={view} input={edit} wide={big} />;
  };

  const yes = t("pp.yes", "Yes"); const no = t("pp.no", "No");
  const grid = "grid grid-cols-1 sm:grid-cols-2 gap-x-8 [&>*]:border-b [&>*]:border-[var(--border-subtle)] [&>*:last-child]:border-b-0";
  const inp = (k: keyof Draft, opts?: { placeholder?: string; mono?: boolean; date?: boolean; numeric?: boolean; onChange?: (v: string) => void }) => (
    <input
      type={opts?.date ? "date" : "text"}
      value={str(d?.[k])}
      inputMode={opts?.numeric ? "numeric" : undefined}
      onChange={(e) => (opts?.onChange ? opts.onChange(e.target.value) : sheet.patch({ [k]: opts?.numeric ? e.target.value.replace(/[^0-9]/g, "") : e.target.value } as Partial<Draft>))}
      placeholder={opts?.placeholder}
      className={`${INP_B} w-full ${opts?.mono ? "font-mono" : ""}`}
    />
  );
  const tob = (x: string, mono?: boolean) => (x ? <span className={mono ? "font-mono text-[12.5px] font-medium" : ""}>{x}</span> : <Blank label={notSet} />);
  const statusOpts = [
    { v: "draft", label: t("status.draft", "Draft"), on: "border-[var(--state-warning,#FFCC00)]/50 bg-[var(--state-warning,#FFCC00)]/15 text-[var(--state-warning,#FFCC00)]" },
    { v: "active", label: t("status.active", "Active"), on: "border-[var(--state-success,#00CC66)]/50 bg-[var(--state-success,#00CC66)]/15 text-[var(--state-success,#00CC66)]" },
    { v: "archived", label: t("status.archived", "Archived"), on: "border-[var(--state-error,#FF3333)]/50 bg-[var(--state-error,#FF3333)]/15 text-[var(--state-error,#FF3333)]" },
  ];
  const levelOpts = [
    { v: "entry", label: t("hero.levelEntry", "Entry"), on: "bg-slate-400/15 text-slate-300 border-slate-400/40" },
    { v: "mid", label: t("hero.levelMid", "Mid"), on: "bg-[#567FB2]/15 text-[#BCD8F0] border-[#567FB2]/50" },
    { v: "premium", label: t("hero.levelPremium", "Premium"), on: "bg-violet-500/15 text-violet-300 border-violet-500/45" },
    { v: "enterprise", label: t("hero.levelEnterprise", "Enterprise"), on: "bg-amber-500/15 text-amber-300 border-amber-500/50" },
  ];
  const levelLabel = (v: string) => levelOpts.find((o) => o.v === v)?.label ?? v;
  const status = s("status", "identity") || "draft";
  const level = s("level", "identity");
  const codeStatus = str(primary?.coding_status);
  const code = eI && d ? d.primary_model : str(primary?.primary_model);
  const codeV = code ? validatePrimaryModel(code, subcategoryCode) : { ok: true, reason: "" };
  const heroUrl = eI && d?.mainPreview ? d.mainPreview : (str(mainMedia?.url) || null);
  const trs: Tr[] = E("languages") && d ? d.translations : translations.map(trOf);
  const usedLocales = new Set(trs.map((x) => x.locale));
  const freeLocales = LOCALES.filter((l) => !usedLocales.has(l.code));
  const addPick = usedLocales.has(addLocale) ? (freeLocales[0]?.code ?? addLocale) : addLocale;
  const updTr = (k: string, u: Partial<Tr>) => sheet.patch((dd) => ({ ...dd, translations: dd.translations.map((x) => (x._k === k ? { ...x, ...u } : x)) }));
  const descHtml = s("description", "description");

  return (
    <div className="space-y-4" onKeyDown={sheet.onKeyDown}>
      {/* ── Poster ─────────────────────────────────────────────────────── */}
      <Group motion={motion} icon={<ImageRawIcon className="h-4 w-4" />} title={t("identity.posterTitle", "Product poster / hero banner")} count={t("hs.posterBadge", "Public page")} {...sheet.gp("poster", canEdit)}>
        <div className="divide-y divide-[var(--border-subtle)]">
          {imageField("hero_poster_url", "poster", t("pp.f.heroPoster", "Hero poster"), true)}
        </div>
      </Group>

      {/* ── Identity & lifecycle ───────────────────────────────────────── */}
      <Group motion={motion} icon={<BoundIcon semanticKey="section.hero" className="h-4 w-4" fallback={<SparklesIcon className="h-4 w-4" />} />} title={t("pp.sec.identity", "Identity & lifecycle")} count={t("hs.identityBadge", "Status · Name · Code")} {...sheet.gp("identity", canEdit)}>
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-[var(--text-ghost)] mb-2">{t("media.slot.main_image.label", "Main Product Photo")}</div>
            <label className={`block aspect-square w-full rounded-2xl border border-black/10 bg-gradient-to-b from-white to-[#f4f5f7] overflow-hidden ${eI ? "cursor-pointer hover:border-[var(--border-focus)]" : ""} flex items-center justify-center`}>
              {heroUrl ? <img src={d?.mainPreview ? heroUrl : IMG.card(heroUrl)} alt="" className="h-full w-full object-contain p-2" /> : <span className="text-[12px] text-gray-400 italic">{notSet}</span>}
              {eI && <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; if (!/^image\//.test(f.type)) { sheet.setError(t("media.mainNotImage", "{name} is not an image.").replace("{name}", f.name)); return; } sheet.patch({ mainFile: f, mainPreview: URL.createObjectURL(f) }); }} />}
            </label>
            {eI && <p className="mt-1.5 text-[10.5px] text-[var(--text-ghost)]">{t("hs.mainPhotoHint", "Click the photo to replace it — the gallery and the other slots are on the Media tab.")}</p>}
          </div>
          <div className={grid}>
            <FieldRow label={t("hero.statusLabel", "Status")} glyph={glyph(t("pp.f.status", "Status"))}
              value={<span className={`${statusOpts.find((o) => o.v === status)?.on ?? ""} inline-flex h-6 items-center px-2 rounded-md border text-[10.5px] font-bold uppercase tracking-wider`}>{statusOpts.find((o) => o.v === status)?.label ?? status}</span>}
              input={eI && d ? <Seg value={d.status} options={statusOpts} onChange={(v) => sheet.patch({ status: v })} /> : undefined} />
            <FieldRow label={t("hero.marketTier", "Market tier")} glyph={glyph(t("pp.f.level", "Level"))}
              value={level ? <span className={`${levelOpts.find((o) => o.v === level)?.on ?? ""} inline-flex h-6 items-center px-2 rounded-md border text-[10.5px] font-bold uppercase tracking-wider`}>{levelLabel(level)}</span> : <Blank label={notSet} />}
              help={eI && tier ? (tier.tier === level ? t("hs.tierAuto", "Matches the policy's tier for this cost.") : t("hero.tierUseSuggested", "Policy says {tier}").replace("{tier}", levelLabel(tier.tier))) : undefined}
              badge={eI && tier && tier.tier !== level ? <button type="button" onClick={() => sheet.patch({ level: tier.tier })} className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-400 hover:bg-amber-500/10">{t("hs.useTier", "Use it")}</button> : undefined}
              input={eI && d ? <Seg value={d.level} options={levelOpts} onChange={(v) => sheet.patch({ level: v })} allowClear /> : undefined} />
            <FieldRow label={t("pp.f.visible", "Visible to customers")} glyph={glyph(t("pp.f.visible", "Visible to customers"))}
              value={<YesNo v={!!p("visible", "identity")} yes={t("hero.visible", "Visible")} no={t("hero.hidden", "Hidden")} />}
              input={eI && d ? <Toggle checked={d.visible} onChange={(v) => sheet.patch({ visible: v })} /> : undefined} />
            <FieldRow label={t("pp.f.featured", "Featured")} glyph={glyph(t("pp.f.featured", "Featured"))} help={t("hero.featuredOnHome", "Flagship product — shown on the homepage")}
              value={<YesNo v={!!p("featured", "identity")} yes={yes} no={no} />}
              input={eI && d ? <Toggle checked={d.featured} onChange={(v) => sheet.patch({ featured: v })} /> : undefined} />
            <FieldRow label={t("pp.f.productName", "Product name")} glyph={glyph(t("pp.f.productName", "Product name"))} wide
              value={tob(s("product_name", "identity"))} input={eI ? inp("product_name") : undefined} />
            <FieldRow label={t("pp.f.koleexCode", "KOLEEX code")} glyph={glyph(t("pp.f.koleexCode", "KOLEEX code"))}
              badge={codeStatus ? <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${codeStatus === "approved" || codeStatus === "locked" ? "border-emerald-500/30 text-emerald-400/90" : "border-[var(--border-subtle)] text-[var(--text-ghost)]"}`}>{t(`hs.code.${codeStatus}`, codeStatus.replace("_", " "))}</span> : undefined}
              value={tob(str(primary?.primary_model), true)}
              help={eI
                ? (!codeV.ok ? codeV.reason
                  : codeCheck.status === "taken" ? `${t("model.codeInUseInline", "Code already in use.")} ${codeCheck.conflict?.primary_model ?? ""} ${t("model.codeBelongsTo", "belongs to")} ${codeCheck.conflict?.product_name ?? ""}`
                  : codeCheck.status === "checking" ? t("model.checking", "Checking if this code is available…")
                  : codeCheck.status === "available" ? `✓ ${t("model.availableInline", "Available — no other product uses this code.")}`
                  : subcategoryCode ? t("hs.codePrefix", "Prefix {p} from the subcategory.").replace("{p}", subcategoryCode) : undefined)
                : undefined}
              input={eI ? inp("primary_model", { mono: true, placeholder: subcategoryCode ? `${subcategoryCode}-…` : "e.g. XCS-7800", onChange: (v) => sheet.patch({ primary_model: v.toUpperCase().replace(/\s+/g, "") }) }) : undefined} />
            <FieldRow label={t("pp.f.legacy", "Legacy code")} glyph={glyph(t("pp.f.legacy", "Legacy code"))}
              value={tob(s("legacy_code", "identity"), true)} input={eI ? inp("legacy_code", { mono: true }) : undefined} />
            <FieldRow label={t("pp.f.publicUrl", "Public URL")} glyph={glyph(t("pp.f.publicUrl", "Public URL"))}
              value={tob(s("slug", "identity"), true)}
              help={eI ? (slugCheck.status === "taken" ? t("hs.slugTaken", "This URL is already used by {p}.").replace("{p}", slugCheck.conflict?.product_name ?? "") : slugCheck.status === "checking" ? t("model.checking", "Checking if this code is available…") : slugCheck.status === "available" ? `✓ ${t("hs.slugFree", "Available.")}` : undefined) : undefined}
              input={eI ? inp("slug", { mono: true, onChange: (v) => sheet.patch({ slug: slugify(v) }) }) : undefined} />
            <FieldRow label={t("pp.f.brand", "Brand")} glyph={glyph(t("pp.f.brand", "Brand"))}
              value={tob(s("brand", "identity"))}
              input={eI && d ? (
                <KdsSelect value={d.brand} onChange={(v) => sheet.patch({ brand: v })}
                  options={[...(brands?.names ?? []), ...(d.brand && !(brands?.names ?? []).includes(d.brand) ? [d.brand] : [])].map((b) => {
                    const slug = b.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                    const logo = brands?.logos[slug];
                    return { value: b, label: b, icon: logo ? <img src={IMG.thumb(logo)} alt="" className="h-4 w-4 object-contain" /> : undefined };
                  })}
                  placeholder={brands ? t("hero.selectBrand", "Select brand...") : t("cl.loading", "Loading…")} triggerClassName={`${INP_B} w-full pe-8 text-start`} />
              ) : undefined} />
            <FieldRow label={t("pp.f.tagline", "Tagline")} glyph={glyph(t("pp.f.tagline", "Tagline"))} wide
              badge={eI ? aiButton("tagline") : undefined}
              value={tob(eI && d ? d.tagline : str(primary?.tagline))}
              help={eI ? aiText("tagline") : undefined}
              input={eI ? inp("tagline", { placeholder: t("hs.taglinePh", "One line that sells it") }) : undefined} />
            <FieldRow label={t("pp.f.excerpt", "Short description")} glyph={glyph(t("pp.f.excerpt", "Short description"))} wide
              badge={eI ? aiButton("excerpt") : undefined}
              value={tob(s("excerpt", "identity"))}
              help={eI ? aiText("excerpt") : undefined}
              input={eI && d ? <textarea value={d.excerpt} onChange={(e) => sheet.patch({ excerpt: e.target.value })} className={TA} /> : undefined} />
          </div>
        </div>
      </Group>

      {/* ── Auto-generated codes ───────────────────────────────────────── */}
      {str(primary?.primary_model) && (
        <Group motion={motion} icon={<ScanLineIcon className="h-4 w-4" />} title={t("hero.autoCodes", "Auto-Generated Codes")} count={t("pk.calculated", "Calculated")}>
          <div className="flex items-center gap-2 mb-3 text-[10.5px] text-[var(--text-ghost)]"><CalcBadge label={t("pk.calculated", "Calculated")} /><span>{t("hs.codesNote", "Drawn from the KOLEEX code and the public URL — nothing to type.")}</span></div>
          <BarcodeQRDisplay value={str(primary?.primary_model)} label={str(product?.product_name)} qrPayload={str(product?.slug) ? `${typeof window !== "undefined" ? window.location.origin : ""}/products/${str(product?.slug)}` : str(primary?.primary_model)} />
        </Group>
      )}

      {/* ── Description ────────────────────────────────────────────────── */}
      <Group motion={motion} icon={<BoundIcon semanticKey="field.description" className="h-4 w-4" fallback={<DocumentIcon className="h-4 w-4" />} />} title={t("description.title", "Product Description")} count={t("hs.richText", "Rich text")} {...sheet.gp("description", canEdit)}>
        {E("description") && d ? (
          <RichTextEditor value={d.description} onChange={(html) => sheet.patch({ description: html })} minHeight={220} />
        ) : descHtml ? (
          <div className="kx-prose text-[13px] leading-relaxed text-[var(--text-secondary)] [&_p]:mb-2 [&_ul]:list-disc [&_ul]:ps-5 [&_ol]:list-decimal [&_ol]:ps-5 [&_h1]:text-[16px] [&_h2]:text-[15px] [&_h3]:text-[14px] [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_a]:underline [&_table]:w-full [&_td]:border [&_td]:border-[var(--border-subtle)] [&_td]:px-2 [&_td]:py-1" dangerouslySetInnerHTML={{ __html: descHtml }} />
        ) : <Blank label={notSet} />}
      </Group>

      {/* ── Key highlights ─────────────────────────────────────────────── */}
      <Group motion={motion} icon={<CheckSquareIcon className="h-4 w-4" />} title={t("hero.keyHighlights", "Key Highlights")} count={`${arr(p("highlights", "highlights")).length}/5`} {...sheet.gp("highlights", canEdit)}>
        {E("highlights") && d ? (
          <>
            <div className="flex justify-end mb-2">{aiButton("highlights")}</div>
            <HighlightsEditor highlights={d.highlights} onChange={(highlights) => sheet.patch({ highlights })} t={t} />
            {aiNote("highlights")}
          </>
        ) : arr(p("highlights", "highlights")).length ? (
          <ul className="space-y-1.5">
            {arr(p("highlights", "highlights")).map((h, i) => <li key={i} className="flex items-start gap-2 text-[13px] text-[var(--text-primary)]"><span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />{h}</li>)}
          </ul>
        ) : <Blank label={notSet} />}
      </Group>

      {/* ── Tags & keywords ────────────────────────────────────────────── */}
      <Group motion={motion} icon={<TagsIcon className="h-4 w-4" />} title={t("hero.tagsTitle", "Tags & Keywords")} count={String(arr(p("tags", "tags")).length)} {...sheet.gp("tags", canEdit)}>
        {E("tags") && d ? (
          <>
            <div className="flex justify-end mb-2">{aiButton("tags")}</div>
            <TagsInput tags={d.tags} onChange={(tags) => sheet.patch({ tags })} t={t} />
            {aiNote("tags")}
          </>
        ) : arr(p("tags", "tags")).length ? <Chips items={arr(p("tags", "tags"))} /> : <Blank label={notSet} />}
      </Group>

      {/* ── Identifiers & lifecycle ────────────────────────────────────── */}
      <Group motion={motion} icon={<HashtagIcon className="h-4 w-4" />} title={t("identity.identifiers", "Identifiers & Lifecycle")} count={t("hs.identifiersBadge", "Codes · Dates")} {...sheet.gp("identifiers", canEdit)}>
        <div className={grid}>
          <FieldRow label={t("pp.f.manufacturer", "Manufacturer")} glyph={glyph(t("pp.f.manufacturer", "Manufacturer"))} value={tob(s("manufacturer", "identifiers"))} input={E("identifiers") ? inp("manufacturer") : undefined} />
          <FieldRow label={t("pp.f.mpn", "MPN")} glyph={glyph(t("pp.f.mpn", "MPN"))} value={tob(s("mpn", "identifiers"), true)} input={E("identifiers") ? inp("mpn", { mono: true }) : undefined} />
          <FieldRow label={t("pp.f.gtin", "GTIN")} glyph={glyph(t("pp.f.gtin", "GTIN"))} help={t("hs.gtinHelp", "EAN / UPC barcode number, if the product has one.")} value={tob(s("gtin", "identifiers"), true)} input={E("identifiers") ? inp("gtin", { mono: true, numeric: true }) : undefined} />
          <FieldRow label={t("pp.f.sku", "Internal SKU")} glyph={glyph(t("pp.f.sku", "Internal SKU"))} value={tob(s("internal_sku", "identifiers"), true)} input={E("identifiers") ? inp("internal_sku", { mono: true }) : undefined} />
          <FieldRow label={t("pp.f.generation", "Generation")} glyph={glyph(t("pp.f.generation", "Generation"))} value={tob(s("generation", "identifiers"))} input={E("identifiers") ? inp("generation", { placeholder: "e.g. Gen 3" }) : undefined} />
          <FieldRow label={t("pp.f.modelYear", "Model year")} glyph={glyph(t("pp.f.modelYear", "Model year"))} value={tob(s("model_year", "identifiers"))} input={E("identifiers") ? inp("model_year", { numeric: true, placeholder: "2026" }) : undefined} />
          <FieldRow label={t("pp.f.launch", "Launch date")} glyph={glyph(t("pp.f.launch", "Launch date"))} value={tob(fmtDay(p("launch_date", "identifiers")))} input={E("identifiers") ? inp("launch_date", { date: true }) : undefined} />
          <FieldRow label={t("pp.f.eol", "End of life")} glyph={glyph(t("pp.f.eol", "End of life"))} value={tob(fmtDay(p("eol_date", "identifiers")))} input={E("identifiers") ? inp("eol_date", { date: true }) : undefined} />
          <FieldRow label={t("pp.f.availFrom", "Available from")} glyph={glyph(t("pp.f.availFrom", "Available from"))} value={tob(fmtDay(p("available_from", "identifiers")))} input={E("identifiers") ? inp("available_from", { date: true }) : undefined} />
          <FieldRow label={t("pp.f.lastOrder", "Last order date")} glyph={glyph(t("pp.f.lastOrder", "Last order date"))} value={tob(fmtDay(p("last_order_date", "identifiers")))} input={E("identifiers") ? inp("last_order_date", { date: true }) : undefined} />
          <FieldRow label={t("pp.f.statusReason", "Status reason")} glyph={glyph(t("pp.f.statusReason", "Status reason"))} wide value={tob(s("status_reason", "identifiers"))} input={E("identifiers") ? inp("status_reason") : undefined} />
          {imageField("brand_mark_url", "identifiers", t("pp.f.brandMark", "Brand mark"))}
          <FieldRow label={t("pp.f.aliases", "Alternate names")} glyph={glyph(t("pp.f.aliases", "Alternate names"))}
            value={arr(p("alternate_names", "identifiers")).length ? <Chips items={arr(p("alternate_names", "identifiers"))} /> : <Blank label={notSet} />}
            input={E("identifiers") && d ? <TagsInput tags={d.alternate_names} onChange={(alternate_names) => sheet.patch({ alternate_names })} t={t} /> : undefined} />
          <FieldRow label={t("idf.revisionHistory", "Revision history")} glyph={glyph(t("idf.revisionHistory", "Revision history"))} wide
            value={revOf(product?.revision_history).length ? (
              <ul className="space-y-1">
                {revOf(product?.revision_history).map((r, i) => <li key={i} className="text-[12.5px] flex flex-wrap gap-x-3"><span className="font-mono font-medium">{r.version || "—"}</span><span className="text-[var(--text-muted)] tabular-nums">{fmtDay(r.date) || "—"}</span><span className="text-[var(--text-secondary)] font-normal">{r.note}</span></li>)}
              </ul>
            ) : <Blank label={notSet} />}
            input={E("identifiers") && d ? (
              <div className="space-y-2">
                {d.revision_history.map((r, i) => (
                  <div key={i} className="grid grid-cols-[100px_150px_1fr_auto] gap-2 items-center">
                    <input value={r.version} placeholder="v1.2" onChange={(e) => sheet.patch((dd) => { const next = [...dd.revision_history]; next[i] = { ...next[i], version: e.target.value }; return { ...dd, revision_history: next }; })} className={`${INP_B} w-full font-mono h-8 text-[12px]`} />
                    <input type="date" value={r.date} onChange={(e) => sheet.patch((dd) => { const next = [...dd.revision_history]; next[i] = { ...next[i], date: e.target.value }; return { ...dd, revision_history: next }; })} className={`${INP_B} w-full h-8 text-[12px]`} />
                    <input value={r.note} placeholder={t("hs.revNote", "What changed")} onChange={(e) => sheet.patch((dd) => { const next = [...dd.revision_history]; next[i] = { ...next[i], note: e.target.value }; return { ...dd, revision_history: next }; })} className={`${INP_B} w-full h-8 text-[12px] font-normal`} />
                    <button type="button" aria-label={t("cc.remove", "Remove")} onClick={() => sheet.patch((dd) => ({ ...dd, revision_history: dd.revision_history.filter((_, j) => j !== i) }))} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-rose-300"><CrossIcon className="h-3 w-3" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => sheet.patch((dd) => ({ ...dd, revision_history: [...dd.revision_history, { version: "", date: "", note: "" }] }))} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"><PlusIcon className="h-3 w-3" /> {t("hs.addRevision", "Add revision")}</button>
              </div>
            ) : undefined} />
        </div>
      </Group>

      {/* ── Search & Social ────────────────────────────────────────────── */}
      <Group motion={motion} icon={<EyeIcon className="h-4 w-4" />} title={t("review.searchSocialSection", "Search & Social")} count={t("hs.seoBadge", "SEO · OG")} {...sheet.gp("seo", canEdit)}>
        <div className="divide-y divide-[var(--border-subtle)]">
          <FieldRow label={t("hs.metaTitle", "Meta title")} glyph={glyph(t("hs.metaTitle", "Meta title"))} help={t("hs.metaTitleHelp", "What search engines show as the page title — leave empty to use the product name.")}
            value={tob(s("meta_title", "seo"))} input={E("seo") ? inp("meta_title", { placeholder: str(product?.product_name) }) : undefined} />
          <FieldRow label={t("hs.metaDesc", "Meta description")} glyph={glyph(t("hs.metaDesc", "Meta description"))} help={t("hs.metaDescHelp", "The two lines under the title in search results — leave empty to use the short description.")}
            value={tob(s("meta_description", "seo"))} input={E("seo") && d ? <textarea value={d.meta_description} onChange={(e) => sheet.patch({ meta_description: e.target.value })} placeholder={str(product?.excerpt)} className={TA} /> : undefined} />
          {imageField("og_image_url", "seo", t("hs.ogImage", "Social share image (OG)"))}
        </div>
      </Group>

      {/* ── Languages & markets ────────────────────────────────────────── */}
      <Group motion={motion} icon={<BoundIcon semanticKey="field.languages" className="h-4 w-4" fallback={<GlobeIcon className="h-4 w-4" />} />} title={t("pp.sec.languages", "Languages & markets")} count={String(trs.length)} {...sheet.gp("languages", canEdit)}>
        {trs.length === 0 && !E("languages") ? (
          <p className="text-[12px] text-[var(--text-ghost)] italic">{t("pp.e.englishOnly", "English only — no localized names recorded.")}</p>
        ) : (
          <div className="space-y-3">
            {trs.map((x) => {
              const rtl = x.locale === "ar" || x.locale === "ur";
              return (
                <div key={x._k} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">{localeDisplay(x.locale)}</span>
                    <span className="text-[10px] font-mono text-[var(--text-ghost)]">{x.locale}</span>
                    <span className="flex-1" />
                    {E("languages") && (
                      <>
                        <button type="button" onClick={() => void translateRow(x._k)} disabled={!!trBusy}
                          className="kx-ai-glow inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[10.5px] font-bold text-[var(--accent,#0066FF)] border border-[var(--accent,#0066FF)]/30 disabled:opacity-50">
                          {trBusy === x._k ? <SpinnerIcon className="h-3 w-3" /> : <SparklesIcon className="h-3 w-3" />} {trBusy === x._k ? t("hero.translating", "Translating…") : t("hero.autoTranslate", "Auto-translate")}
                        </button>
                        <button type="button" aria-label={t("hero.removeLang", "Remove this language")} onClick={() => sheet.patch((dd) => ({ ...dd, translations: dd.translations.filter((y) => y._k !== x._k) }))} className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-rose-300"><CrossIcon className="h-3 w-3" /></button>
                      </>
                    )}
                  </div>
                  {E("languages") ? (
                    <div dir={rtl ? "rtl" : "ltr"} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div><span className="block text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-ghost)] mb-1">{t("pp.f.productName", "Product name")}</span><input value={x.product_name} onChange={(e) => updTr(x._k, { product_name: e.target.value })} className={`${INP_B} w-full`} /></div>
                      <div><span className="block text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-ghost)] mb-1">{t("pp.f.tagline", "Tagline")}</span><input value={x.tagline} onChange={(e) => updTr(x._k, { tagline: e.target.value })} className={`${INP_B} w-full font-normal`} /></div>
                      <div className="sm:col-span-2"><span className="block text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-ghost)] mb-1">{t("pp.f.excerpt", "Short description")}</span><textarea value={x.excerpt} onChange={(e) => updTr(x._k, { excerpt: e.target.value })} className={TA} /></div>
                      <div className="sm:col-span-2"><span className="block text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-ghost)] mb-1">{t("pp.f.description", "Full description")}</span><RichTextEditor value={x.description} onChange={(html) => updTr(x._k, { description: html })} minHeight={140} /></div>
                      {trMsg && trMsg.locale === x._k && <p className={`sm:col-span-2 text-[11px] ${trMsg.kind === "error" ? "text-[var(--state-warning,#FFCC00)]" : "text-[var(--text-muted)]"}`}>{trMsg.text}</p>}
                    </div>
                  ) : (
                    <div dir={rtl ? "rtl" : "ltr"} className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[12.5px]">
                      <div><span className="text-[10px] text-[var(--text-ghost)] uppercase tracking-wider me-2">{t("pp.f.productName", "Product name")}</span><span className="font-semibold text-[var(--text-primary)]">{x.product_name || "—"}</span></div>
                      <div><span className="text-[10px] text-[var(--text-ghost)] uppercase tracking-wider me-2">{t("pp.f.tagline", "Tagline")}</span><span className="text-[var(--text-secondary)]">{x.tagline || "—"}</span></div>
                      <div className="sm:col-span-2"><span className="text-[10px] text-[var(--text-ghost)] uppercase tracking-wider me-2">{t("pp.f.excerpt", "Short description")}</span><span className="text-[var(--text-secondary)]">{x.excerpt || "—"}</span></div>
                      <div className="sm:col-span-2 text-[11px] text-[var(--text-muted)]">{x.description.trim() ? `✓ ${t("hs.descTranslated", "Full description translated")}` : t("hs.descNotTranslated", "Full description not translated")}</div>
                    </div>
                  )}
                </div>
              );
            })}
            {E("languages") && freeLocales.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">{t("hero.nameOtherLang", "Other language")}</span>
                <KdsSelect value={addPick} onChange={setAddLocale} options={freeLocales.map((l) => ({ value: l.code, label: localeDisplay(l.code) }))} triggerClassName={`${INP_B} h-8 pe-8 text-[12px] text-start min-w-[160px]`} />
                <button type="button" onClick={() => sheet.patch((dd) => ({ ...dd, translations: [...dd.translations, { _k: crypto.randomUUID(), locale: addPick, product_name: "", tagline: "", excerpt: "", description: "" }] }))}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"><PlusIcon className="h-3 w-3" /> {t("hero.addLanguage", "Add another language")}</button>
              </div>
            )}
          </div>
        )}
      </Group>
    </div>
  );
}
