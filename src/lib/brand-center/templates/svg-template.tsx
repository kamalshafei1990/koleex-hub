/* ---------------------------------------------------------------------------
   Designer templates (plan step C18): a designer's own artwork, uploaded as
   SVG on a design of kind "template", becomes a fill-in template in the
   studio — the same studio, print and download as the built-in ones.

   The convention (shown to the owner where he uploads):
     · one SVG per side — the front, then a file named "…back…";
     · every NAMED text layer becomes a field (its text is the default);
       the names name, title, email, mobile, staff, department fill from
       the employee chosen;
     · a shape named photo (or picture, image) holds a photo, cut to it;
     · the artboard is the finished size — or 3 mm larger on each side,
       with the bleed (recognised for the standard sizes);
     · pictures embedded, not linked; fonts Inter or Helvetica Neue.

   Safety: the file is the owner's, but it is drawn inside the Hub, so it is
   rebuilt from an allow-list — no script, no event handler, no foreign or
   linked content, no link out; its styles are inlined (nothing leaks into
   the page) and every id is renamed per sheet. Browser only (DOMParser).
   --------------------------------------------------------------------------- */

import type { BcPerson, BcSvgPage } from "@/lib/brand-center/client";
import type { FieldDef, TemplateDef, TemplateValues } from "./types";
import { formatMobile, nameIn, titleOf } from "./person";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";
/** Stands for the sheet's own id prefix until a sheet draws the page. */
const P = "kxP0";

const ALLOWED = new Set([
  "svg", "g", "defs", "symbol", "use", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan", "textpath", "image", "clippath", "mask", "pattern", "lineargradient", "radialgradient", "stop",
  "filter", "fegaussianblur", "feoffset", "feblend", "fecolormatrix", "fecomposite", "feflood", "femerge", "femergenode",
  "femorphology", "fecomponenttransfer", "fefuncr", "fefuncg", "fefuncb", "fefunca", "fedropshadow", "marker", "title", "desc",
]);
/** Wrappers whose content is kept without them (a link, a switch). */
const UNWRAP = new Set(["a", "switch"]);

/* ── reading the file ──────────────────────────────────────────────────── */

export interface SvgSlot {
  key: string;
  kind: "text" | "image";
  label: string;
  /** The text as designed (lines joined by "\n"); "" for a picture. */
  initial: string;
}
interface SlotPlace {
  /** data-kx-i of the element */
  i: number;
  key: string;
  kind: "text" | "image";
  /** its box in its own units (getBBox) */
  box: { x: number; y: number; w: number; h: number };
  /** where it sits on the page, in the page's units */
  page: { x: number; y: number; w: number; h: number };
  /** its own units per page unit (its transform's scale) */
  scale: number;
  anchor: "start" | "middle" | "end";
  fontSize: number;
  initial: string;
}
export interface SvgPage {
  doc: Document;
  viewBox: { x: number; y: number; w: number; h: number };
  places: SlotPlace[];
}
export interface SvgTemplate {
  designId: string;
  name: string;
  pages: SvgPage[];
  slots: SvgSlot[];
  /** Trim size — mm, or pixels for a post. */
  w: number; h: number;
  /** The file carries 3 mm of bleed around the trim. */
  bleedIn: boolean;
  digital: boolean;
  /** Linked pictures were left out (they must be embedded). */
  droppedLinks: boolean;
}

/** Print sizes (mm) we recognise, to tell the file's units and its bleed. */
const PRINT = [[90, 54], [85, 55], [89, 51], [85.6, 54], [86, 54], [210, 297], [148, 210], [105, 148], [99, 210], [297, 420], [420, 594], [100, 150], [216, 279], [100, 210]];
const POSTS = [[1080, 1080], [1080, 1350], [1080, 1920], [1200, 627], [1920, 1080], [1200, 1200], [1080, 566]];
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const isPrint = (w: number, h: number) => PRINT.some(([a, b]) => (near(w, a, 0.8) && near(h, b, 0.8)) || (near(w, b, 0.8) && near(h, a, 0.8)));

/** A layer name as Illustrator or Figma writes it → a field key. */
function slotKey(id: string): string {
  const s = id.replace(/_x([0-9A-Fa-f]{2})_/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/_\d+_$/, "").replace(/[-_ ]\d+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return /^(layer|ebene|calque|capa|group|groupe|artboard|frame|clippath|clip|lineargradient|radialgradient|gradient|mask|path|rect|rectangle|shape|text|tspan|g|svg|defs|image\d+)\d*$/.test(s) ? "" : s;
}
function slotLabel(id: string): string {
  const s = id.replace(/_x([0-9A-Fa-f]{2})_/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))).replace(/_\d+_$/, "").replace(/[_-]+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : id;
}

/** Numbers and units: "90mm", "255.12pt", "1080px", "255.12" (points in Illustrator). */
function lengthOf(v: string | null): { n: number; unit: string } | null {
  const m = v?.trim().match(/^([\d.]+)\s*(mm|cm|in|pt|px)?$/i);
  return m ? { n: parseFloat(m[1]), unit: (m[2] ?? "").toLowerCase() } : null;
}

/* Styles: Illustrator writes classes in a <style>; they are inlined so
   nothing reaches the page's own elements, then the block is dropped. */
function classRules(doc: Document): Map<string, string> {
  const rules = new Map<string, string>();
  for (const st of Array.from(doc.getElementsByTagName("style"))) {
    const css = (st.textContent ?? "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/@import[^;]*;/gi, "")
      .replace(/@[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const sel of m[1].split(",")) {
        const c = sel.trim().match(/^\.([\w-]+)$/);
        if (c) rules.set(c[1], `${rules.get(c[1]) ?? ""}${m[2].trim().replace(/;?$/, ";")}`);
      }
    }
  }
  return rules;
}

/** A value that may carry url(…): only references inside the file stay. */
const cleanValue = (v: string) => v.replace(/url\(\s*(['"]?)(?!#)[^)]*\1\s*\)/gi, "none").replace(/expression\s*\(|javascript:|@import/gi, "");

/** The font a design names, as the Hub draws it (Inter by its loaded face). */
function fontOf(family: string): { family: string; weight?: number; italic: boolean } {
  const first = family.replace(/['"]/g, "").split(",")[0].trim();
  const w = /thin|hairline/i.test(first) ? 100 : /extra-?light|ultra-?light/i.test(first) ? 200 : /light/i.test(first) ? 300
    : /medium/i.test(first) ? 500 : /semi-?bold|demi-?bold/i.test(first) ? 600 : /extra-?bold|ultra-?bold|heavy/i.test(first) ? 800
      : /black/i.test(first) ? 900 : /bold/i.test(first) ? 700 : /regular|roman|book/i.test(first) ? 400 : undefined;
  const italic = /italic|oblique/i.test(first);
  const f = /inter/i.test(first) ? "var(--font-inter), Inter, sans-serif"
    : /helvetica/i.test(first) ? "'Helvetica Neue', Helvetica, Arial, sans-serif"
      : /arab/i.test(first) ? "var(--font-bc-ar), 'Noto Sans Arabic', sans-serif"
        : `${family}, var(--font-inter), sans-serif`;
  return { family: f, weight: w, italic };
}

const styleMap = (s: string) => new Map(s.split(";").map((d) => d.split(":")).filter((d) => d.length >= 2 && d[0].trim()).map((d) => [d[0].trim().toLowerCase(), d.slice(1).join(":").trim()]));
const styleText = (m: Map<string, string>) => Array.from(m.entries()).map(([k, v]) => `${k}:${v}`).join(";");

/** Rebuild one element from the allow-list; returns false when removed. */
function clean(el: Element, rules: Map<string, string>, flags: { droppedLinks: boolean }): boolean {
  const tag = el.localName.toLowerCase();
  if (UNWRAP.has(tag)) {
    const parent = el.parentNode;
    const kids = Array.from(el.childNodes);
    for (const k of kids) parent?.insertBefore(k, el);
    el.remove();
    for (const k of kids) if (k.nodeType === 1) clean(k as Element, rules, flags);
    return false;
  }
  if (!ALLOWED.has(tag)) { el.remove(); return false; }
  /* classes → inline style (the element's own style wins) */
  const style = styleMap([...(el.getAttribute("class") ?? "").split(/\s+/).map((c) => rules.get(c) ?? ""), el.getAttribute("style") ?? ""].join(";"));
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    const value = attr.value;
    if (name.startsWith("on") || name === "class" || name === "style") { el.removeAttribute(attr.name); continue; }
    if (name === "href" || name === "xlink:href") {
      const ok = value.startsWith("#") || (tag === "image" && /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(value));
      if (!ok) { el.removeAttributeNode(attr); if (tag === "image") flags.droppedLinks = true; }
      continue;
    }
    if (/javascript:/i.test(value)) { el.removeAttributeNode(attr); continue; }
    if (value.includes("url(")) el.setAttribute(attr.name, cleanValue(value));
  }
  for (const [k, v] of style) style.set(k, cleanValue(v));
  /* the font, as the Hub loads it */
  const fam = style.get("font-family") ?? el.getAttribute("font-family");
  if (fam) {
    const f = fontOf(fam);
    style.set("font-family", f.family);
    if (f.weight && !style.has("font-weight") && !el.hasAttribute("font-weight")) style.set("font-weight", String(f.weight));
    if (f.italic && !style.has("font-style")) style.set("font-style", "italic");
    el.removeAttribute("font-family");
  }
  if (style.size) el.setAttribute("style", styleText(style));
  for (const k of Array.from(el.children)) clean(k, rules, flags);
  return true;
}

/** Renames every id to one this sheet owns, and every reference to it. */
function renameIds(root: Element) {
  const map = new Map<string, string>();
  let n = 0;
  for (const el of Array.from(root.querySelectorAll("[id]"))) {
    const id = el.getAttribute("id") as string;
    if (!map.has(id)) map.set(id, `${P}-${n++}`);
    el.setAttribute("id", map.get(id) as string);
  }
  const ref = (v: string) => v.replace(/url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g, (all, _q: string, id: string) => (map.has(id) ? `url(#${map.get(id)})` : all));
  for (const el of Array.from(root.querySelectorAll("*"))) {
    for (const attr of Array.from(el.attributes)) {
      if ((attr.name === "href" || attr.name === "xlink:href") && attr.value.startsWith("#")) {
        const to = map.get(attr.value.slice(1));
        if (to) attr.value = `#${to}`;
      } else if (attr.value.includes("url(")) attr.value = ref(attr.value);
    }
  }
}

/** The text of a text element as lines (a new line where the baseline moves). */
function textLines(el: Element): string {
  const spans = Array.from(el.querySelectorAll("tspan"));
  if (!spans.length) return (el.textContent ?? "").trim();
  const lines: string[] = [];
  let lastY: string | null = null;
  for (const s of spans) {
    if (s.querySelector("tspan")) continue;
    const y = s.getAttribute("y");
    const t = s.textContent ?? "";
    if (lines.length && (y === null || y === lastY)) lines[lines.length - 1] += t;
    else lines.push(t);
    if (y !== null) lastY = y;
  }
  return lines.map((l) => l.replace(/\s+/g, " ").trim()).join("\n").trim();
}

/** Parses, cleans and measures one side; the slots it names. */
function readPage(raw: string, flags: { droppedLinks: boolean }): { page: SvgPage; slots: SvgSlot[]; size: { w: number; h: number; unit: string } } | null {
  const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.localName !== "svg" || doc.getElementsByTagName("parsererror").length) return null;
  const vbAttr = (root.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  const lw = lengthOf(root.getAttribute("width")), lh = lengthOf(root.getAttribute("height"));
  const vb = vbAttr.length === 4 && vbAttr.every(Number.isFinite)
    ? { x: vbAttr[0], y: vbAttr[1], w: vbAttr[2], h: vbAttr[3] }
    : { x: 0, y: 0, w: lw?.n ?? 100, h: lh?.n ?? 100 };
  const size = { w: lw?.n ?? vb.w, h: lh?.n ?? vb.h, unit: lw?.unit ?? "" };

  const rules = classRules(doc);
  for (const st of Array.from(doc.getElementsByTagName("style"))) st.remove();
  for (const k of Array.from(root.children)) clean(k, rules, flags);

  /* the slots, found by their layer names before the ids are renamed */
  const slots: SvgSlot[] = [];
  const marks: Array<{ el: Element; key: string; kind: "text" | "image" }> = [];
  for (const el of Array.from(root.querySelectorAll("[id]"))) {
    const id = el.getAttribute("id") as string;
    const key = slotKey(id);
    if (!key) continue;
    const tag = el.localName.toLowerCase();
    let target: Element | null = null;
    let kind: "text" | "image" = "text";
    if (tag === "text") target = el;
    else if (tag === "g" && el.querySelectorAll("text").length === 1 && !/^(photo|picture|image)/.test(key)) target = el.querySelector("text");
    else if (/^(photo|picture|image)/.test(key) && ["rect", "circle", "ellipse", "path", "polygon", "image", "use"].includes(tag)) { target = el; kind = "image"; }
    if (!target || marks.some((m) => m.el === target)) continue;
    marks.push({ el: target, key, kind });
    if (!slots.some((s) => s.key === key)) slots.push({ key, kind, label: slotLabel(id), initial: kind === "text" ? textLines(target) : "" });
  }
  marks.forEach((m, i) => { m.el.setAttribute("data-kx-i", String(i)); m.el.setAttribute("data-kx-slot", m.key); });
  renameIds(root);

  /* measure each slot where it is drawn (a hidden copy on the page) */
  const places: SlotPlace[] = [];
  const probe = document.createElementNS(SVG_NS, "svg");
  probe.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  probe.setAttribute("width", String(vb.w));
  probe.setAttribute("height", String(vb.h));
  Object.assign(probe.style, { position: "fixed", left: "-100000px", top: "0", visibility: "hidden" });
  for (const k of Array.from(root.childNodes)) probe.appendChild(document.importNode(k, true));
  document.body.appendChild(probe);
  try {
    const rootCtm = probe.getScreenCTM()?.inverse();
    marks.forEach((m, i) => {
      const el = probe.querySelector(`[data-kx-i="${i}"]`) as SVGGraphicsElement | null;
      if (!el) return;
      const b = el.getBBox();
      const ctm = el.getScreenCTM();
      const toPage = rootCtm && ctm ? rootCtm.multiply(ctm) : null;
      const pt = (x: number, y: number) => (toPage ? new DOMPoint(x, y).matrixTransform(toPage) : new DOMPoint(x, y));
      const a = pt(b.x, b.y), c = pt(b.x + b.width, b.y + b.height);
      const page = { x: Math.min(a.x, c.x), y: Math.min(a.y, c.y), w: Math.abs(c.x - a.x), h: Math.abs(c.y - a.y) };
      const scale = toPage ? Math.hypot(toPage.a, toPage.b) || 1 : 1;
      /* how it is aligned: centred on the page, flush right, or from its start */
      const cx = page.x + page.w / 2;
      const own = el.getAttribute("text-anchor") ?? getComputedStyle(el).textAnchor;
      const anchor: SlotPlace["anchor"] = near(cx, vb.x + vb.w / 2, vb.w * 0.02) ? "middle"
        : own === "middle" || own === "end" ? own
          : page.x > vb.x + vb.w * 0.5 && vb.x + vb.w - (page.x + page.w) < vb.w * 0.14 ? "end" : "start";
      const fontSize = parseFloat(getComputedStyle(el).fontSize) || b.height * 0.8;
      places.push({ i, key: m.key, kind: m.kind, box: { x: b.x, y: b.y, w: b.width, h: b.height }, page, scale: 1 / scale, anchor, fontSize, initial: m.kind === "text" ? textLines(m.el) : "" });
    });
  } finally {
    probe.remove();
  }
  return { page: { doc, viewBox: vb, places }, slots, size };
}

/** Reads a design's SVG files into a template, or says why it cannot. */
export function readSvgTemplate(designId: string, name: string, files: BcSvgPage[]): SvgTemplate | { error: "no_svg" | "bad_svg" } {
  if (!files.length) return { error: "no_svg" };
  const flags = { droppedLinks: false };
  const read = files.map((f) => readPage(f.svg, flags));
  if (read.some((r) => !r)) return { error: "bad_svg" };
  const pages = read as NonNullable<(typeof read)[number]>[];
  const first = pages[0].size;
  const known = files[0].widthMm && files[0].heightMm ? { w: Number(files[0].widthMm), h: Number(files[0].heightMm) } : null;

  /* units: mm as written; px/unitless — a post if it is a post size,
     otherwise Illustrator's points (or CSS pixels, whichever is a print size) */
  let w: number, h: number, digital = false;
  const u = first.unit;
  if (known) { w = known.w; h = known.h; }
  else if (u === "mm") { w = first.w; h = first.h; }
  else if (u === "cm") { w = first.w * 10; h = first.h * 10; }
  else if (u === "in") { w = first.w * 25.4; h = first.h * 25.4; }
  else if ((u === "px" || u === "") && POSTS.some(([a, b]) => near(first.w, a, 1) && near(first.h, b, 1))) { w = Math.round(first.w); h = Math.round(first.h); digital = true; }
  else {
    const pt = { w: first.w * 25.4 / 72, h: first.h * 25.4 / 72 }, px = { w: first.w * 25.4 / 96, h: first.h * 25.4 / 96 };
    const fits = (s: { w: number; h: number }) => isPrint(s.w, s.h) || isPrint(s.w - 6, s.h - 6);
    const pick = u === "pt" ? pt : fits(px) && !fits(pt) ? px : pt;
    w = pick.w; h = pick.h;
  }
  const bleedIn = !digital && isPrint(w - 6, h - 6);
  if (bleedIn) { w -= 6; h -= 6; }
  const slots: SvgSlot[] = [];
  for (const p of pages) for (const s of p.slots) if (!slots.some((x) => x.key === s.key)) slots.push(s);
  return { designId, name, pages: pages.map((p) => p.page), slots, w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10, bleedIn, digital, droppedLinks: flags.droppedLinks };
}

/* ── drawing a side with the fill ──────────────────────────────────────── */

const ARABIC = /[؀-ۿ]/;

/** The side's markup with this fill: texts replaced, photos placed. A
 *  longer text may grow to `margin` (page units) from the page's edge — the
 *  safe line — and is condensed past it. */
function fillPage(page: SvgPage, v: TemplateValues, margin: number): string {
  const root = page.doc.documentElement.cloneNode(true) as Element;
  const doc = root.ownerDocument;
  let defs = root.querySelector("defs");
  for (const pl of page.places) {
    const el = root.querySelector(`[data-kx-i="${pl.i}"]`);
    if (!el) continue;
    const value = typeof v[`s_${pl.key}`] === "string" ? (v[`s_${pl.key}`] as string) : pl.initial;
    if (pl.kind === "text") {
      if (value === pl.initial) continue;
      const firstSpan = el.querySelector("tspan");
      const y0 = parseFloat(firstSpan?.getAttribute("y") ?? el.getAttribute("y") ?? "0") || pl.box.y + pl.box.h * 0.8;
      const spanStyle = firstSpan?.getAttribute("style") ?? "";
      while (el.firstChild) el.removeChild(el.firstChild);
      el.removeAttribute("textLength");
      const rtl = ARABIC.test(value);
      const anchor = rtl ? (pl.anchor === "start" ? "end" : pl.anchor === "end" ? "start" : "middle") : pl.anchor;
      const x = pl.anchor === "middle" ? pl.box.x + pl.box.w / 2 : pl.anchor === "end" ? pl.box.x + pl.box.w : pl.box.x;
      el.setAttribute("text-anchor", anchor);
      if (rtl) el.setAttribute("direction", "rtl");
      /* room to grow: to the page edge on the side the text grows to */
      const vb = page.viewBox, m = margin;
      const roomPage = pl.anchor === "start" ? vb.x + vb.w - m - pl.page.x
        : pl.anchor === "end" ? pl.page.x + pl.page.w - vb.x - m
          : 2 * Math.min(pl.page.x + pl.page.w / 2 - vb.x, vb.x + vb.w - (pl.page.x + pl.page.w / 2)) - 2 * m;
      const room = roomPage * pl.scale;
      const oldLong = Math.max(1, ...pl.initial.split("\n").map((l) => [...l].length));
      value.split("\n").forEach((line, j) => {
        const span = doc.createElementNS(SVG_NS, "tspan");
        span.setAttribute("x", String(x));
        span.setAttribute("y", String(y0 + j * pl.fontSize * 1.2));
        if (spanStyle) span.setAttribute("style", spanStyle);
        const est = pl.box.w * ([...line].length / oldLong);
        if (est > room && room > 0) { span.setAttribute("textLength", String(room)); span.setAttribute("lengthAdjust", "spacingAndGlyphs"); }
        span.textContent = line;
        el.appendChild(span);
      });
    } else if (value) {
      if (!defs) { defs = doc.createElementNS(SVG_NS, "defs"); root.insertBefore(defs, root.firstChild); }
      const clip = doc.createElementNS(SVG_NS, "clipPath");
      clip.setAttribute("id", `${P}-clip${pl.i}`);
      const shape = el.cloneNode(true) as Element;
      for (const a of ["id", "transform", "data-kx-i", "data-kx-slot", "style", "clip-path", "mask", "filter"]) shape.removeAttribute(a);
      clip.appendChild(shape);
      defs.appendChild(clip);
      const img = doc.createElementNS(SVG_NS, "image");
      img.setAttribute("x", String(pl.box.x));
      img.setAttribute("y", String(pl.box.y));
      img.setAttribute("width", String(pl.box.w));
      img.setAttribute("height", String(pl.box.h));
      img.setAttribute("preserveAspectRatio", "xMidYMid slice");
      img.setAttribute("clip-path", `url(#${P}-clip${pl.i})`);
      img.setAttributeNS(XLINK_NS, "xlink:href", value);
      img.setAttribute("href", value);
      const tr = el.getAttribute("transform");
      if (tr) img.setAttribute("transform", tr);
      el.parentNode?.insertBefore(img, el.nextSibling);
    }
  }
  const s = new XMLSerializer();
  return Array.from(root.childNodes).map((n) => s.serializeToString(n)).join("");
}

/* ── the template ──────────────────────────────────────────────────────── */

/** The names that fill from the employee chosen. */
const PERSON: Record<string, (p: BcPerson) => string> = {
  name: (p) => nameIn(p, "en"), fullname: (p) => nameIn(p, "en"), employeename: (p) => nameIn(p, "en"),
  title: (p) => titleOf(p, "en"), jobtitle: (p) => titleOf(p, "en"), position: (p) => titleOf(p, "en"),
  email: (p) => p.email ?? "", mail: (p) => p.email ?? "",
  mobile: (p) => (p.mobile ? formatMobile(p.mobile) : ""), phone: (p) => (p.mobile ? formatMobile(p.mobile) : ""), tel: (p) => (p.mobile ? formatMobile(p.mobile) : ""),
  staff: (p) => p.staffNo ?? "", staffno: (p) => p.staffNo ?? "", staffnumber: (p) => p.staffNo ?? "", employeeid: (p) => p.staffNo ?? "",
  department: (p) => p.department ?? "", dept: (p) => p.department ?? "",
};
const LABEL_KEY: Record<string, string> = { name: "tpl.f.name", fullname: "tpl.f.name", title: "tpl.f.title", jobtitle: "tpl.f.title", position: "tpl.f.title", photo: "tpl.f.photo" };

export function svgTemplateDef(tpl: SvgTemplate): TemplateDef {
  const fields: FieldDef[] = tpl.slots.map((s): FieldDef => (s.kind === "image"
    ? { key: `s_${s.key}`, kind: "image", labelKey: LABEL_KEY[s.key] ?? s.label, group: "photo", ...(s.key.startsWith("photo") ? { fromPerson: "photo" as const } : {}) }
    : { key: `s_${s.key}`, kind: "text", labelKey: LABEL_KEY[s.key] ?? s.label, group: "words", max: 300, ...(s.initial.includes("\n") ? { lines: 3 } : {}) }));
  const defaults: TemplateValues = Object.fromEntries(tpl.slots.map((s) => [`s_${s.key}`, s.initial]));
  const usesPeople = tpl.slots.some((s) => s.key in PERSON || s.key.startsWith("photo"));
  const bleed = tpl.digital ? 0 : 3;
  return {
    id: `svg-${tpl.designId}`,
    itemKey: "designer-template",
    fileKey: tpl.name.normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40) || "template",
    nameKey: tpl.name,
    size: () => ({ w: tpl.w, h: tpl.h }),
    bleed,
    safe: tpl.digital ? Math.round(Math.min(tpl.w, tpl.h) * 0.06) : 4,
    digital: tpl.digital,
    usesPeople,
    fields,
    defaults,
    pages: tpl.pages.map((page, i) => ({
      id: i === 0 ? "front" : "back",
      draw: (v, ctx) => {
        const prefix = ctx.uid.replace(/[^a-zA-Z0-9_-]/g, "");
        /* the safe line in the file's units: 4 mm inside the trim (plus the bleed the file carries) */
        const perUnit = page.viewBox.w / (tpl.bleedIn ? tpl.w + 6 : tpl.w);
        const margin = tpl.digital ? page.viewBox.w * 0.06 : (tpl.bleedIn ? 7 : 4) * perUnit;
        const inner = fillPage(page, v, margin).split(P).join(prefix);
        /* the art on the bleed box when the file has its bleed, else on the trim */
        const box = tpl.bleedIn || tpl.digital ? { x: 0, y: 0, w: ctx.w + ctx.bleed * 2, h: ctx.h + ctx.bleed * 2 } : { x: ctx.bleed, y: ctx.bleed, w: ctx.w, h: ctx.h };
        const vb = page.viewBox;
        return (
          <>
            <rect x={0} y={0} width={ctx.w + ctx.bleed * 2} height={ctx.h + ctx.bleed * 2} fill="#FFFFFF" />
            <svg x={box.x} y={box.y} width={box.w} height={box.h} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet" overflow="hidden"
              dangerouslySetInnerHTML={{ __html: inner }} />
          </>
        );
      },
    })),
    fromPerson: (p: BcPerson) => {
      const out: TemplateValues = {};
      for (const s of tpl.slots) {
        if (s.kind === "text" && PERSON[s.key]) { const val = PERSON[s.key](p); if (val) out[`s_${s.key}`] = val; }
        if (s.kind === "image" && s.key.startsWith("photo") && p.photo) out[`s_${s.key}`] = p.photo;
      }
      return out;
    },
    fillName: (v) => (typeof v.s_name === "string" ? v.s_name.trim() : ""),
    specKeys: () => [
      tpl.digital ? "svgt.spec.digital" : tpl.bleedIn ? "svgt.spec.bleed" : "svgt.spec.noBleed",
      "svgt.spec.fonts",
      ...(tpl.droppedLinks ? ["svgt.spec.links"] : []),
    ],
  };
}
