/* ---------------------------------------------------------------------------
   website/page-doc — a page of the public site as the Website app builds it
   (Phase 3 step 3, owner 30/09/2026): an ordered list of BRAND-LOCKED
   sections, each with its words in English, Arabic and Chinese. The layout,
   type and colours of every section are the site's; the editor fills words,
   photos, links and choices only. Saved as a draft (pages.draft) and
   published as a copy (pages.published) that the site reads through the
   bridge.

   Nine section types in this first version (owner's pick): hero, text,
   image + text, features, numbers, products (from the Hub), gallery, FAQ,
   call to action.

   A word missing in Arabic or Chinese shows in English on the site (owner's
   pick) — so only English is required to publish.

   cleanPageDoc() is the one gate for anything saved: it keeps only the
   known shape, cuts every text to its length, and drops unsafe links and
   photos that are not the Hub's own. The site renders text as text (never
   HTML), so the page cannot carry markup.
   --------------------------------------------------------------------------- */

import { publicUrl } from "@/lib/storage-url";

export const PAGE_LANGS = ["en", "ar", "zh"] as const;
export type PageLang = (typeof PAGE_LANGS)[number];

/** A text in the three languages ("" = not written yet). */
export interface I18nText { en: string; ar: string; zh: string }
export interface PageButton { label: I18nText; href: string }
export interface PageImage { url: string; alt: I18nText }
export type SectionTone = "dark" | "light";

export const SECTION_TYPES = ["hero", "text", "imageText", "features", "numbers", "products", "gallery", "faq", "cta"] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

interface SectionBase { id: string; hidden: boolean; tone: SectionTone }
export interface HeroSection extends SectionBase { type: "hero"; eyebrow: I18nText; title: I18nText; subtitle: I18nText; image: PageImage | null; primary: PageButton | null; secondary: PageButton | null }
export interface TextSection extends SectionBase { type: "text"; title: I18nText; body: I18nText }
export interface ImageTextSection extends SectionBase { type: "imageText"; title: I18nText; body: I18nText; image: PageImage | null; side: "left" | "right"; button: PageButton | null }
export interface FeatureItem { id: string; title: I18nText; body: I18nText }
export interface FeaturesSection extends SectionBase { type: "features"; title: I18nText; subtitle: I18nText; items: FeatureItem[] }
export interface NumberItem { id: string; value: string; label: I18nText }
export interface NumbersSection extends SectionBase { type: "numbers"; title: I18nText; items: NumberItem[] }
export type ProductSource = "featured" | "category" | "manual";
export interface ProductsSection extends SectionBase { type: "products"; title: I18nText; subtitle: I18nText; source: ProductSource; category: string | null; slugs: string[]; limit: number }
export interface GallerySection extends SectionBase { type: "gallery"; title: I18nText; images: PageImage[] }
export interface FaqItem { id: string; q: I18nText; a: I18nText }
export interface FaqSection extends SectionBase { type: "faq"; title: I18nText; items: FaqItem[] }
export interface CtaSection extends SectionBase { type: "cta"; title: I18nText; body: I18nText; button: PageButton | null }

export type PageSection = HeroSection | TextSection | ImageTextSection | FeaturesSection | NumbersSection | ProductsSection | GallerySection | FaqSection | CtaSection;

export interface PageDoc {
  v: 1;
  sections: PageSection[];
  seo: { title: I18nText; description: I18nText };
}

/* ── Limits ─────────────────────────────────────────────────────────────── */

export const LIMITS = {
  sections: 30,
  short: 160,        // eyebrow, titles, labels, button labels
  subtitle: 400,
  body: 5000,
  answer: 2000,
  alt: 200,
  number: 24,        // a figure: "25+", "2004", "40,000 m²"
  seoTitle: 70,
  seoDescription: 200,
  href: 500,
  features: 6,
  numbers: 4,
  gallery: 12,
  faq: 20,
  manualProducts: 12,
  productsMin: 3,
  productsMax: 12,
} as const;

/* ── Building blocks ────────────────────────────────────────────────────── */

export const emptyText = (): I18nText => ({ en: "", ar: "", zh: "" });

/** A short random id for a section or an item (the editor's key). */
export function newId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  const bytes = typeof crypto !== "undefined" && "getRandomValues" in crypto
    ? crypto.getRandomValues(new Uint8Array(12))
    : Uint8Array.from({ length: 12 }, () => Math.floor(Math.random() * 256));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export function newSection(type: SectionType): PageSection {
  const base = { id: newId(), hidden: false, tone: "dark" as SectionTone };
  switch (type) {
    case "hero": return { ...base, type, eyebrow: emptyText(), title: emptyText(), subtitle: emptyText(), image: null, primary: null, secondary: null };
    case "text": return { ...base, type, title: emptyText(), body: emptyText() };
    case "imageText": return { ...base, type, title: emptyText(), body: emptyText(), image: null, side: "left", button: null };
    case "features": return { ...base, type, title: emptyText(), subtitle: emptyText(), items: [{ id: newId(), title: emptyText(), body: emptyText() }] };
    case "numbers": return { ...base, type, title: emptyText(), items: [{ id: newId(), value: "", label: emptyText() }] };
    case "products": return { ...base, type, title: emptyText(), subtitle: emptyText(), source: "featured", category: null, slugs: [], limit: 6 };
    case "gallery": return { ...base, type, title: emptyText(), images: [] };
    case "faq": return { ...base, type, title: emptyText(), items: [{ id: newId(), q: emptyText(), a: emptyText() }] };
    case "cta": return { ...base, type, title: emptyText(), body: emptyText(), button: null };
  }
}

export const emptyDoc = (): PageDoc => ({ v: 1, sections: [], seo: { title: emptyText(), description: emptyText() } });

/** The word in a language, else the English (owner's pick). */
export const textIn = (t: I18nText | null | undefined, lang: PageLang): string => (t?.[lang] || t?.en || "").trim();

/* ── The gate ───────────────────────────────────────────────────────────── */

const ID_RE = /^[a-z0-9]{6,24}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** A string with no control characters (new lines kept, at most one blank
 *  line in a row), trimmed and cut to `max` characters. */
export function cleanString(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  const s = v
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\u2028\u2029\uFEFF]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return Array.from(s).slice(0, max).join("");
}

function cleanText(v: unknown, max: number): I18nText {
  const o = obj(v);
  return { en: cleanString(o.en, max), ar: cleanString(o.ar, max), zh: cleanString(o.zh, max) };
}

/** A link a visitor may follow: a path on the site ("/products/…", with an
 *  optional #anchor or ?query), an https address, or mailto:/tel:. Anything
 *  else (javascript:, data:, http:, "//host") is dropped. */
export function cleanHref(v: unknown): string {
  const s = cleanString(v, LIMITS.href).replace(/\s/g, "");
  if (!s) return "";
  if (/^\/(?!\/)[A-Za-z0-9\-._~/#?=&%+]*$/.test(s)) return s;
  if (/^mailto:[^\s<>"']+@[^\s<>"']+$/i.test(s)) return s;
  if (/^tel:\+?[0-9\-() ]{3,24}$/i.test(s)) return s;
  try {
    const u = new URL(s);
    return u.protocol === "https:" && u.hostname.includes(".") ? u.toString() : "";
  } catch {
    return "";
  }
}

function cleanButton(v: unknown): PageButton | null {
  if (v === null || v === undefined) return null;
  const o = obj(v);
  const href = cleanHref(o.href);
  const label = cleanText(o.label, LIMITS.short);
  return href || label.en || label.ar || label.zh ? { label, href } : null;
}

/** Photos are the Hub's own: its storage's public files (the site's
 *  uploads in website-media, the products' photos in media). */
export function cleanImage(v: unknown, mediaOrigin: string): PageImage | null {
  if (v === null || v === undefined) return null;
  const o = obj(v);
  const url = typeof o.url === "string" ? o.url.trim() : "";
  if (!isHubPhoto(url, mediaOrigin)) return null;
  return { url, alt: cleanText(o.alt, LIMITS.alt) };
}

export function isHubPhoto(url: string, mediaOrigin: string): boolean {
  if (!mediaOrigin || url.length > 1000) return false;
  /* Built through publicUrl() so the storage path lives in exactly one
     allowlisted file (storage-client.ts) — and so this predicate follows the
     connected project instead of a hardcoded host. */
  return url.startsWith(publicUrl("website-media", "")) || url.startsWith(publicUrl("media", ""));
}

function cleanSection(raw: unknown, mediaOrigin: string): PageSection | null {
  const o = obj(raw);
  const type = o.type as SectionType;
  if (!(SECTION_TYPES as readonly string[]).includes(type)) return null;
  const base = {
    id: typeof o.id === "string" && ID_RE.test(o.id) ? o.id : newId(),
    hidden: o.hidden === true,
    tone: (o.tone === "light" ? "light" : "dark") as SectionTone,
  };
  const items = <T,>(v: unknown, max: number, each: (x: Record<string, unknown>, id: string) => T): T[] =>
    arr(v).slice(0, max).map((x) => {
      const i = obj(x);
      return each(i, typeof i.id === "string" && ID_RE.test(i.id) ? i.id : newId());
    });
  switch (type) {
    case "hero":
      return { ...base, type, eyebrow: cleanText(o.eyebrow, LIMITS.short), title: cleanText(o.title, LIMITS.short), subtitle: cleanText(o.subtitle, LIMITS.subtitle), image: cleanImage(o.image, mediaOrigin), primary: cleanButton(o.primary), secondary: cleanButton(o.secondary) };
    case "text":
      return { ...base, type, title: cleanText(o.title, LIMITS.short), body: cleanText(o.body, LIMITS.body) };
    case "imageText":
      return { ...base, type, title: cleanText(o.title, LIMITS.short), body: cleanText(o.body, LIMITS.body), image: cleanImage(o.image, mediaOrigin), side: o.side === "right" ? "right" : "left", button: cleanButton(o.button) };
    case "features":
      return { ...base, type, title: cleanText(o.title, LIMITS.short), subtitle: cleanText(o.subtitle, LIMITS.subtitle), items: items(o.items, LIMITS.features, (i, id) => ({ id, title: cleanText(i.title, LIMITS.short), body: cleanText(i.body, LIMITS.subtitle) })) };
    case "numbers":
      return { ...base, type, title: cleanText(o.title, LIMITS.short), items: items(o.items, LIMITS.numbers, (i, id) => ({ id, value: cleanString(i.value, LIMITS.number), label: cleanText(i.label, LIMITS.short) })) };
    case "products": {
      const source: ProductSource = o.source === "category" || o.source === "manual" ? o.source : "featured";
      const category = typeof o.category === "string" && SLUG_RE.test(o.category) && o.category.length <= 120 ? o.category : null;
      const slugs = [...new Set(arr(o.slugs).filter((s): s is string => typeof s === "string" && SLUG_RE.test(s) && s.length <= 120))].slice(0, LIMITS.manualProducts);
      const n = Math.round(Number(o.limit));
      const limit = Number.isFinite(n) ? Math.min(LIMITS.productsMax, Math.max(LIMITS.productsMin, n)) : 6;
      return { ...base, type, title: cleanText(o.title, LIMITS.short), subtitle: cleanText(o.subtitle, LIMITS.subtitle), source, category, slugs, limit };
    }
    case "gallery":
      return { ...base, type, title: cleanText(o.title, LIMITS.short), images: arr(o.images).map((x) => cleanImage(x, mediaOrigin)).filter((x): x is PageImage => !!x).slice(0, LIMITS.gallery) };
    case "faq":
      return { ...base, type, title: cleanText(o.title, LIMITS.short), items: items(o.items, LIMITS.faq, (i, id) => ({ id, q: cleanText(i.q, LIMITS.short), a: cleanText(i.a, LIMITS.answer) })) };
    case "cta":
      return { ...base, type, title: cleanText(o.title, LIMITS.short), body: cleanText(o.body, LIMITS.subtitle), button: cleanButton(o.button) };
  }
}

/** Only the known shape, every text cut to its length, unsafe links and
 *  foreign photos dropped, section and item ids unique. */
export function cleanPageDoc(raw: unknown, mediaOrigin: string): PageDoc {
  const o = obj(raw);
  const seen = new Set<string>();
  const sections: PageSection[] = [];
  for (const s of arr(o.sections).slice(0, LIMITS.sections)) {
    const c = cleanSection(s, mediaOrigin);
    if (!c) continue;
    if (seen.has(c.id)) c.id = newId();
    seen.add(c.id);
    sections.push(c);
  }
  const seo = obj(o.seo);
  return { v: 1, sections, seo: { title: cleanText(seo.title, LIMITS.seoTitle), description: cleanText(seo.description, LIMITS.seoDescription) } };
}

/* ── Ready to publish? ──────────────────────────────────────────────────── */

export interface PublishProblem { section: number | null; key: string }

/** What stops a page from going live — English only is required (a missing
 *  Arabic or Chinese word shows in English). Hidden sections are not checked. */
export function publishProblems(doc: PageDoc): PublishProblem[] {
  const out: PublishProblem[] = [];
  const visible = doc.sections.filter((s) => !s.hidden);
  if (visible.length === 0) out.push({ section: null, key: "noSections" });
  doc.sections.forEach((s, i) => {
    if (s.hidden) return;
    const need = (ok: boolean, key: string) => { if (!ok) out.push({ section: i, key }); };
    const btnOk = (b: PageButton | null) => !b || (!!b.href && !!b.label.en);
    switch (s.type) {
      case "hero": need(!!s.title.en, "title"); need(btnOk(s.primary) && btnOk(s.secondary), "button"); break;
      case "text": need(!!s.body.en, "body"); break;
      case "imageText": need(!!s.image, "image"); need(!!s.title.en || !!s.body.en, "words"); need(btnOk(s.button), "button"); break;
      case "features": need(s.items.length > 0 && s.items.every((x) => !!x.title.en), "items"); break;
      case "numbers": need(s.items.length > 0 && s.items.every((x) => !!x.value && !!x.label.en), "items"); break;
      case "products": need(s.source !== "category" || !!s.category, "category"); need(s.source !== "manual" || s.slugs.length > 0, "slugs"); break;
      case "gallery": need(s.images.length > 0, "images"); break;
      case "faq": need(s.items.length > 0 && s.items.every((x) => !!x.q.en && !!x.a.en), "items"); break;
      case "cta": need(!!s.title.en, "title"); need(!!s.button && !!s.button.href && !!s.button.label.en, "button"); break;
    }
  });
  return out;
}

/** Whether the words of a section are all there in a language (the editor
 *  marks a section with Arabic or Chinese still to write). */
export function missingIn(section: PageSection, lang: PageLang): boolean {
  if (lang === "en") return false;
  const texts: I18nText[] = [];
  const add = (t: I18nText | undefined | null) => { if (t && t.en) texts.push(t); };
  const s = section as unknown as Record<string, unknown>;
  for (const k of ["eyebrow", "title", "subtitle", "body"]) add(s[k] as I18nText | undefined);
  for (const k of ["primary", "secondary", "button"]) add((s[k] as PageButton | null | undefined)?.label);
  for (const item of (s.items as Array<Record<string, unknown>> | undefined) ?? []) for (const k of ["title", "body", "label", "q", "a"]) add(item[k] as I18nText | undefined);
  return texts.some((t) => !t[lang]);
}
