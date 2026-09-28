"use client";

/* ---------------------------------------------------------------------------
   Brand Center — a template's studio: /brand-center/templates/<id>
   (plan steps C6 + C9).

   Pick an employee (or "my details") → the slots fill from Employees → edit
   any of them → see every side at its real proportions → Print / Save as
   PDF at the real size with bleed and crop marks, or take each side as SVG.
   The design is locked: only the slots change. Nothing is saved; the one
   request is the people list, and it only returns what a card prints.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { brandCenterLibraryT } from "@/lib/translations/brand-center-library";
import { brandCenterTemplatesT } from "@/lib/translations/brand-center-templates";
import { bc, type BcPerson } from "@/lib/brand-center/client";
import { templateById } from "@/lib/brand-center/templates/registry";
import { qrModules } from "@/lib/brand-center/templates/qr";
import type { FieldDef, TemplateValues } from "@/lib/brand-center/templates/types";
import PageHeader from "@/components/ui/PageHeader";
import BrandCenterIcon from "@/components/icons/BrandCenterIcon";
import Toggle from "@/components/kds/Toggle";
import { CARD, SELECTED_CHIP } from "@/components/travel/fields";
import { FIELD, fill } from "../ui";
import TemplateSheet from "./TemplateSheet";
import { printTemplate } from "./print";

const WORDS = { ...brandCenterLibraryT, ...brandCenterTemplatesT };

type People = { state: "loading" } | { state: "error" } | { state: "ready"; scope: "all" | "self"; people: BcPerson[] };

export default function TemplateStudio({ templateId }: { templateId: string }) {
  const { t } = useTranslation(WORDS);
  const def = templateById(templateId);
  const [values, setValues] = useState<TemplateValues>(() => ({ ...(def?.defaults ?? {}) }));
  const [person, setPerson] = useState<BcPerson | null>(null);
  const [people, setPeople] = useState<People>({ state: "loading" });
  const [guides, setGuides] = useState(true);
  const [needName, setNeedName] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

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
  const set = (key: string, v: string | boolean) => { setValues((o) => ({ ...o, [key]: v })); if (key === "name") setNeedName(false); };
  const nameFor = (p: BcPerson, lang: unknown) => (lang !== "en" && p.nameAlt ? p.nameAlt : p.name);
  const choose = (p: BcPerson | null) => {
    setPerson(p);
    setNeedName(false);
    if (!p) return;
    setValues((o) => ({ ...o, name: nameFor(p, o.lang), title: p.title ?? "", mobile: p.mobile ?? "", email: p.email ?? "" }));
  };
  const setLang = (lang: string) => setValues((o) => ({ ...o, lang, ...(person ? { name: nameFor(person, lang) } : {}) }));
  const clear = () => { setPerson(null); setValues({ ...def.defaults }); };

  const who = typeof values.name === "string" && values.name.trim() ? values.name.trim() : "";
  const fileBase = `${templateId}${who ? `-${who.normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase()}` : ""}`;
  const slug = `${t(def.nameKey)} · ${size.w} × ${size.h} mm + ${def.bleed} mm bleed${who ? ` · ${who}` : ""}`;

  const print = () => {
    if (!who) { setNeedName(true); return; }
    printTemplate({ templateId, values, fileName: fileBase, slug });
  };
  const downloadSvg = (pageId: string) => {
    if (!who) { setNeedName(true); return; }
    const svg = printRef.current?.querySelector(`[data-page="${pageId}"] svg`);
    if (!svg) return;
    const text = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`;
    const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${fileBase}-${pageId}.svg`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="min-h-full">
      <div className="mx-auto w-full max-w-[1500px] px-4 md:px-6 lg:px-8 py-6 md:py-8 !pb-8">
        <PageHeader title={t(def.nameKey)} subtitle={fill(t("studio.size"), { w: size.w, h: size.h, b: def.bleed, s: def.safe })}
          icon={<BrandCenterIcon size={16} />} showTabs={false} backHref="/brand-center" backLabel={t("back.center")} />

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start">
          <aside data-kx-pane className={`${CARD} px-4 py-4`}>
            <FillFrom t={t} people={people} person={person} onChoose={choose} />

            <div className="mt-5 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("studio.details")}</h2>
              <button type="button" onClick={clear} className="text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("studio.clear")}</button>
            </div>
            <div className="mt-2 grid gap-3">
              {def.fields.map((f) => (
                <Field key={f.key} t={t} f={f} value={values[f.key]} onChange={(v) => (f.key === "lang" ? setLang(String(v)) : set(f.key, v))} />
              ))}
            </div>
          </aside>

          <section data-kx-pane className={`${CARD} px-4 py-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("studio.preview")}</h2>
              <label className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                {t("studio.guides")}
                <Toggle checked={guides} onChange={setGuides} label={t("studio.guides")} />
              </label>
            </div>
            {guides ? <p className="mt-1 text-[11.5px] text-[var(--text-dim)]">{t("studio.guidesHint")}</p> : null}

            <div className="mt-4 grid gap-5 xl:grid-cols-2">
              {def.pages.map((p) => (
                <figure key={p.id} className="m-0">
                  <div className="mx-auto w-full max-w-[560px] overflow-hidden rounded-[6px] shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
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
              {def.pages.map((p) => (
                <button key={p.id} type="button" onClick={() => downloadSvg(p.id)}
                  className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  {fill(t("studio.svg"), { page: t(`tpl.page.${p.id}`) })}
                </button>
              ))}
              {needName ? <span role="alert" className="text-[12px] text-red-500">{t("studio.needName")}</span> : null}
            </div>
            <p className="mt-2 max-w-2xl text-[11.5px] leading-5 text-[var(--text-dim)]">{t("studio.printHint")}</p>

            <div className="mt-4 rounded-xl border border-[var(--border-subtle)] px-3 py-3">
              <p className="text-[12px] font-semibold text-[var(--text-secondary)]">{t("studio.spec")}</p>
              <ul className="mt-1.5 grid gap-1 text-[12px] text-[var(--text-secondary)]">
                {["front", "back", "paper", "never"].map((k) => <li key={k}>{t(`studio.spec.${k}`)}</li>)}
              </ul>
            </div>

            {/* The print-size sides, off screen — what "SVG" downloads. */}
            <div ref={printRef} aria-hidden className="pointer-events-none fixed -left-[10000px] top-0">
              {def.pages.map((p) => (
                <div key={p.id} data-page={p.id}>
                  <TemplateSheet def={def} values={values} pageId={p.id} qr={qr} mode="print" slug={`${slug} · ${t(`tpl.page.${p.id}`)}`} />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function FillFrom({ t, people, person, onChoose }: { t: (k: string) => string; people: People; person: BcPerson | null; onChoose: (p: BcPerson | null) => void }) {
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

function Field({ t, f, value, onChange }: { t: (k: string) => string; f: FieldDef; value: string | boolean | undefined; onChange: (v: string | boolean) => void }) {
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
  return (
    <label htmlFor={id} className="block">
      <span className="text-[11.5px] text-[var(--text-dim)]">{t(f.labelKey)}</span>
      <input id={id} dir="auto" value={typeof value === "string" ? value : ""} maxLength={f.max} placeholder={f.placeholder}
        onChange={(e) => onChange(e.target.value)} className={`${FIELD} mt-1`} />
    </label>
  );
}
