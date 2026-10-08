"use client";

/* ---------------------------------------------------------------------------
   OptionsSheet — the Options tab of the product profile, editable in place.

   The one tab the record never had: the BUYER OPTIONS — the configurator
   questions a customer answers when ordering (stand thickness, motor,
   voltage…), each with its answers, and each answer with its photo, its
   linked product/model or its own price / weight / volume deltas, and
   whether it is the default. Read and written through /api/product-options
   (the editor's own store), so the record and the editor can never disagree.

   View: one card per question, answers as tiles. Edit: the same cards, every
   value a control; questions and answers can be added, reordered, removed.
   A linked answer carries no deltas — the linked product's own numbers
   apply, and the API refuses deltas on linked values.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { IMG } from "@/lib/cdn";
import { uploadProductFile } from "@/lib/products-admin";
import { LOCALES } from "@/types/product-form";
import KdsSelect from "@/components/kds/Select";
import Toggle from "@/components/kds/Toggle";
import Modal from "@/components/kds/Modal";
import ListTodoIcon from "@/components/icons/ui/ListTodoIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import Link2Icon from "@/components/icons/ui/Link2Icon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { Group, Blank, INP_B } from "./primitives";
import { useSheetEdit } from "./useSheetEdit";

type I18n = Record<string, string>;
type Val = {
  key: string; label: string; label_i18n: I18n; image_url: string | null;
  linked_product_id: string | null; linked_model_id: string | null; linked_name: string | null;
  price_delta_cny: string; weight_delta_kg: string; cbm_delta: string; is_default: boolean;
};
type Opt = { key: string; title: string; title_i18n: I18n; kind: "choice" | "yes_no" | "info"; required: boolean; depends_on_value_key: string | null; values: Val[] };
type Draft = { options: Opt[] };
type CatalogRow = { product_id: string; product_name: string; model_id: string; model_name: string; image_url: string | null };

const KINDS = ["choice", "yes_no", "info"] as const;
const KIND_FB: Record<Opt["kind"], string> = { choice: "Choice list", yes_no: "Yes / No", info: "Info only" };
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const obj = (v: unknown): I18n => (v && typeof v === "object" && !Array.isArray(v) ? (v as I18n) : {});
const fresh = () => crypto.randomUUID();
const emptyVal = (label = ""): Val => ({ key: fresh(), label, label_i18n: {}, image_url: null, linked_product_id: null, linked_model_id: null, linked_name: null, price_delta_cny: "", weight_delta_kg: "", cbm_delta: "", is_default: false });
const num = (v: string) => { const n = Number(v); return v.trim() && Number.isFinite(n) ? n : null; };
const signed = (v: string, unit: string) => { const n = num(v); return n === null ? null : `${n > 0 ? "+" : ""}${n.toLocaleString()} ${unit}`; };

export default function OptionsSheet({
  productId, t, lang, motion, canEdit, onDirtyChange, notSet,
}: {
  productId: string | undefined;
  t: (k: string, fb?: string) => string;
  lang: string;
  motion: string;
  canEdit: boolean;
  onDirtyChange: (dirty: boolean) => void;
  notSet: string;
}) {
  const [options, setOptions] = useState<Opt[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ optKey: string; valKey: string } | null>(null);

  /* Load: server rows carry ids; they are re-keyed and depends_on comes back
     into key space — the editor's own mapping. */
  useEffect(() => {
    if (!productId) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/product-options?product_id=${productId}`, { credentials: "include", cache: "no-store" });
        const json = (await res.json()) as { options?: Array<Record<string, unknown>>; error?: string };
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        const byId = new Map<string, string>();
        const opts: Opt[] = (json.options ?? []).map((o) => {
          const values = ((o.values as Array<Record<string, unknown>>) ?? []).map((v) => {
            const key = fresh(); byId.set(str(v.id), key);
            return { key, label: str(v.label), label_i18n: obj(v.label_i18n), image_url: (v.image_url as string) || null,
              linked_product_id: (v.linked_product_id as string) || null, linked_model_id: (v.linked_model_id as string) || null, linked_name: null,
              price_delta_cny: v.price_delta_cny == null ? "" : String(v.price_delta_cny), weight_delta_kg: v.weight_delta_kg == null ? "" : String(v.weight_delta_kg),
              cbm_delta: v.cbm_delta == null ? "" : String(v.cbm_delta), is_default: v.is_default === true };
          });
          return { key: fresh(), title: str(o.title), title_i18n: obj(o.title_i18n), kind: (["choice", "yes_no", "info"].includes(str(o.kind)) ? o.kind : "choice") as Opt["kind"],
            required: o.required === true, depends_on_value_key: o.depends_on_value_id ? (byId.get(str(o.depends_on_value_id)) ?? null) : null, values };
        });
        /* Linked answers show the product they point at, by name. */
        if (opts.some((o) => o.values.some((v) => v.linked_product_id))) {
          try {
            const r2 = await fetch(`/api/quotations/catalog-search?q=&limit=2000`, { credentials: "include", cache: "force-cache" });
            const j2 = (await r2.json()) as { rows?: CatalogRow[] };
            const byProduct = new Map<string, string>(); const byModel = new Map<string, string>();
            for (const r of j2.rows ?? []) { if (!byProduct.has(r.product_id)) byProduct.set(r.product_id, r.product_name); byModel.set(r.model_id, `${r.product_name} · ${r.model_name}`); }
            for (const o of opts) for (const v of o.values) if (v.linked_product_id) v.linked_name = (v.linked_model_id && byModel.get(v.linked_model_id)) || byProduct.get(v.linked_product_id) || "product";
          } catch { /* names are a courtesy */ }
        }
        if (alive) { setOptions(opts); setLoadErr(null); }
      } catch (e) {
        if (alive) setLoadErr(e instanceof Error ? e.message : "Failed");
      }
    })();
    return () => { alive = false; };
  }, [productId, tick]);

  const sheet = useSheetEdit<"options", Draft>({
    t, onDirtyChange,
    makeDraft: () => ({ options: JSON.parse(JSON.stringify(options ?? [])) as Opt[] }),
    valid: (_c, d) => d.options.every((o) => o.title.trim() && (o.kind === "info" || o.values.every((v) => v.label.trim()))),
    commit: async (_c, d) => {
      if (!productId) return;
      const res = await fetch("/api/product-options", {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          options: d.options.map((o) => ({
            key: o.key, title: o.title.trim(), title_i18n: o.title_i18n, kind: o.kind, required: o.required, depends_on_value_key: o.depends_on_value_key,
            values: o.values.map((v) => ({
              key: v.key, label: v.label.trim(), label_i18n: v.label_i18n, image_url: v.image_url,
              linked_product_id: v.linked_product_id, linked_model_id: v.linked_model_id,
              price_delta_cny: v.linked_product_id ? null : (v.price_delta_cny || null),
              weight_delta_kg: v.linked_product_id ? null : (v.weight_delta_kg || null),
              cbm_delta: v.linked_product_id ? null : (v.cbm_delta || null),
              is_default: v.is_default,
            })),
          })),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? t("pr.saveFailed", "Couldn't save — try again."));
      setOptions(d.options);
      setTick((n) => n + 1);
    },
  });
  const e = sheet.editing === "options";
  const d = sheet.draft;
  const opts: Opt[] = e && d ? d.options : (options ?? []);

  const updOpt = (k: string, u: Partial<Opt> | ((o: Opt) => Opt)) => sheet.patch((dd) => ({ options: dd.options.map((o) => (o.key === k ? (typeof u === "function" ? u(o) : { ...o, ...u }) : o)) }));
  const updVal = (ok: string, vk: string, u: Partial<Val>) => updOpt(ok, (o) => ({ ...o, values: o.values.map((v) => (v.key === vk ? { ...v, ...u } : v)) }));
  const moveOpt = (k: string, dir: -1 | 1) => sheet.patch((dd) => { const i = dd.options.findIndex((o) => o.key === k); const j = i + dir; if (i < 0 || j < 0 || j >= dd.options.length) return dd; const n = [...dd.options]; [n[i], n[j]] = [n[j], n[i]]; return { options: n }; });
  const localeDisplay = (code: string) => { try { return new Intl.DisplayNames([lang === "zh" ? "zh" : lang === "ar" ? "ar" : "en"], { type: "language" }).of(code) || code; } catch { return LOCALES.find((l) => l.code === code)?.name || code; } };
  const tr = (base: string, m: I18n) => (m[lang] || "").trim() || base;
  const kindLabel = (k: Opt["kind"]) => t(`opt.kind.${k}`, KIND_FB[k]);
  const setImage = async (ok: string, vk: string, file: File | null | undefined) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) { sheet.setError(t("media.mainNotImage", "{name} is not an image.").replace("{name}", file.name)); return; }
    setBusy(vk);
    try { const up = await uploadProductFile(file); if (up?.url) updVal(ok, vk, { image_url: up.url }); }
    finally { setBusy(null); }
  };
  /* Answers of EARLIER questions — what "show only when" may point at. */
  const earlierAnswers = (idx: number) => opts.slice(0, idx).flatMap((o) => o.values.map((v) => ({ value: v.key, label: `${o.title || "?"} → ${v.label || "?"}` })));
  const answerName = (key: string | null) => { if (!key) return null; for (const o of opts) for (const v of o.values) if (v.key === key) return `${o.title} → ${v.label}`; return null; };
  const inp = `${INP_B} w-full`;
  const small = `${INP_B} h-8 text-[12px] w-full`;
  const tiny = "block text-[9.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-ghost)] mb-1";

  /* Per-language editor for a title / label. */
  const i18nEdit = (map: I18n, write: (m: I18n) => void) => {
    const used = new Set(Object.keys(map)); const free = LOCALES.filter((l) => !used.has(l.code));
    return (
      <div className="mt-1.5 space-y-1">
        {Object.keys(map).map((code) => (
          <div key={code} className="flex items-center gap-1.5">
            <span className="w-14 shrink-0 text-[9.5px] font-bold uppercase tracking-wider text-[var(--text-ghost)] truncate">{localeDisplay(code)}</span>
            <input dir={code === "ar" || code === "ur" ? "rtl" : "ltr"} value={map[code] ?? ""} onChange={(ev) => write({ ...map, [code]: ev.target.value })} className={`${small} font-normal`} />
            <button type="button" aria-label={t("cc.remove", "Remove")} onClick={() => { const m = { ...map }; delete m[code]; write(m); }} className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-rose-300"><CrossIcon className="h-3 w-3" /></button>
          </div>
        ))}
        {free.length > 0 && <KdsSelect value="" onChange={(code) => write({ ...map, [code]: "" })} options={free.map((l) => ({ value: l.code, label: localeDisplay(l.code) }))} placeholder={`+ ${t("hero.addLanguage", "Add another language")}`} triggerClassName={`${INP_B} h-7 text-[11px] pe-8 text-start w-auto min-w-[180px]`} />}
      </div>
    );
  };

  return (
    <div onKeyDown={sheet.onKeyDown}>
      <Group motion={motion} icon={<ListTodoIcon className="h-4 w-4" />} title={t("options.title", "Buyer Options")} count={options ? t("opt.badgeN", "{n} questions").replace("{n}", String(opts.length)) : t("cl.loading", "Loading…")} {...sheet.gp("options", canEdit && !!options)}>
        <p className="mb-3 text-[11px] text-[var(--text-ghost)]">{t("opt.intro", "The questions a customer answers when ordering — each answer either links a product or carries its own price, weight and volume deltas.")}</p>
        {loadErr ? (
          <p className="text-[12px] text-red-400">{loadErr}</p>
        ) : !options ? (
          <p className="text-[12px] text-[var(--text-ghost)] inline-flex items-center gap-2"><SpinnerIcon className="h-3.5 w-3.5" /> {t("cl.loading", "Loading…")}</p>
        ) : opts.length === 0 && !e ? (
          <p className="text-[12px] text-[var(--text-ghost)] italic">{t("opt.none", "No buyer options yet.")}</p>
        ) : (
          <div className="space-y-3">
            {opts.map((o, oi) => {
              const dep = answerName(o.depends_on_value_key);
              return (
                <div key={o.key} className="rounded-xl border border-[var(--border-subtle)] p-3 sm:p-4">
                  {/* question header */}
                  <div className="flex items-start gap-2.5 mb-3 min-w-0">
                    <span className="h-7 w-7 shrink-0 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[11px] font-bold text-[var(--text-muted)] tabular-nums">{oi + 1}</span>
                    <div className="min-w-0 flex-1">
                      {e ? (
                        <>
                          <input value={o.title} placeholder={t("opt.questionPh", 'Question — e.g. "Stand thickness"')} onChange={(ev) => updOpt(o.key, { title: ev.target.value })} className={`${inp} font-semibold`} />
                          {i18nEdit(o.title_i18n, (m) => updOpt(o.key, { title_i18n: m }))}
                          <div className="mt-2 flex items-center gap-3 flex-wrap">
                            <KdsSelect value={o.kind} onChange={(k) => updOpt(o.key, (x) => ({ ...x, kind: k as Opt["kind"], values: k === "yes_no" ? [{ ...emptyVal("Yes"), key: x.values[0]?.key ?? fresh() }] : x.values.length ? x.values : [emptyVal()] }))} options={KINDS.map((k) => ({ value: k, label: kindLabel(k) }))} triggerClassName={`${INP_B} h-8 text-[12px] pe-8 text-start w-[150px]`} />
                            <label className="inline-flex items-center gap-2 text-[11px] text-[var(--text-muted)]"><Toggle checked={o.required} onChange={(v) => updOpt(o.key, { required: v })} /> {t("opt.required", "Required")}</label>
                            {oi > 0 && (
                              <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                                {t("opt.showOnlyWhen", "Show only when")}
                                <KdsSelect value={o.depends_on_value_key ?? ""} onChange={(v) => updOpt(o.key, { depends_on_value_key: v || null })} options={[{ value: "", label: t("opt.always", "Always") }, ...earlierAnswers(oi)]} triggerClassName={`${INP_B} h-8 text-[12px] pe-8 text-start min-w-[180px]`} />
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-[13px] font-semibold text-[var(--text-primary)]">{tr(o.title, o.title_i18n) || <Blank label={notSet} />}</div>
                          <div className="mt-0.5 flex flex-wrap gap-1.5 text-[10px]">
                            <span className="px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-muted)]">{kindLabel(o.kind)}</span>
                            {o.required && <span className="px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-300">{t("opt.required", "Required")}</span>}
                            {dep && <span className="px-1.5 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-ghost)]">{t("opt.showOnlyWhen", "Show only when")}: {dep}</span>}
                          </div>
                        </>
                      )}
                    </div>
                    {e && (
                      <span className="inline-flex items-center gap-0.5 shrink-0">
                        <button type="button" aria-label={t("mv.moveUp", "Move up")} disabled={oi === 0} onClick={() => moveOpt(o.key, -1)} className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-[var(--text-primary)] disabled:opacity-30"><AngleDownIcon className="h-3.5 w-3.5 rotate-180" /></button>
                        <button type="button" aria-label={t("mv.moveDown", "Move down")} disabled={oi === opts.length - 1} onClick={() => moveOpt(o.key, 1)} className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-[var(--text-primary)] disabled:opacity-30"><AngleDownIcon className="h-3.5 w-3.5" /></button>
                        <button type="button" aria-label={t("opt.deleteQuestion", "Delete question")} onClick={() => sheet.patch((dd) => ({ options: dd.options.filter((x) => x.key !== o.key).map((x) => (x.depends_on_value_key && o.values.some((v) => v.key === x.depends_on_value_key) ? { ...x, depends_on_value_key: null } : x)) }))} className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-rose-300"><CrossIcon className="h-3.5 w-3.5" /></button>
                      </span>
                    )}
                  </div>

                  {/* answers */}
                  {o.kind !== "info" && (
                    <div className={`grid gap-2 ${e ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
                      {o.values.map((v) => {
                        const deltas = [signed(v.price_delta_cny, "¥"), signed(v.weight_delta_kg, "kg"), signed(v.cbm_delta, "m³")].filter(Boolean);
                        return (
                          <div key={v.key} className={`rounded-lg border ${v.is_default ? "border-[#567FB2]/50 bg-[#567FB2]/[0.07]" : "border-[var(--border-subtle)] bg-[var(--bg-surface)]"} p-2.5`}>
                            {e ? (
                              <div className="flex items-start gap-2.5">
                                <label className="h-14 w-14 shrink-0 rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] overflow-hidden flex items-center justify-center cursor-pointer hover:border-[var(--border-focus)]" title={t("opt.photoHint", "Click, drop or paste a photo")}
                                  onDragOver={(ev) => ev.preventDefault()} onDrop={(ev) => { ev.preventDefault(); void setImage(o.key, v.key, ev.dataTransfer.files?.[0]); }}>
                                  {busy === v.key ? <SpinnerIcon className="h-4 w-4" /> : v.image_url ? <img src={IMG.thumb(v.image_url)} alt="" className="h-full w-full object-contain p-0.5" /> : <ImageRawIcon className="h-4 w-4 text-[var(--text-ghost)]" />}
                                  <input type="file" accept="image/*" className="hidden" onChange={(ev) => void setImage(o.key, v.key, ev.target.files?.[0])} />
                                </label>
                                <div className="min-w-0 flex-1 space-y-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <input value={v.label} placeholder={o.kind === "yes_no" ? "Yes" : t("opt.answerPh", 'Answer — e.g. "2 mm"')} onChange={(ev) => updVal(o.key, v.key, { label: ev.target.value })} className={small} />
                                    <label className="inline-flex items-center gap-1.5 text-[10.5px] text-[var(--text-muted)] whitespace-nowrap"><Toggle checked={v.is_default} onChange={(x) => updOpt(o.key, (oo) => ({ ...oo, values: oo.values.map((y) => ({ ...y, is_default: y.key === v.key ? x : (x ? false : y.is_default) })) }))} /> {t("opt.default", "Default")}</label>
                                    {v.image_url && <button type="button" onClick={() => updVal(o.key, v.key, { image_url: null })} className="text-[10.5px] text-[var(--text-ghost)] hover:text-rose-300 whitespace-nowrap">{t("sup.removePhoto", "Remove photo")}</button>}
                                    {o.kind !== "yes_no" && <button type="button" aria-label={t("opt.deleteAnswer", "Delete answer")} onClick={() => updOpt(o.key, (oo) => ({ ...oo, values: oo.values.filter((y) => y.key !== v.key) }))} className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-rose-300"><CrossIcon className="h-3 w-3" /></button>}
                                  </div>
                                  {i18nEdit(v.label_i18n, (m) => updVal(o.key, v.key, { label_i18n: m }))}
                                  {v.linked_product_id ? (
                                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                                      <Link2Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{v.linked_name || t("opt.linkedProduct", "Linked product")}</span>
                                      <span className="text-[10px] text-[var(--text-ghost)]">{t("opt.linkedNoDeltas", "price, weight and volume come from the linked product")}</span>
                                      <button type="button" onClick={() => updVal(o.key, v.key, { linked_product_id: null, linked_model_id: null, linked_name: null })} className="underline hover:text-rose-300">{t("opt.unlink", "Unlink")}</button>
                                    </div>
                                  ) : (
                                    <div className="flex items-end gap-2 flex-wrap">
                                      <div className="w-[110px]"><span className={tiny}>{t("opt.priceDelta", "Price +¥")}</span><input inputMode="decimal" value={v.price_delta_cny} placeholder="0" onChange={(ev) => updVal(o.key, v.key, { price_delta_cny: ev.target.value.replace(/[^0-9.\-]/g, "") })} className={`${small} tabular-nums`} /></div>
                                      <div className="w-[100px]"><span className={tiny}>{t("opt.weightDelta", "Weight +kg")}</span><input inputMode="decimal" value={v.weight_delta_kg} placeholder="0" onChange={(ev) => updVal(o.key, v.key, { weight_delta_kg: ev.target.value.replace(/[^0-9.\-]/g, "") })} className={`${small} tabular-nums`} /></div>
                                      <div className="w-[100px]"><span className={tiny}>{t("opt.cbmDelta", "Vol +cbm")}</span><input inputMode="decimal" value={v.cbm_delta} placeholder="0" onChange={(ev) => updVal(o.key, v.key, { cbm_delta: ev.target.value.replace(/[^0-9.\-]/g, "") })} className={`${small} tabular-nums`} /></div>
                                      <button type="button" onClick={() => setPicker({ optKey: o.key, valKey: v.key })} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"><Link2Icon className="h-3 w-3" /> {t("opt.linkProduct", "Link a product")}</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2.5">
                                {v.image_url ? <span className="h-12 w-12 shrink-0 rounded-lg bg-white border border-[var(--border-subtle)] overflow-hidden"><img src={IMG.thumb(v.image_url)} alt="" className="h-full w-full object-contain p-0.5" /></span> : null}
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[12.5px] font-semibold text-[var(--text-primary)]">{tr(v.label, v.label_i18n) || "—"}</span>
                                    {v.is_default && <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border border-[#567FB2]/50 text-[#7FA9D6]">{t("opt.default", "Default")}</span>}
                                  </span>
                                  {v.linked_product_id ? (
                                    <span className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--text-muted)]"><Link2Icon className="h-3 w-3 shrink-0" /><span className="truncate">{v.linked_name || t("opt.linkedProduct", "Linked product")}</span></span>
                                  ) : deltas.length ? (
                                    <span className="mt-0.5 block text-[11px] text-[var(--text-muted)] tabular-nums">{deltas.join(" · ")}</span>
                                  ) : (
                                    <span className="mt-0.5 block text-[11px] text-[var(--text-ghost)]">{t("opt.noDelta", "No price, weight or volume change")}</span>
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {e && o.kind !== "yes_no" && (
                        <button type="button" onClick={() => updOpt(o.key, (oo) => ({ ...oo, values: [...oo.values, emptyVal()] }))} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-dashed border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] w-fit"><PlusIcon className="h-3 w-3" /> {t("opt.addAnswer", "Add answer")}</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {e && (
              <div className="flex flex-wrap gap-2">
                {KINDS.map((k) => (
                  <button key={k} type="button" onClick={() => sheet.patch((dd) => ({ options: [...dd.options, { key: fresh(), title: "", title_i18n: {}, kind: k, required: false, depends_on_value_key: null, values: k === "yes_no" ? [emptyVal("Yes")] : [emptyVal()] }] }))}
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-dashed border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]">
                    <PlusIcon className="h-3 w-3" /> {t("opt.addQuestion", "Add question")} · {kindLabel(k)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Group>

      {picker && productId && (
        <ProductPicker
          t={t}
          excludeId={productId}
          onClose={() => setPicker(null)}
          onPick={(pid, mid, name) => { updVal(picker.optKey, picker.valKey, { linked_product_id: pid, linked_model_id: mid, linked_name: name, price_delta_cny: "", weight_delta_kg: "", cbm_delta: "" }); setPicker(null); }}
        />
      )}
    </div>
  );
}

/* The catalogue picker — a product, or one of its models. */
function ProductPicker({ t, excludeId, onClose, onPick }: {
  t: (k: string, fb?: string) => string; excludeId: string; onClose: () => void;
  onPick: (productId: string, modelId: string | null, name: string) => void;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CatalogRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/quotations/catalog-search?q=${encodeURIComponent(q)}&limit=${q ? 60 : 40}`, { credentials: "include", cache: "no-store" });
        const json = (await res.json()) as { rows?: CatalogRow[] };
        if (alive) setRows((json.rows ?? []).filter((r) => r.product_id !== excludeId));
      } catch { if (alive) setRows([]); }
    }, 250);
    return () => { alive = false; clearTimeout(id); };
  }, [q, excludeId]);
  const products = new Map<string, { product_id: string; product_name: string; image_url: string | null; models: { model_id: string; model_name: string }[] }>();
  for (const r of rows ?? []) { const p = products.get(r.product_id) ?? { product_id: r.product_id, product_name: r.product_name, image_url: r.image_url, models: [] }; p.models.push({ model_id: r.model_id, model_name: r.model_name }); products.set(r.product_id, p); }
  return (
    <Modal open onClose={onClose} title={t("opt.linkProduct", "Link a product")}>
      <div className="space-y-3">
        <div className="relative">
          <SearchIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-ghost)]" />
          <input autoFocus value={q} onChange={(ev) => setQ(ev.target.value)} placeholder={t("opt.searchPh", "Search products…")} className={`${INP_B} w-full ps-8 font-normal`} />
        </div>
        <div className="max-h-[50vh] overflow-y-auto space-y-1.5">
          {!rows ? <p className="text-[12px] text-[var(--text-ghost)]">{t("cl.loading", "Loading…")}</p>
            : products.size === 0 ? <p className="text-[12px] text-[var(--text-ghost)] italic">{t("opt.noMatch", "No products match.")}</p>
            : [...products.values()].map((p) => (
              <div key={p.product_id} className="rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                <button type="button" onClick={() => onPick(p.product_id, null, p.product_name)} className="flex w-full items-center gap-2.5 text-start hover:text-[var(--text-primary)]">
                  {p.image_url ? <img src={IMG.thumb(p.image_url)} alt="" className="h-8 w-8 rounded bg-white object-contain p-0.5" /> : <span className="h-8 w-8 rounded bg-[var(--bg-surface)]" />}
                  <span className="truncate text-[12.5px] text-[var(--text-primary)]">{p.product_name}</span>
                </button>
                {p.models.length > 1 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 ps-10">
                    {p.models.map((m) => <button key={m.model_id} type="button" onClick={() => onPick(p.product_id, m.model_id, `${p.product_name} · ${m.model_name}`)} className="px-2 py-0.5 rounded-md border border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]">{m.model_name}</button>)}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </Modal>
  );
}
