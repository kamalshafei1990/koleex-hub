"use client";

/* ---------------------------------------------------------------------------
   Brand Center — a template's studio: /brand-center/templates/<id>
   (plan steps C6 + C9; the owner's rounds of 28–29/09/2026).

   Pick a style → pick an employee (or "my details") → the slots fill from
   Employees in the card's language (name, translated title, lines, photo)
   → edit anything the style allows, in sections → every side at its real
   proportions → Print / Save as PDF at the real size with bleed and crop
   marks. The marks and colours stay the brand's. Nothing is saved; pictures
   chosen here stay in this browser.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { brandCenterLibraryT } from "@/lib/translations/brand-center-library";
import { brandCenterTemplatesT } from "@/lib/translations/brand-center-templates";
import { bc, type BcPerson, type BcProduct, type BcProductHit, type StyleStatus } from "@/lib/brand-center/client";
import { templateById } from "@/lib/brand-center/templates/registry";
import { qrCodes } from "@/lib/brand-center/templates/qr";
import type { FieldDef, TemplateDef, TemplateValue, TemplateValues } from "@/lib/brand-center/templates/types";
import { asLang, list } from "@/lib/brand-center/templates/card/model";
import { titleIn } from "@/lib/brand-center/templates/card/titles";
import { nameIn, titleOf } from "@/lib/brand-center/templates/person";
import PageHeader from "@/components/ui/PageHeader";
import BrandCenterIcon from "@/components/icons/BrandCenterIcon";
import Toggle from "@/components/kds/Toggle";
import { CARD, SELECTED_CHIP } from "@/components/travel/fields";
import { FIELD, fill } from "../ui";
import TemplateSheet from "./TemplateSheet";
import { Field } from "./StudioFields";
import { printTemplate } from "./print";
import SavedTemplates from "./SavedTemplates";
import HtmlPreview from "./HtmlPreview";
import SendToSocial from "./SendToSocial";
import { rasterize, saveBlob } from "./raster";
import { zipStore } from "@/lib/zip-store";
import { preparePhoto } from "./image-input";

const WORDS = { ...brandCenterLibraryT, ...brandCenterTemplatesT };
type T = (k: string) => string;
type People = { state: "loading" } | { state: "error" } | { state: "ready"; scope: "all" | "self"; people: BcPerson[] };

const GROUPS = ["look", "type", "job", "words", "person", "event", "company", "brand", "contacts", "photo", "picture", "details", "issue", "banner", "back", "qr"];

export default function TemplateStudio({ templateId, def: given }: { templateId: string;
  /** A template read at run time (a designer's SVG, C18) instead of one of the registry's. */
  def?: TemplateDef }) {
  const { t } = useTranslation(WORDS);
  const def = given ?? templateById(templateId);
  const [values, setValues] = useState<TemplateValues>(() => ({ ...(def?.defaults ?? {}) }));
  const [person, setPerson] = useState<BcPerson | null>(null);
  const [people, setPeople] = useState<People>({ state: "loading" });
  const [guides, setGuides] = useState(true);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [product, setProduct] = useState<BcProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const everyRef = useRef<HTMLDivElement>(null);

  const wantsPeople = def?.usesPeople !== false;
  const wantsProducts = def?.usesProducts === true;
  /* The owner's approval of each style (30/09/2026): everyone sees the
     approved ones; drafts and retired ones only those who manage Brand Center. */
  const [styles, setStyles] = useState<{ canManage: boolean; statuses: Record<string, StyleStatus> } | null>(null);
  useEffect(() => {
    if (!def) return;
    let alive = true;
    void bc.styles(def.id).then((res) => {
      if (!alive) return;
      const got = res.ok ? res.data : { canManage: false, statuses: {} };
      setStyles(got);
      setValues((o) => onApprovedStyle(def, o, got));
    });
    return () => { alive = false; };
  }, [def]);
  const statusOf = (style: string): StyleStatus => (def ? styleStatus(def, styles?.statuses ?? {}, style) : "approved");
  /* A post makes its photo ready whenever the photo changes: what it was
     shot on (white, black, a cut-out, a scene — the choice stays editable)
     and a copy no larger than a post needs. The product's own slots that
     named the original name the copy too. */
  const photo = typeof values.photo === "string" ? values.photo : "";
  const readsGround = Boolean(def?.fields.some((f) => f.key === "photoOn"));
  useEffect(() => {
    if (!readsGround || !photo) return;
    let alive = true;
    void preparePhoto(photo).then((got) => {
      if (!alive || !got) return;
      setValues((o) => {
        if (o.photo !== photo) return o;
        const next: TemplateValues = { ...o, photoOn: got.ground };
        if (got.url !== photo) for (const [k, val] of Object.entries(next)) if (val === photo) next[k] = got.url;
        return next;
      });
    });
    return () => { alive = false; };
  }, [readsGround, photo]);
  useEffect(() => {
    if (!wantsPeople) return;
    let alive = true;
    void bc.people().then((res) => {
      if (!alive) return;
      setPeople(res.ok ? { state: "ready", scope: res.data.scope, people: res.data.people } : { state: "error" });
    });
    return () => { alive = false; };
  }, [wantsPeople]);

  const qrs = useMemo(() => (def ? qrCodes(def.qrRequests?.(values)) : {}), [def, values]);

  if (!def) {
    return (
      <div className="mx-auto w-full max-w-[1500px] px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <PageHeader title="…" icon={<BrandCenterIcon size={16} />} showTabs={false} backHref="/brand-center" backLabel={t("back.center")} />
        <div className={`${CARD} mt-5 p-6 text-center text-[var(--text-secondary)]`}>{t("studio.notFound")}</div>
      </div>
    );
  }

  const size = def.size(values);
  const fillName = def.fillName?.(values, t) ?? "";
  const heading = fillName ? `${t(def.nameKey)} — ${fillName}` : t(def.nameKey);

  const setMany = (patch: Record<string, TemplateValue>) => {
    setBlocked(null);
    setValues((o) => {
      let next: TemplateValues = { ...o };
      for (const [k, val] of Object.entries(patch)) {
        if (k === "style" && def.restyle) next = def.restyle(next, String(val));
        else if (k === "lang") {
          next = def.relang ? def.relang(next, String(val)) : { ...next, lang: val };
          const lang = asLang(val);
          if (person) next = { ...next, name: nameIn(person, lang), title: titleOf(person, lang) };
          else if (typeof next.titleKey === "string" && next.titleKey) next = { ...next, title: titleIn(next.titleKey, lang) ?? next.title };
        } else if (k === "lang2") {
          const lang2 = asLang(val);
          next = { ...next, lang2: val };
          if (person) next = { ...next, name2: nameIn(person, lang2), title2: titleOf(person, lang2) };
          else if (typeof next.title2Key === "string" && next.title2Key) next = { ...next, title2: titleIn(next.title2Key, lang2) ?? next.title2 };
        } else if (def.rekey?.[k]) next = def.rekey[k](next, val);
        else next[k] = val;
      }
      return next;
    });
  };
  /* A saved template: its look over the defaults; this session's pictures
     stay, and the chosen employee fills in when the template kept no one. */
  const applySaved = (saved: TemplateValues) => {
    setBlocked(null);
    setValues((o) => {
      let next: TemplateValues = { ...def.defaults, ...saved };
      if (typeof o.photo === "string" && o.photo && !next.photo) next.photo = o.photo;
      if (typeof o.dealerLogo === "string" && o.dealerLogo && !next.dealerLogo) next.dealerLogo = o.dealerLogo;
      const pictures = list(o, "qrs").filter((q) => typeof q.image === "string" && q.image);
      next.qrs = list(next, "qrs").map((q) => (q.image ? q : { ...q, image: pictures.find((p) => p.kind === q.kind)?.image ?? "" }));
      if (person && !(typeof saved.name === "string" && saved.name)) next = { ...next, ...(def.fromPerson ? def.fromPerson(person, next) : {}) };
      return styles ? onApprovedStyle(def, next, styles) : next;
    });
  };
  const choose = (p: BcPerson | null) => {
    setPerson(p);
    setBlocked(null);
    if (p) setValues((o) => ({ ...o, ...(def.fromPerson ? def.fromPerson(p, o) : {}) }));
  };
  const chooseProduct = (p: BcProduct | null) => {
    setProduct(p);
    setBlocked(null);
    if (p && def.fromProduct) setValues((o) => ({ ...o, ...def.fromProduct!(p, o) }));
  };
  const clear = () => {
    setPerson(null); setProduct(null); setBlocked(null);
    setValues(() => {
      const base: TemplateValues = { ...def.defaults, lang: values.lang, lang2: values.lang2 };
      const styled = def.restyle ? def.restyle(base, String(values.style)) : { ...base, style: values.style };
      return def.relang ? def.relang(styled, String(values.lang)) : styled;
    });
  };

  const who = typeof values.name === "string" ? values.name.trim() : "";
  const slug = def.digital ? `${heading} · ${size.w} × ${size.h} px` : `${heading} · ${size.w} × ${size.h} mm + ${def.bleed} mm bleed${who ? ` · ${who}` : ""}`;
  const fileBase = [def.fileKey ?? def.id, typeof values.style === "string" ? values.style : "", (who || (def.digital ? fillName : "")).normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 48)]
    .filter(Boolean).join("-");
  const print = () => {
    /* What must be filled is the template's own rule (a proof sheet has no name). */
    const missing = def.check ? def.check(values) : null;
    if (missing) { setBlocked(missing); return; }
    printTemplate({ templateId: def.id, values, fileName: fileBase, slug, ...(given ? { def: given } : {}) });
  };
  /* A post: the page as a picture of exactly its size (every page, one file each). */
  const download = async (type: "image/png" | "image/jpeg") => {
    const missing = def.check ? def.check(values) : null;
    if (missing) { setBlocked(missing); return; }
    const sheets = Array.from(exportRef.current?.querySelectorAll<SVGSVGElement>("svg[data-page]") ?? []);
    if (!sheets.length) return;
    setSaving(true);
    let failed = false;
    for (const svg of sheets) {
      const blob = await rasterize(svg, size.w, size.h, type);
      if (!blob) { failed = true; continue; }
      const page = sheets.length > 1 ? `-${svg.dataset.page}` : "";
      saveBlob(blob, `${fileBase}-${size.w}x${size.h}${page}.${type === "image/png" ? "png" : "jpg"}`);
    }
    setSaving(false);
    if (failed) { console.error("[brand-center] the post could not be made into a picture"); setBlocked("studio.pictureError"); }
  };

  /* One fill, every size (C16): each size drawn from this same fill, saved
     at its exact pixels into one ZIP. */
  const every = def.digital && def.everySize ? def.everySize : null;
  const everyValues = every ? every.values.map((s) => ({ key: s, v: { ...values, [every.key]: s } as TemplateValues })) : [];
  const downloadEvery = async (type: "image/png" | "image/jpeg") => {
    const missing = def.check ? def.check(values) : null;
    if (missing) { setBlocked(missing); return; }
    const sheets = Array.from(everyRef.current?.querySelectorAll<SVGSVGElement>("svg[data-page]") ?? []);
    if (!sheets.length) return;
    setSaving(true);
    const ext = type === "image/png" ? "png" : "jpg";
    const files: Array<{ name: string; data: Blob }> = [];
    for (const [i, svg] of sheets.entries()) {
      const one = def.size(everyValues[i]?.v ?? values);
      const blob = await rasterize(svg, one.w, one.h, type);
      if (blob) files.push({ name: `${fileBase}-${one.w}x${one.h}.${ext}`, data: blob });
    }
    if (files.length) saveBlob(await zipStore(files), `${fileBase}-every-size.zip`);
    setSaving(false);
    if (files.length < sheets.length) { console.error("[brand-center] a size could not be made into a picture"); setBlocked("studio.pictureError"); }
  };

  const shown = def.fields.filter((f) => f.when?.(values) ?? true);
  const styleField = shown.find((f) => f.key === "style");
  const vertical = size.h > size.w;

  return (
    <div className="min-h-full">
      <div className="mx-auto w-full max-w-[1500px] px-4 md:px-6 lg:px-8 py-6 md:py-8 !pb-8">
        <PageHeader title={heading} subtitle={def.html ? t("sig.subtitle") : def.digital ? fill(t("studio.sizePx"), { w: size.w, h: size.h, s: def.safe }) : fill(t("studio.size"), { w: size.w, h: size.h, b: def.bleed, s: def.safe })}
          icon={<BrandCenterIcon size={16} />} showTabs={false} backHref="/brand-center" backLabel={t("back.center")} />

        {styleField && styleField.kind === "choice" ? (
          <StylePicker t={t} def={def} values={values} field={styleField} qrs={qrs} onPick={(s) => setMany({ style: s })}
            canManage={styles?.canManage === true} statusOf={statusOf}
            onStatus={async (style, status) => {
              setStyles((o) => (o ? { ...o, statuses: { ...o.statuses, [style]: status } } : o));
              const res = await bc.setStyle({ templateId: def.id, style, status });
              if (!res.ok) setBlocked("studio.stSaveError");
            }} />
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start">
          <aside data-kx-pane className={`${CARD} px-4 py-4`}>
            <div className="mb-4 border-b border-[var(--border-faint)] pb-4">
              <SavedTemplates t={t} def={def} values={values} onApply={applySaved} />
            </div>
            {def.usesPeople !== false ? <FillFrom t={t} people={people} person={person} onChoose={choose} /> : null}
            {wantsProducts ? <FillFromProduct t={t} product={product} onChoose={chooseProduct} /> : null}
            <div className={`${def.usesPeople !== false || wantsProducts ? "mt-4 " : ""}flex justify-end`}>
              <button type="button" onClick={clear} className="text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("studio.clear")}</button>
            </div>
            {GROUPS.map((g) => {
              const fields = shown.filter((f) => (f.group ?? "look") === g && f.key !== "style");
              if (!fields.length) return null;
              return (
                <section key={g} className="mt-3 border-t border-[var(--border-faint)] pt-3">
                  <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-dim)]">{t(`tpl.group.${g}`)}</h2>
                  <div className="mt-2.5 grid gap-3">
                    {fields.map((f) => <Field key={f.key} t={t} f={f} values={values} setMany={setMany} personPhoto={person?.photo ?? null} />)}
                  </div>
                </section>
              );
            })}
          </aside>

          <section data-kx-pane className={`${CARD} px-4 py-4 lg:sticky lg:top-4`}>
            {def.html ? (
              <>
                <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{heading}</h2>
                <HtmlPreview t={t} def={def} html={def.html} values={values} fileBase={fileBase} />
              </>
            ) : (
            <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{heading}</h2>
              <label className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                {t(def.digital ? "studio.guidesPx" : "studio.guides")}
                <Toggle checked={guides} onChange={setGuides} label={t(def.digital ? "studio.guidesPx" : "studio.guides")} />
              </label>
            </div>
            {guides ? <p className="mt-1 text-[11.5px] text-[var(--text-dim)]">{t(def.digital ? "studio.guidesHintPx" : "studio.guidesHint")}</p> : null}

            <div className={`mt-4 grid gap-5 ${def.digital ? "grid-cols-1" : vertical ? "grid-cols-2" : "xl:grid-cols-2"}`}>
              {def.pages.filter((p) => !def.pagesFor || def.pagesFor(values).includes(p.id)).map((p) => (
                <figure key={p.id} className="m-0">
                  <div className={`mx-auto w-full overflow-hidden rounded-[6px] shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${def.digital ? (vertical ? "max-w-[440px]" : "max-w-[640px]") : vertical ? "max-w-[300px]" : "max-w-[560px]"}`}>
                    <TemplateSheet def={def} values={values} pageId={p.id} qrs={qrs} mode="screen" guides={guides} slug={t(`tpl.page.${p.id}`)} />
                  </div>
                  <figcaption className="mt-2 text-center text-[11.5px] text-[var(--text-dim)]">{t(`tpl.page.${p.id}`)}</figcaption>
                </figure>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {def.digital ? (
                <>
                  <button type="button" disabled={saving} onClick={() => void download("image/png")} className="rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-[13px] font-semibold text-[var(--text-inverted)] disabled:opacity-60">
                    {t(saving ? "studio.saving" : "studio.png")}
                  </button>
                  <button type="button" disabled={saving} onClick={() => void download("image/jpeg")} className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-[13px] font-semibold text-[var(--text-primary)] disabled:opacity-60">
                    {t("studio.jpg")}
                  </button>
                </>
              ) : (
                <button type="button" onClick={print} className="rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-[13px] font-semibold text-[var(--text-inverted)]">
                  {t("studio.print")}
                </button>
              )}
              {blocked ? <span role="alert" className="text-[12px] text-red-500">{t(blocked)}</span> : null}
            </div>
            <p className="mt-2 max-w-2xl text-[11.5px] leading-5 text-[var(--text-dim)]">{t(def.digital ? "studio.pngHint" : "studio.printHint")}</p>
            {def.digital ? (
              <SendToSocial t={t} def={def} values={values} size={size} fileBase={fileBase} onBlocked={setBlocked}
                sheets={() => Array.from(exportRef.current?.querySelectorAll<SVGSVGElement>("svg[data-page]") ?? [])} />
            ) : null}
            {every ? (
              <div className="mt-5 border-t border-[var(--border-faint)] pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("studio.everySize")}</h3>
                  <span className="flex flex-wrap gap-2">
                    <button type="button" disabled={saving} onClick={() => void downloadEvery("image/png")} className="rounded-xl border border-[var(--border-subtle)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--text-primary)] disabled:opacity-60">{t("studio.zipPng")}</button>
                    <button type="button" disabled={saving} onClick={() => void downloadEvery("image/jpeg")} className="rounded-xl border border-[var(--border-subtle)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--text-primary)] disabled:opacity-60">{t("studio.zipJpg")}</button>
                  </span>
                </div>
                <p className="mt-1 max-w-2xl text-[11.5px] leading-5 text-[var(--text-dim)]">{t("studio.everyHint")}</p>
                <div ref={everyRef} className="mt-3 flex flex-wrap items-end gap-3" role="radiogroup" aria-label={t("studio.everySize")}>
                  {everyValues.map(({ key, v }) => {
                    const one = def.size(v);
                    const on = values[every.key] === key;
                    const page = def.pages[0];
                    return (
                      <button key={key} type="button" role="radio" aria-checked={on} onClick={() => setMany({ [every.key]: key })}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 ${on ? SELECTED_CHIP : "border-[var(--border-subtle)] hover:border-[var(--border-strong)]"}`}>
                        <span className="block overflow-hidden rounded-[3px] shadow-[0_3px_10px_rgba(0,0,0,0.3)]" style={{ height: 112, width: Math.round((112 * one.w) / one.h) }}>
                          <TemplateSheet def={def} values={v} pageId={page.id} qrs={qrs} mode="screen" slug={`${one.w} × ${one.h}`} dataPage={key} />
                        </span>
                        <span className="text-[11px] tabular-nums text-[var(--text-secondary)]">{one.w} × {one.h}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {def.digital ? (
              /* the pages as they are saved: no guides, off screen */
              <div ref={exportRef} aria-hidden className="pointer-events-none fixed -left-[10000px] top-0 w-[540px]">
                {def.pages.filter((p) => !def.pagesFor || def.pagesFor(values).includes(p.id)).map((p) => (
                  <TemplateSheet key={p.id} def={def} values={values} pageId={p.id} qrs={qrs} mode="screen" slug={heading} dataPage={p.id} />
                ))}
              </div>
            ) : null}
            </>
            )}

            {def.specKeys ? (
              <div className="mt-4 rounded-xl border border-[var(--border-subtle)] px-3 py-3">
                <p className="text-[12px] font-semibold text-[var(--text-secondary)]">{t(def.html ? "sig.specTitle" : def.digital ? "studio.specPx" : "studio.spec")}</p>
                <ul className="mt-1.5 grid [&>*]:min-w-0 gap-1 text-[12px] text-[var(--text-secondary)]">
                  {def.specKeys(values).map((k) => <li key={k}>{t(k)}</li>)}
                </ul>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

/** The approved styles as small copies of this very card — both sides. */
const STATUSES: StyleStatus[] = ["approved", "draft", "retired"];

/** A style's standing: the saved one, else a draft for a style that starts
 *  as one (the owner's references), else approved. */
function styleStatus(def: TemplateDef, statuses: Record<string, StyleStatus>, style: string): StyleStatus {
  return statuses[style] ?? (def.draftStyles?.includes(style) ? "draft" : "approved");
}

/** Someone who only uses the templates never lands on a style they cannot
 *  pick (a draft default, a saved fill in a retired style): the first
 *  approved style instead. Those who manage Brand Center see every style. */
function onApprovedStyle(def: TemplateDef, v: TemplateValues, s: { canManage: boolean; statuses: Record<string, StyleStatus> }): TemplateValues {
  if (s.canManage) return v;
  const field = def.fields.find((f) => f.key === "style");
  if (!field || field.kind !== "choice") return v;
  const approved = field.options.map((o) => o.value).filter((x) => styleStatus(def, s.statuses, x) === "approved");
  if (!approved.length || approved.includes(String(v.style))) return v;
  return def.restyle ? def.restyle(v, approved[0]) : { ...v, style: approved[0] };
}
const FILTERS = ["all", "approved", "draft", "retired"] as const;

/** The approved styles as small copies of this very card — both sides. The
 *  owner (Brand Center "edit") also sees the drafts and the retired ones and
 *  sets each style's standing under its card. */
function StylePicker({ t, def, values, field, qrs, onPick, canManage, statusOf, onStatus }: {
  t: T; def: TemplateDef; values: TemplateValues; field: Extract<FieldDef, { kind: "choice" }>; qrs: Record<string, boolean[][]>; onPick: (v: string) => void;
  canManage: boolean; statusOf: (style: string) => StyleStatus; onStatus: (style: string, status: StyleStatus) => void;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const options = field.options.filter((o) => {
    const st = statusOf(o.value);
    if (!canManage) return st === "approved";
    return filter === "all" ? st !== "retired" : st === filter;
  });
  const count = (f: (typeof FILTERS)[number]) => field.options.filter((o) => (f === "all" ? statusOf(o.value) !== "retired" : statusOf(o.value) === f)).length;
  return (
    <section data-kx-pane className={`${CARD} mt-5 px-4 py-4`} aria-label={t(field.labelKey)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t(field.labelKey)}</h2>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("studio.stManage")}>
            {FILTERS.map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
                className={`rounded-lg border px-2.5 py-1 text-[11.5px] ${filter === f ? SELECTED_CHIP : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
                {t(`studio.stFilter.${f}`)} <span className="tabular-nums opacity-70">{count(f)}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {canManage ? <p className="mt-1 text-[11.5px] text-[var(--text-dim)]">{t("studio.stHint")}</p> : null}
      {!options.length ? <p className="mt-3 text-[12px] text-[var(--text-dim)]">{t("studio.noStyles")}</p> : null}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-7" role="radiogroup" aria-label={t(field.labelKey)}>
        {options.map((o) => {
          const v = def.restyle ? def.restyle(values, o.value) : { ...values, style: o.value };
          const tall = def.size(v).h > def.size(v).w;
          const on = values.style === o.value;
          const st = statusOf(o.value);
          return (
            <div key={o.value} className="flex flex-col gap-1.5">
              <button type="button" role="radio" aria-checked={on} onClick={() => onPick(o.value)}
                className={`relative flex flex-col items-center gap-2 rounded-xl border px-2 py-2.5 ${on ? SELECTED_CHIP : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"} ${st === "approved" ? "" : "opacity-70"}`}>
                {canManage && st !== "approved" ? (
                  <span className="absolute end-1.5 top-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">{t(`studio.st.${st}`)}</span>
                ) : null}
                {def.html ? <HtmlThumb html={def.html.render(v, { variant: "full", base: window.location.origin, preview: true })} rtl={v.lang === "ar"} /> : (
                <span className="flex h-[64px] w-full items-center justify-center gap-1.5">
                  {def.pages.filter((p) => !def.pagesFor || def.pagesFor(v).includes(p.id)).map((p) => (
                    <span key={p.id} className={`block overflow-hidden rounded-[2px] shadow-[0_3px_10px_rgba(0,0,0,0.35)] ${tall ? "w-[34px]" : "w-[82px]"}`}>
                      <TemplateSheet def={def} values={v} pageId={p.id} qrs={qrs} mode="screen" slug={`${t(o.labelKey)} — ${t(`tpl.page.${p.id}`)}`} />
                    </span>
                  ))}
                </span>
                )}
                <span className="text-center text-[11.5px] font-medium leading-tight">{t(o.labelKey)}</span>
              </button>
              {canManage ? (
                <select aria-label={`${t("studio.stManage")} — ${t(o.labelKey)}`} value={st} onChange={(e) => onStatus(o.value, e.target.value as StyleStatus)}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-transparent px-1.5 py-1 text-[11px] text-[var(--text-secondary)]">
                  {STATUSES.map((x) => <option key={x} value={x}>{t(`studio.st.${x}`)}</option>)}
                </select>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** A small copy of an HTML template (the signature) on a white mail. */
function HtmlThumb({ html, rtl }: { html: string; rtl: boolean }) {
  return (
    /* inline white: a selected chip tints the spans inside it */
    <span className="relative block h-[64px] w-full overflow-hidden rounded-[4px]" style={{ background: "#FFFFFF" }} dir={rtl ? "rtl" : "ltr"}>
      <span aria-hidden className={`pointer-events-none absolute top-2 block w-[760px] ${rtl ? "right-2 origin-top-right" : "left-2 origin-top-left"}`}
        style={{ transform: "scale(0.28)" }} dangerouslySetInnerHTML={{ __html: html }} />
    </span>
  );
}

/** "Fill from Products": a search over the ACTIVE products (name or KOLEEX
 *  model), then the chosen one in full. */
function FillFromProduct({ t, product, onChoose }: { t: T; product: BcProduct | null; onChoose: (p: BcProduct | null) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ q: string; state: "loading" | "error" | "ready"; list: BcProductHit[] }>({ q: "", state: "ready", list: [] });
  const [opening, setOpening] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const term = q.trim();
  useEffect(() => {
    if (!term) return;
    let alive = true;
    const timer = setTimeout(() => {
      setHits((h) => ({ ...h, q: term, state: "loading" }));
      void bc.products(term).then((res) => {
        if (alive) setHits(res.ok ? { q: term, state: "ready", list: res.data.products } : { q: term, state: "error", list: [] });
      });
    }, 220);
    return () => { alive = false; clearTimeout(timer); };
  }, [term]);
  const open = async (hit: BcProductHit) => {
    setOpening(hit.id); setFailed(false);
    const res = await bc.product(hit.id);
    setOpening(null);
    if (!res.ok) { setFailed(true); return; }
    onChoose(res.data.product);
    setQ("");
  };
  return (
    <div>
      <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("studio.fillFromProduct")}</h2>
      {product ? (
        <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] px-2.5 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {product.photo ? <img src={product.photo} alt="" className="h-9 w-9 shrink-0 rounded-md bg-white object-contain" /> : null}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-medium text-[var(--text-primary)]">{product.name}</span>
            {product.model ? <span className="block truncate text-[11.5px] text-[var(--text-dim)]">{product.model}</span> : null}
          </span>
          <button type="button" onClick={() => onChoose(null)} className="text-[11.5px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("studio.remove")}</button>
        </div>
      ) : null}
      <input id="bc-studio-product" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("studio.productSearch")} aria-label={t("studio.productSearch")} className={`${FIELD} mt-2`} />
      {term ? (
        <ul role="listbox" aria-label={t("studio.fillFromProduct")} className="mt-1.5 max-h-[280px] overflow-y-auto rounded-xl border border-[var(--border-subtle)]">
          {hits.state === "loading" || hits.q !== term ? (
            <li className="px-3 py-2 text-[12px] text-[var(--text-dim)]">{t("studio.searching")}</li>
          ) : hits.state === "error" ? (
            <li className="px-3 py-2 text-[12px] text-[var(--text-dim)]">{t("studio.productsError")}</li>
          ) : hits.list.length ? hits.list.map((p) => (
            <li key={p.id} role="option" aria-selected={product?.id === p.id}>
              <button type="button" disabled={opening !== null} onClick={() => void open(p)} className="flex w-full items-center gap-2.5 px-2.5 py-1.5 text-start hover:bg-[var(--bg-surface-subtle)] disabled:opacity-60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.photo ? <img src={p.photo} alt="" loading="lazy" className="h-8 w-8 shrink-0 rounded bg-white object-contain" /> : <span className="h-8 w-8 shrink-0 rounded bg-[var(--bg-surface-subtle)]" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] text-[var(--text-primary)]">{p.name}</span>
                  <span className="block truncate text-[11px] text-[var(--text-dim)]">{[p.model, p.category].filter(Boolean).join(" · ")}</span>
                </span>
                {opening === p.id ? <span className="text-[11px] text-[var(--text-dim)]">…</span> : null}
              </button>
            </li>
          )) : <li className="px-3 py-2 text-[12px] text-[var(--text-dim)]">{t("studio.productNone")}</li>}
        </ul>
      ) : null}
      {failed ? <p role="alert" className="mt-1 text-[11.5px] text-red-500">{t("studio.productsError")}</p> : null}
    </div>
  );
}

function FillFrom({ t, people, person, onChoose }: { t: T; people: People; person: BcPerson | null; onChoose: (p: BcPerson | null) => void }) {
  return (
    <div>
      <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("studio.fillFrom")}</h2>
      <div className="mt-2">
        {people.state === "loading" ? (
          <div className="h-[38px] animate-pulse rounded-xl bg-[var(--bg-surface-subtle)]" />
        ) : people.state === "error" ? (
          <p className="text-[12px] text-[var(--text-dim)]">{t("studio.peopleError")}</p>
        ) : people.scope === "self" ? (
          people.people[0] ? (
            <button type="button" onClick={() => onChoose(people.people[0])} aria-pressed={person?.id === people.people[0].id}
              className={`rounded-xl border px-3 py-2 text-[12.5px] font-medium ${person ? SELECTED_CHIP : "border-[var(--border-subtle)] text-[var(--text-secondary)]"}`}>
              {t("studio.me")}
            </button>
          ) : (
            <p className="text-[12px] text-[var(--text-dim)]">{t("studio.noMe")}</p>
          )
        ) : (
          <select id="bc-studio-person" aria-label={t("studio.pick")} value={person?.id ?? ""} className={FIELD}
            onChange={(e) => onChoose(people.people.find((p) => p.id === e.target.value) ?? null)}>
            <option value="">{t("studio.pick")}</option>
            {people.people.map((p) => (
              <option key={p.id} value={p.id}>{p.title ? `${p.name} — ${p.title}` : p.name}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
