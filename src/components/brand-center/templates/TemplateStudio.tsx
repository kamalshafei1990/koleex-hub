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

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { brandCenterLibraryT } from "@/lib/translations/brand-center-library";
import { brandCenterTemplatesT } from "@/lib/translations/brand-center-templates";
import { bc, type BcPerson } from "@/lib/brand-center/client";
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

const WORDS = { ...brandCenterLibraryT, ...brandCenterTemplatesT };
type T = (k: string) => string;
type People = { state: "loading" } | { state: "error" } | { state: "ready"; scope: "all" | "self"; people: BcPerson[] };

const GROUPS = ["look", "type", "job", "person", "event", "company", "brand", "contacts", "photo", "details", "banner", "back", "qr"];

export default function TemplateStudio({ templateId }: { templateId: string }) {
  const { t } = useTranslation(WORDS);
  const def = templateById(templateId);
  const [values, setValues] = useState<TemplateValues>(() => ({ ...(def?.defaults ?? {}) }));
  const [person, setPerson] = useState<BcPerson | null>(null);
  const [people, setPeople] = useState<People>({ state: "loading" });
  const [guides, setGuides] = useState(true);
  const [blocked, setBlocked] = useState<string | null>(null);

  const wantsPeople = def?.usesPeople !== false;
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
        } else next[k] = val;
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
      return next;
    });
  };
  const choose = (p: BcPerson | null) => {
    setPerson(p);
    setBlocked(null);
    if (p) setValues((o) => ({ ...o, ...(def.fromPerson ? def.fromPerson(p, o) : {}) }));
  };
  const clear = () => {
    setPerson(null); setBlocked(null);
    setValues(() => {
      const base: TemplateValues = { ...def.defaults, lang: values.lang, lang2: values.lang2 };
      const styled = def.restyle ? def.restyle(base, String(values.style)) : { ...base, style: values.style };
      return def.relang ? def.relang(styled, String(values.lang)) : styled;
    });
  };

  const who = typeof values.name === "string" ? values.name.trim() : "";
  const slug = `${heading} · ${size.w} × ${size.h} mm + ${def.bleed} mm bleed${who ? ` · ${who}` : ""}`;
  const fileBase = [def.id, typeof values.style === "string" ? values.style : "", who.normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase()]
    .filter(Boolean).join("-");
  const print = () => {
    /* What must be filled is the template's own rule (a proof sheet has no name). */
    const missing = def.check ? def.check(values) : null;
    if (missing) { setBlocked(missing); return; }
    printTemplate({ templateId: def.id, values, fileName: fileBase, slug });
  };

  const shown = def.fields.filter((f) => f.when?.(values) ?? true);
  const styleField = shown.find((f) => f.key === "style");
  const vertical = size.h > size.w;

  return (
    <div className="min-h-full">
      <div className="mx-auto w-full max-w-[1500px] px-4 md:px-6 lg:px-8 py-6 md:py-8 !pb-8">
        <PageHeader title={heading} subtitle={def.html ? t("sig.subtitle") : fill(t("studio.size"), { w: size.w, h: size.h, b: def.bleed, s: def.safe })}
          icon={<BrandCenterIcon size={16} />} showTabs={false} backHref="/brand-center" backLabel={t("back.center")} />

        {styleField && styleField.kind === "choice" ? (
          <StylePicker t={t} def={def} values={values} field={styleField} qrs={qrs} onPick={(s) => setMany({ style: s })} />
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start">
          <aside data-kx-pane className={`${CARD} px-4 py-4`}>
            <div className="mb-4 border-b border-[var(--border-faint)] pb-4">
              <SavedTemplates t={t} def={def} values={values} onApply={applySaved} />
            </div>
            {def.usesPeople !== false ? <FillFrom t={t} people={people} person={person} onChoose={choose} /> : null}
            <div className={`${def.usesPeople !== false ? "mt-4 " : ""}flex justify-end`}>
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
                {t("studio.guides")}
                <Toggle checked={guides} onChange={setGuides} label={t("studio.guides")} />
              </label>
            </div>
            {guides ? <p className="mt-1 text-[11.5px] text-[var(--text-dim)]">{t("studio.guidesHint")}</p> : null}

            <div className={`mt-4 grid gap-5 ${vertical ? "grid-cols-2" : "xl:grid-cols-2"}`}>
              {def.pages.filter((p) => !def.pagesFor || def.pagesFor(values).includes(p.id)).map((p) => (
                <figure key={p.id} className="m-0">
                  <div className={`mx-auto w-full overflow-hidden rounded-[6px] shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${vertical ? "max-w-[300px]" : "max-w-[560px]"}`}>
                    <TemplateSheet def={def} values={values} pageId={p.id} qrs={qrs} mode="screen" guides={guides} slug={t(`tpl.page.${p.id}`)} />
                  </div>
                  <figcaption className="mt-2 text-center text-[11.5px] text-[var(--text-dim)]">{t(`tpl.page.${p.id}`)}</figcaption>
                </figure>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button type="button" onClick={print} className="rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-[13px] font-semibold text-[var(--text-inverted)]">
                {t("studio.print")}
              </button>
              {blocked ? <span role="alert" className="text-[12px] text-red-500">{t(blocked)}</span> : null}
            </div>
            <p className="mt-2 max-w-2xl text-[11.5px] leading-5 text-[var(--text-dim)]">{t("studio.printHint")}</p>
            </>
            )}

            {def.specKeys ? (
              <div className="mt-4 rounded-xl border border-[var(--border-subtle)] px-3 py-3">
                <p className="text-[12px] font-semibold text-[var(--text-secondary)]">{t(def.html ? "sig.specTitle" : "studio.spec")}</p>
                <ul className="mt-1.5 grid gap-1 text-[12px] text-[var(--text-secondary)]">
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
function StylePicker({ t, def, values, field, qrs, onPick }: {
  t: T; def: TemplateDef; values: TemplateValues; field: Extract<FieldDef, { kind: "choice" }>; qrs: Record<string, boolean[][]>; onPick: (v: string) => void;
}) {
  return (
    <section data-kx-pane className={`${CARD} mt-5 px-4 py-4`} aria-label={t(field.labelKey)}>
      <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t(field.labelKey)}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-7" role="radiogroup" aria-label={t(field.labelKey)}>
        {field.options.map((o) => {
          const v = def.restyle ? def.restyle(values, o.value) : { ...values, style: o.value };
          const tall = def.size(v).h > def.size(v).w;
          const on = values.style === o.value;
          return (
            <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onPick(o.value)}
              className={`flex flex-col items-center gap-2 rounded-xl border px-2 py-2.5 ${on ? SELECTED_CHIP : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"}`}>
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
