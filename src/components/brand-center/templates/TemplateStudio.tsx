"use client";

/* ---------------------------------------------------------------------------
   Brand Center — a template's studio: /brand-center/templates/<id>
   (plan steps C6 + C9; the owner's round of 28/09/2026).

   Pick a style → pick an employee (or "my details") → the slots fill from
   Employees in the card's language (name, translated title, photo) → edit
   any of them → every side at its real proportions → Print / Save as PDF at
   the real size with bleed and crop marks. The design is locked: only the
   slots and the approved styles change. Nothing is saved; pictures chosen
   here stay in this browser.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { brandCenterLibraryT } from "@/lib/translations/brand-center-library";
import { brandCenterTemplatesT } from "@/lib/translations/brand-center-templates";
import { bc, type BcPerson } from "@/lib/brand-center/client";
import { templateById } from "@/lib/brand-center/templates/registry";
import { qrModules } from "@/lib/brand-center/templates/qr";
import type { FieldDef, TemplateDef, TemplateValues } from "@/lib/brand-center/templates/types";
import PageHeader from "@/components/ui/PageHeader";
import BrandCenterIcon from "@/components/icons/BrandCenterIcon";
import Toggle from "@/components/kds/Toggle";
import { CARD, SELECTED_CHIP } from "@/components/travel/fields";
import { FIELD, fill } from "../ui";
import TemplateSheet from "./TemplateSheet";
import { printTemplate } from "./print";
import { readImage } from "./image-input";

const WORDS = { ...brandCenterLibraryT, ...brandCenterTemplatesT };
type T = (k: string) => string;
type People = { state: "loading" } | { state: "error" } | { state: "ready"; scope: "all" | "self"; people: BcPerson[] };

const ARABIC = /[\u0600-\u06FF]/;
const CJK = /[\u2E80-\u9FFF]/;

/** A mobile in the book's international format (ch. 91: "+86 130 7380
 *  0720") when it is a Chinese or Egyptian mobile; anything else as typed. */
function formatMobile(raw: string): string {
  const d = raw.replace(/[^\d+]/g, "");
  let m = d.match(/^(?:\+|00)?86(1\d{2})(\d{4})(\d{4})$/);
  if (m) return `+86 ${m[1]} ${m[2]} ${m[3]}`;
  m = d.match(/^(?:\+|00)?20(1\d)(\d{4})(\d{4})$/);
  if (m) return `+20 ${m[1]} ${m[2]} ${m[3]}`;
  return raw.trim();
}

/** The name as in the passport (ch. 91) — no "Mr.", "Dr." or "Eng." before it. */
const HONORIFIC = /^(?:mr|mrs|ms|miss|dr|eng|prof)\.?\s+/i;

/** What a person puts on a card in a language: the other-script name only
 *  when it is in that language's script, the position's translated title. */
function personValues(p: BcPerson, lang: unknown): TemplateValues {
  const alt = p.nameAlt ?? "";
  const name = (lang === "zh" && CJK.test(alt)) || (lang === "ar" && ARABIC.test(alt)) ? alt : p.name.replace(HONORIFIC, "");
  const title = (lang === "zh" ? p.titleZh : lang === "ar" ? p.titleAr : null) || p.title || "";
  return { name, title, mobile: p.mobile ? formatMobile(p.mobile) : "", email: p.email ?? "" };
}

export default function TemplateStudio({ templateId }: { templateId: string }) {
  const { t } = useTranslation(WORDS);
  const def = templateById(templateId);
  const [values, setValues] = useState<TemplateValues>(() => ({ ...(def?.defaults ?? {}) }));
  const [person, setPerson] = useState<BcPerson | null>(null);
  const [people, setPeople] = useState<People>({ state: "loading" });
  const [guides, setGuides] = useState(true);
  const [blocked, setBlocked] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void bc.people().then((res) => {
      if (!alive) return;
      setPeople(res.ok ? { state: "ready", scope: res.data.scope, people: res.data.people } : { state: "error" });
    });
    return () => { alive = false; };
  }, []);

  const qr = useMemo(() => (def ? qrModules(def.qrText?.(values)) : null), [def, values]);

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
  const set = (key: string, v: string | boolean) => { setBlocked(null); setValues((o) => ({ ...o, [key]: v })); };
  const choose = (p: BcPerson | null) => {
    setPerson(p);
    setBlocked(null);
    if (!p) return;
    setValues((o) => ({
      ...o,
      ...personValues(p, o.lang),
      /* The Hub photo, unless a picture was chosen on this computer. */
      ...(typeof o.photo === "string" && o.photo.startsWith("data:") ? {} : { photo: p.photo ?? "" }),
    }));
  };
  const setLang = (lang: string) => setValues((o) => {
    const next = def.relang ? def.relang(o, lang) : { ...o, lang };
    return person ? { ...next, ...personValues(person, lang) } : next;
  });
  const clear = () => { setPerson(null); setBlocked(null); setValues({ ...def.defaults, style: values.style, lang: values.lang }); };

  const who = typeof values.name === "string" ? values.name.trim() : "";
  const slug = `${heading} · ${size.w} × ${size.h} mm + ${def.bleed} mm bleed${who ? ` · ${who}` : ""}`;
  const fileBase = [def.id, typeof values.style === "string" ? values.style : "", who.normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase()]
    .filter(Boolean).join("-");

  const print = () => {
    const missing = def.check?.(values) ?? (who ? null : "studio.needName");
    if (missing) { setBlocked(missing); return; }
    printTemplate({ templateId: def.id, values, fileName: fileBase, slug });
  };

  const shown = def.fields.filter((f) => f.when?.(values) ?? true);
  const styleField = shown.find((f) => f.key === "style");
  const vertical = size.h > size.w;

  return (
    <div className="min-h-full">
      <div className="mx-auto w-full max-w-[1500px] px-4 md:px-6 lg:px-8 py-6 md:py-8 !pb-8">
        <PageHeader title={heading} subtitle={fill(t("studio.size"), { w: size.w, h: size.h, b: def.bleed, s: def.safe })}
          icon={<BrandCenterIcon size={16} />} showTabs={false} backHref="/brand-center" backLabel={t("back.center")} />

        {styleField && styleField.kind === "choice" ? (
          <StylePicker t={t} def={def} values={values} field={styleField} onPick={(s) => set("style", s)} />
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start">
          <aside data-kx-pane className={`${CARD} px-4 py-4`}>
            <FillFrom t={t} people={people} person={person} onChoose={choose} />

            <div className="mt-5 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("studio.details")}</h2>
              <button type="button" onClick={clear} className="text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("studio.clear")}</button>
            </div>
            <div className="mt-2 grid gap-3">
              {shown.filter((f) => f.key !== "style").map((f) => (
                <Field key={f.key} t={t} f={f} value={values[f.key]} personPhoto={person?.photo ?? null}
                  onChange={(v) => (f.key === "lang" ? setLang(String(v)) : set(f.key, v))} />
              ))}
            </div>
          </aside>

          <section data-kx-pane className={`${CARD} px-4 py-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{heading}</h2>
              <label className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                {t("studio.guides")}
                <Toggle checked={guides} onChange={setGuides} label={t("studio.guides")} />
              </label>
            </div>
            {guides ? <p className="mt-1 text-[11.5px] text-[var(--text-dim)]">{t("studio.guidesHint")}</p> : null}

            <div className={`mt-4 grid gap-5 ${vertical ? "grid-cols-2" : "xl:grid-cols-2"}`}>
              {def.pages.map((p) => (
                <figure key={p.id} className="m-0">
                  <div className={`mx-auto w-full overflow-hidden rounded-[6px] shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${vertical ? "max-w-[300px]" : "max-w-[560px]"}`}>
                    <TemplateSheet def={def} values={values} pageId={p.id} qr={qr} mode="screen" guides={guides} slug={t(`tpl.page.${p.id}`)} />
                  </div>
                  <figcaption className="mt-2 text-center text-[11.5px] text-[var(--text-dim)]">{t(`tpl.page.${p.id}`)}</figcaption>
                </figure>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button type="button" onClick={print}
                className="rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-[13px] font-semibold text-[var(--text-inverted)]">
                {t("studio.print")}
              </button>
              {blocked ? <span role="alert" className="text-[12px] text-red-500">{t(blocked)}</span> : null}
            </div>
            <p className="mt-2 max-w-2xl text-[11.5px] leading-5 text-[var(--text-dim)]">{t("studio.printHint")}</p>

            {def.specKeys ? (
              <div className="mt-4 rounded-xl border border-[var(--border-subtle)] px-3 py-3">
                <p className="text-[12px] font-semibold text-[var(--text-secondary)]">{t("studio.spec")}</p>
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

/** The approved styles as small fronts of this very card. */
function StylePicker({ t, def, values, field, onPick }: { t: T; def: TemplateDef; values: TemplateValues; field: Extract<FieldDef, { kind: "choice" }>; onPick: (v: string) => void }) {
  return (
    <section data-kx-pane className={`${CARD} mt-5 px-4 py-4`} aria-label={t(field.labelKey)}>
      <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t(field.labelKey)}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7" role="radiogroup" aria-label={t(field.labelKey)}>
        {field.options.map((o) => {
          const v = { ...values, style: o.value };
          const tall = def.size(v).h > def.size(v).w;
          const on = values.style === o.value;
          return (
            <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onPick(o.value)}
              className={`flex flex-col items-center gap-2 rounded-xl border px-2 py-2.5 ${on ? SELECTED_CHIP : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"}`}>
              <span className="flex h-[74px] w-full items-center justify-center">
                <span className={`block overflow-hidden rounded-[3px] shadow-[0_4px_12px_rgba(0,0,0,0.35)] ${tall ? "w-[42px]" : "w-[112px]"}`}>
                  <TemplateSheet def={def} values={v} pageId="front" qr={null} mode="screen" slug={t(o.labelKey)} />
                </span>
              </span>
              <span className="text-center text-[11.5px] font-medium leading-tight">{t(o.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </section>
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

function Field({ t, f, value, onChange, personPhoto }: { t: T; f: FieldDef; value: string | boolean | undefined; onChange: (v: string | boolean) => void; personPhoto: string | null }) {
  const id = `bc-tpl-${f.key}`;
  if (f.kind === "switch") {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12.5px] text-[var(--text-secondary)]">{t(f.labelKey)}</span>
        <Toggle checked={!!value} onChange={onChange} label={t(f.labelKey)} />
      </div>
    );
  }
  if (f.kind === "choice") {
    return (
      <div>
        <span className="text-[11.5px] text-[var(--text-dim)]">{t(f.labelKey)}</span>
        <div className="mt-1 flex flex-wrap gap-1.5" role="radiogroup" aria-label={t(f.labelKey)}>
          {f.options.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
              className={`rounded-lg border px-2.5 py-1 text-[12px] ${value === o.value ? SELECTED_CHIP : "border-[var(--border-subtle)] text-[var(--text-secondary)]"}`}>
              {t(o.labelKey)}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (f.kind === "image") return <ImageField t={t} f={f} value={typeof value === "string" ? value : ""} onChange={onChange} personPhoto={f.fromPerson ? personPhoto : null} />;
  return (
    <label htmlFor={id} className="block">
      <span className="text-[11.5px] text-[var(--text-dim)]">{t(f.labelKey)}</span>
      <input id={id} dir="auto" value={typeof value === "string" ? value : ""} maxLength={f.max} placeholder={f.placeholder}
        onChange={(e) => onChange(e.target.value)} className={`${FIELD} mt-1`} />
    </label>
  );
}

function ImageField({ t, f, value, onChange, personPhoto }: { t: T; f: Extract<FieldDef, { kind: "image" }>; value: string; onChange: (v: string) => void; personPhoto: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setFailed(false);
    const url = await readImage(file, f.fromPerson ? "photo" : "graphic");
    setBusy(false);
    if (url) onChange(url); else setFailed(true);
  };
  const small = "rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50";
  return (
    <div>
      <span className="text-[11.5px] text-[var(--text-dim)]">{t(f.labelKey)}</span>
      <div className="mt-1 flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : null}
        </span>
        <span className="flex flex-wrap gap-1.5">
          <button type="button" className={small} disabled={busy} onClick={() => input.current?.click()}>{value ? t("studio.replace") : t("studio.upload")}</button>
          {personPhoto && value !== personPhoto ? <button type="button" className={small} onClick={() => onChange(personPhoto)}>{t("studio.usePhoto")}</button> : null}
          {value ? <button type="button" className={small} onClick={() => onChange("")}>{t("studio.remove")}</button> : null}
        </span>
        <input ref={input} id={`bc-tpl-${f.key}`} type="file" accept="image/*" className="hidden"
          onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {f.hintKey ? <p className="mt-1 text-[11px] leading-4 text-[var(--text-dim)]">{t(f.hintKey)}</p> : null}
      {failed ? <p role="alert" className="mt-1 text-[11.5px] text-red-500">{t("studio.imageError")}</p> : null}
    </div>
  );
}
