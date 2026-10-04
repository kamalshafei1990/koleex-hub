"use client";

/* ---------------------------------------------------------------------------
   builder/SectionForm — the form of one section, by its type. The layout
   and colours are the site's (brand-locked); here the editor fills words,
   photos, links and choices only.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { websiteBuilderT } from "@/lib/translations/website-builder";
import { emptyText, LIMITS, newId, type PageLang, type PageSection, type SectionTone } from "@/lib/website/page-doc";
import { ButtonField, ChoiceField, Field, fieldCls, labelCls, PhotoField, smallBtn, TextField } from "./fields";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import ArrowUpIcon from "@/components/icons/ui/ArrowUpIcon";
import ArrowDownIcon from "@/components/icons/ui/ArrowDownIcon";

type T = (key: string, fallback: string) => string;

/** Move an item of a list up or down. */
function move<X>(list: X[], i: number, by: -1 | 1): X[] {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = list.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function ItemBar({ t, i, n, onMove, onRemove }: { t: T; i: number; n: number; onMove: (by: -1 | 1) => void; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button type="button" className={smallBtn} disabled={i === 0} onClick={() => onMove(-1)} aria-label={t("moveUp", "Move up")}><ArrowUpIcon size={12} /></button>
      <button type="button" className={smallBtn} disabled={i === n - 1} onClick={() => onMove(1)} aria-label={t("moveDown", "Move down")}><ArrowDownIcon size={12} /></button>
      <button type="button" className={smallBtn} onClick={onRemove} aria-label={t("delete", "Delete")}><TrashIcon size={12} /></button>
    </div>
  );
}

export default function SectionForm({ section, lang, onChange }: { section: PageSection; lang: PageLang; onChange: (s: PageSection) => void }) {
  const { t } = useTranslation(websiteBuilderT);
  const set = (patch: Record<string, unknown>) => onChange({ ...section, ...patch } as PageSection);
  const tone = (
    <ChoiceField<SectionTone> label={t("f.tone", "Background")} value={section.tone} onChange={(v) => set({ tone: v })}
      options={[{ value: "dark", label: t("f.dark", "Dark") }, { value: "light", label: t("f.light", "Light") }]} />
  );

  switch (section.type) {
    case "hero":
      return (
        <div className="flex flex-col gap-4">
          <TextField label={t("f.eyebrow", "Small line above the title")} value={section.eyebrow} lang={lang} max={LIMITS.short} onChange={(v) => set({ eyebrow: v })} />
          <TextField label={t("f.title", "Title")} value={section.title} lang={lang} max={LIMITS.short} onChange={(v) => set({ title: v })} />
          <TextField label={t("f.subtitle", "Subtitle")} value={section.subtitle} lang={lang} max={LIMITS.subtitle} multiline rows={2} onChange={(v) => set({ subtitle: v })} />
          <PhotoField label={t("f.image", "Photo")} value={section.image} lang={lang} onChange={(v) => set({ image: v })} />
          <ButtonField label={t("f.button", "Button")} value={section.primary} lang={lang} onChange={(v) => set({ primary: v })} />
          <ButtonField label={t("f.button2", "Second button")} value={section.secondary} lang={lang} onChange={(v) => set({ secondary: v })} />
          {tone}
        </div>
      );
    case "text":
      return (
        <div className="flex flex-col gap-4">
          <TextField label={t("f.title", "Title")} value={section.title} lang={lang} max={LIMITS.short} onChange={(v) => set({ title: v })} />
          <TextField label={t("f.body", "Text")} hint={t("f.bodyHint", "A blank line starts a new paragraph.")} value={section.body} lang={lang} max={LIMITS.body} multiline rows={8} onChange={(v) => set({ body: v })} />
          {tone}
        </div>
      );
    case "imageText":
      return (
        <div className="flex flex-col gap-4">
          <PhotoField label={t("f.image", "Photo")} value={section.image} lang={lang} onChange={(v) => set({ image: v })} />
          <ChoiceField<"left" | "right"> label={t("f.side", "Photo on the")} value={section.side} onChange={(v) => set({ side: v })}
            options={[{ value: "left", label: t("f.left", "Left") }, { value: "right", label: t("f.right", "Right") }]} />
          <TextField label={t("f.title", "Title")} value={section.title} lang={lang} max={LIMITS.short} onChange={(v) => set({ title: v })} />
          <TextField label={t("f.body", "Text")} hint={t("f.bodyHint", "A blank line starts a new paragraph.")} value={section.body} lang={lang} max={LIMITS.body} multiline rows={6} onChange={(v) => set({ body: v })} />
          <ButtonField label={t("f.button", "Button")} value={section.button} lang={lang} onChange={(v) => set({ button: v })} />
          {tone}
        </div>
      );
    case "features":
      return (
        <div className="flex flex-col gap-4">
          <TextField label={t("f.title", "Title")} value={section.title} lang={lang} max={LIMITS.short} onChange={(v) => set({ title: v })} />
          <TextField label={t("f.subtitle", "Subtitle")} value={section.subtitle} lang={lang} max={LIMITS.subtitle} multiline rows={2} onChange={(v) => set({ subtitle: v })} />
          <span className={labelCls}>{t("f.items", "Items")}</span>
          {section.items.map((it, i) => (
            <div key={it.id} className="flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] p-3">
              <ItemBar t={t} i={i} n={section.items.length} onMove={(by) => set({ items: move(section.items, i, by) })} onRemove={() => set({ items: section.items.filter((x) => x.id !== it.id) })} />
              <TextField label={t("f.title", "Title")} value={it.title} lang={lang} max={LIMITS.short} onChange={(v) => set({ items: section.items.map((x) => (x.id === it.id ? { ...x, title: v } : x)) })} />
              <TextField label={t("f.body", "Text")} value={it.body} lang={lang} max={LIMITS.subtitle} multiline rows={2} onChange={(v) => set({ items: section.items.map((x) => (x.id === it.id ? { ...x, body: v } : x)) })} />
            </div>
          ))}
          <div><button type="button" className={smallBtn} disabled={section.items.length >= LIMITS.features} onClick={() => set({ items: [...section.items, { id: newId(), title: emptyText(), body: emptyText() }] })}><PlusIcon size={12} />{t("f.addItem", "Add")}</button></div>
          {tone}
        </div>
      );
    case "numbers":
      return (
        <div className="flex flex-col gap-4">
          <TextField label={t("f.title", "Title")} value={section.title} lang={lang} max={LIMITS.short} onChange={(v) => set({ title: v })} />
          <span className={labelCls}>{t("f.items", "Items")}</span>
          {section.items.map((it, i) => (
            <div key={it.id} className="flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] p-3">
              <ItemBar t={t} i={i} n={section.items.length} onMove={(by) => set({ items: move(section.items, i, by) })} onRemove={() => set({ items: section.items.filter((x) => x.id !== it.id) })} />
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label={t("f.value", "Figure (real only)")}>
                  <input dir="ltr" maxLength={LIMITS.number} value={it.value} placeholder="25+" onChange={(e) => set({ items: section.items.map((x) => (x.id === it.id ? { ...x, value: e.target.value } : x)) })} className={fieldCls} />
                </Field>
                <TextField label={t("f.label", "Label")} value={it.label} lang={lang} max={LIMITS.short} onChange={(v) => set({ items: section.items.map((x) => (x.id === it.id ? { ...x, label: v } : x)) })} />
              </div>
            </div>
          ))}
          <div><button type="button" className={smallBtn} disabled={section.items.length >= LIMITS.numbers} onClick={() => set({ items: [...section.items, { id: newId(), value: "", label: emptyText() }] })}><PlusIcon size={12} />{t("f.addItem", "Add")}</button></div>
          {tone}
        </div>
      );
    case "products":
      return (
        <div className="flex flex-col gap-4">
          <TextField label={t("f.title", "Title")} value={section.title} lang={lang} max={LIMITS.short} onChange={(v) => set({ title: v })} />
          <TextField label={t("f.subtitle", "Subtitle")} value={section.subtitle} lang={lang} max={LIMITS.subtitle} multiline rows={2} onChange={(v) => set({ subtitle: v })} />
          <ChoiceField<"featured" | "category" | "manual"> label={t("f.source", "Show")} value={section.source} onChange={(v) => set({ source: v })}
            options={[{ value: "featured", label: t("f.featured", "Featured products") }, { value: "category", label: t("f.category", "A category") }, { value: "manual", label: t("f.manual", "Products I pick") }]} />
          {section.source === "category" ? <CategoryPicker t={t} value={section.category} onChange={(v) => set({ category: v })} /> : null}
          {section.source === "manual" ? <ProductPicker t={t} value={section.slugs} onChange={(v) => set({ slugs: v })} /> : null}
          {section.source !== "manual" ? (
            <Field label={t("f.limit", "How many")}>
              <input type="number" dir="ltr" min={LIMITS.productsMin} max={LIMITS.productsMax} value={section.limit} onChange={(e) => set({ limit: Math.max(LIMITS.productsMin, Math.min(LIMITS.productsMax, Number(e.target.value) || 6)) })} className={`${fieldCls} w-28`} />
            </Field>
          ) : null}
          {tone}
        </div>
      );
    case "gallery":
      return (
        <div className="flex flex-col gap-4">
          <TextField label={t("f.title", "Title")} value={section.title} lang={lang} max={LIMITS.short} onChange={(v) => set({ title: v })} />
          <span className={labelCls}>{t("f.photos", "Photos")}</span>
          {section.images.map((img, i) => (
            <div key={`${img.url}-${i}`} className="flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] p-3">
              <ItemBar t={t} i={i} n={section.images.length} onMove={(by) => set({ images: move(section.images, i, by) })} onRemove={() => set({ images: section.images.filter((_, j) => j !== i) })} />
              <PhotoField label={`${t("f.image", "Photo")} ${i + 1}`} value={img} lang={lang} onChange={(v) => set({ images: v ? section.images.map((x, j) => (j === i ? v : x)) : section.images.filter((_, j) => j !== i) })} />
            </div>
          ))}
          {section.images.length < LIMITS.gallery ? (
            <PhotoField label={t("f.upload", "Upload photo")} value={null} lang={lang} onChange={(v) => { if (v) set({ images: [...section.images, v] }); }} />
          ) : null}
          {tone}
        </div>
      );
    case "faq":
      return (
        <div className="flex flex-col gap-4">
          <TextField label={t("f.title", "Title")} value={section.title} lang={lang} max={LIMITS.short} onChange={(v) => set({ title: v })} />
          <span className={labelCls}>{t("f.items", "Items")}</span>
          {section.items.map((it, i) => (
            <div key={it.id} className="flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] p-3">
              <ItemBar t={t} i={i} n={section.items.length} onMove={(by) => set({ items: move(section.items, i, by) })} onRemove={() => set({ items: section.items.filter((x) => x.id !== it.id) })} />
              <TextField label={t("f.question", "Question")} value={it.q} lang={lang} max={LIMITS.short} onChange={(v) => set({ items: section.items.map((x) => (x.id === it.id ? { ...x, q: v } : x)) })} />
              <TextField label={t("f.answer", "Answer")} value={it.a} lang={lang} max={LIMITS.answer} multiline rows={3} onChange={(v) => set({ items: section.items.map((x) => (x.id === it.id ? { ...x, a: v } : x)) })} />
            </div>
          ))}
          <div><button type="button" className={smallBtn} disabled={section.items.length >= LIMITS.faq} onClick={() => set({ items: [...section.items, { id: newId(), q: emptyText(), a: emptyText() }] })}><PlusIcon size={12} />{t("f.addItem", "Add")}</button></div>
          {tone}
        </div>
      );
    case "cta":
      return (
        <div className="flex flex-col gap-4">
          <TextField label={t("f.title", "Title")} value={section.title} lang={lang} max={LIMITS.short} onChange={(v) => set({ title: v })} />
          <TextField label={t("f.body", "Text")} value={section.body} lang={lang} max={LIMITS.subtitle} multiline rows={2} onChange={(v) => set({ body: v })} />
          <ButtonField label={t("f.button", "Button")} value={section.button} lang={lang} onChange={(v) => set({ button: v })} />
          {tone}
        </div>
      );
  }
}

/* ── Products ───────────────────────────────────────────────────────────── */

function CategoryPicker({ t, value, onChange }: { t: T; value: string | null; onChange: (v: string | null) => void }) {
  const [cats, setCats] = useState<Array<{ slug: string; name: string; division: string; count: number }> | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/website/catalog", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (live) setCats((j?.categories as typeof cats) ?? []); }).catch(() => { if (live) setCats([]); });
    return () => { live = false; };
  }, []);
  return (
    <Field label={t("f.chooseCategory", "Choose the category")}>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={fieldCls} disabled={!cats}>
        <option value="">—</option>
        {(cats ?? []).map((c) => <option key={c.slug} value={c.slug}>{c.division} › {c.name} ({c.count})</option>)}
      </select>
    </Field>
  );
}

function ProductPicker({ t, value, onChange }: { t: T; value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  /* The last answer, with the words it answers — shown only while they are
     still the words in the box (no state set from the effect's body). */
  const [found, setFound] = useState<{ term: string; items: Array<{ slug: string; name: string; image: string | null }> } | null>(null);
  const term = q.trim();
  const results = term.length >= 2 && found?.term === term ? found.items : null;
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    const missing = value.filter((s) => !names[s]);
    if (!missing.length) return;
    let live = true;
    fetch(`/api/website/catalog?slugs=${encodeURIComponent(missing.join(","))}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!live || !j?.products) return;
      setNames((n) => ({ ...n, ...Object.fromEntries((j.products as Array<{ slug: string; name: string }>).map((p) => [p.slug, p.name])) }));
    }).catch(() => {});
    return () => { live = false; };
  }, [value, names]);
  useEffect(() => {
    if (term.length < 2) return;
    let live = true;
    const h = setTimeout(() => {
      fetch(`/api/website/catalog?q=${encodeURIComponent(term)}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (live) setFound({ term, items: (j?.products as Array<{ slug: string; name: string; image: string | null }>) ?? [] }); })
        .catch(() => { if (live) setFound({ term, items: [] }); });
    }, 300);
    return () => { live = false; clearTimeout(h); };
  }, [term]);
  return (
    <div className="flex flex-col gap-2">
      {value.map((slug, i) => (
        <div key={slug} className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-[13px]">{names[slug] ?? slug}</span>
          <ItemBar t={t} i={i} n={value.length} onMove={(by) => onChange(move(value, i, by))} onRemove={() => onChange(value.filter((s) => s !== slug))} />
        </div>
      ))}
      {value.length < LIMITS.manualProducts ? (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("f.search", "Search products by name or model")} className={fieldCls} />
          {results && results.length === 0 ? <span className="text-[12px] text-[var(--text-dim)]">{t("f.noResults", "No product matches.")}</span> : null}
          {results && results.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {results.filter((r) => !value.includes(r.slug)).map((r) => (
                <li key={r.slug}>
                  <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[13px] hover:bg-[var(--bg-surface-hover)]"
                    onClick={() => { setNames((n) => ({ ...n, [r.slug]: r.name })); onChange([...value, r.slug]); }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.image ? <img src={r.image} alt="" className="h-8 w-8 rounded object-contain bg-[var(--bg-surface-subtle)]" /> : <span className="h-8 w-8 rounded bg-[var(--bg-surface-subtle)]" />}
                    <span className="truncate">{r.name}</span>
                    <PlusIcon size={12} className="ms-auto shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
