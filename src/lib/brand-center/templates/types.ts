/* ---------------------------------------------------------------------------
   Brand Center templates (plan step C6) — the engine's shapes.

   A template is a LOCKED design with slots. Everything is drawn in
   millimetres at the real size, so the same drawing is the preview on
   screen and the print file: trim size + bleed around it (+ crop marks
   outside the bleed when printed). The marks and colours are the brand's;
   people fill the slots, pick among the approved styles, and adjust what
   each style allows (owner, 29/09/2026: "everything editable").
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import type { BcPerson, BcProduct } from "@/lib/brand-center/client";

export type TemplateScalar = string | boolean | number;
/** One entry of a list slot (a contact line, a QR code). */
export type TemplateItem = Record<string, TemplateScalar>;
export type TemplateValue = TemplateScalar | TemplateItem[];
export type TemplateValues = Record<string, TemplateValue>;

type Common = {
  key: string;
  labelKey: string;
  /** The studio section this slot sits in (words key `tpl.group.<group>`). */
  group?: string;
  /** Only when this is true for the current fill (e.g. one style). */
  when?: (v: TemplateValues) => boolean;
};

export type FieldDef = Common & (
  /** `lines` > 1: a box for a sentence or two. */
  | { kind: "text"; max: number; placeholder?: string; hintKey?: string; lines?: number }
  | { kind: "choice"; options: Array<{ value: string; labelKey: string }> }
  | { kind: "switch" }
  | { kind: "range"; min: number; max: number; step: number; unit?: "%" | "x" }
  /** A picture chosen on this computer (stays in the browser) or the
   *  person's Hub photo — the value is a data: or https: URL. */
  | { kind: "image"; hintKey?: string; fromPerson?: "photo" }
  /** A job title from the title library, or typed. */
  | { kind: "title"; langKey: string }
  /** The contact lines: label + value each, add / remove / reorder / hide.
   *  `labels`: the default label of each kind by language (the card's own
   *  when absent). */
  | { kind: "rows"; langKey: string; labels?: Record<string, Record<string, string>>; kinds?: string[] }
  /** QR codes: each on the front or the back, generated or a picture. */
  | { kind: "qrs"; langKey: string }
);

export interface TemplatePage {
  /** e.g. "front", "back" — also the words key `tpl.page.<id>` */
  id: string;
  /** Everything inside the page in mm, origin at the TOP-LEFT OF THE BLEED
   *  (so the trim starts at bleed, bleed). Must paint the whole bleed. */
  draw: (v: TemplateValues, ctx: DrawContext) => ReactNode;
}

export interface DrawContext {
  /** Trim size and bleed, in mm. */
  w: number; h: number; bleed: number;
  /** Generated QR codes of this fill, by the QR entry's id. */
  qrs: Record<string, boolean[][]>;
  /** A prefix for ids inside the drawing (clip paths, masks) — unique per sheet. */
  uid: string;
}

export interface QrRequest { id: string; text: string; level: "M" | "H" }

/** A template that is not paper (the email signature): the studio shows it
 *  as a mail app will and copies it as HTML instead of printing. */
export interface HtmlOutput {
  /** Tables and inline styles only. `base` is where pictures load from — our
   *  domain in a copy, the studio's own address in its preview; `preview`
   *  shows placeholders in empty slots. */
  render: (v: TemplateValues, o: { variant: string; base: string; preview?: boolean }) => string;
  /** The same as plain text (the clipboard's second format). */
  text: (v: TemplateValues, variant: string) => string;
  /** The versions offered, e.g. full and reply — words keys `sig.variant.<id>`. */
  variants: string[];
  /** Our domain: every picture in a copy loads from it. */
  host: string;
}

export interface TemplateDef {
  id: string;
  /** Brand Center item this template makes (library key). */
  itemKey: string;
  nameKey: string;
  /** Trim size in mm for this fill (a template may offer several sizes). */
  size: (v: TemplateValues) => { w: number; h: number };
  /** Bleed on every side, mm. */
  bleed: number;
  /** Safe margin inside the trim, mm (nothing important outside it). */
  safe: number;
  /** Crop marks and a slug around the printed page (default true). A sheet
   *  printed as is (the proof) has none, so it prints on its own paper size. */
  marks?: boolean;
  /** The studio offers "Fill from Employees" (default true). */
  usesPeople?: boolean;
  /** A picture, not paper (a social post): the size is in PIXELS, there is
   *  no bleed and no crop marks, and the studio downloads a PNG or a JPEG of
   *  exactly that size instead of printing. */
  digital?: boolean;
  /** The safe area of this fill when it is not `safe` on every side (a
   *  story keeps its top and bottom clear for the app's buttons). */
  safeFor?: (v: TemplateValues) => { top: number; right: number; bottom: number; left: number };
  /** One fill in every size (plan step C16): the slot that holds the size
   *  and its values — the studio shows them side by side and saves them
   *  all at once. */
  everySize?: { key: string; values: readonly string[] };
  /** The studio offers "Fill from Products" (active products only). */
  usesProducts?: boolean;
  /** The slots a chosen product fills (name, model, photo, highlights …). */
  fromProduct?: (p: BcProduct, v: TemplateValues) => TemplateValues;
  /** A post's suggested caption when it goes to Social Marketing (plan
   *  step C17), in the book's house style (ch. 80): the hook, the product
   *  or the news, then three to five hashtags, #KOLEEX first. */
  caption?: (v: TemplateValues) => string;
  fields: FieldDef[];
  defaults: TemplateValues;
  /** Set for a template that is HTML, not paper (then `pages` is empty). */
  html?: HtmlOutput;
  pages: TemplatePage[];
  /** The QR codes to generate for this fill. */
  qrRequests?: (v: TemplateValues) => QrRequest[];
  /** Words keys of the print notes shown under the preview, for this fill. */
  specKeys?: (v: TemplateValues) => string[];
  /** How this template's files start when its id says nothing (a
   *  designer's template: its name); the id otherwise. */
  fileKey?: string;
  /** A short name of this fill for the file name and the slug. */
  fillName?: (v: TemplateValues, t: (k: string) => string) => string;
  /** The fill after switching its language (labels, the address's default). */
  relang?: (v: TemplateValues, lang: string) => TemplateValues;
  /** The fill after picking another style (its own defaults, e.g. typeface). */
  restyle?: (v: TemplateValues, style: string) => TemplateValues;
  /** The fill after a slot changes that brings its own defaults (e.g. the
   *  certificate's kind brings its wording), by slot key. */
  rekey?: Record<string, (v: TemplateValues, value: TemplateValue) => TemplateValues>;
  /** The pages this fill shows and prints (e.g. no back side), by id. */
  pagesFor?: (v: TemplateValues) => string[];
  /** The die line when the piece is cut to a shape (round corners, a
   *  hole): an SVG path in the page's mm, origin at the top-left of the
   *  bleed; a hole is one more subpath (even-odd). The screen shows the cut
   *  piece, the guides draw the line; the print file keeps its full bleed. */
  die?: (v: TemplateValues, pageId: string, box: { w: number; h: number; bleed: number }) => string | null;
  /** Styles that start as drafts until the owner approves them (a saved
   *  status always wins). */
  draftStyles?: readonly string[];
  /** The slots a chosen employee fills (name, title, photo …). */
  fromPerson?: (p: BcPerson, v: TemplateValues) => TemplateValues;
  /** What is still missing before it can print (a words key), or null. */
  check?: (v: TemplateValues) => string | null;
  /** The fill as it is saved to "my templates": the look and the company's
   *  lines always; a person's own details only when `keepPerson`. Pictures
   *  are never saved (the server drops them too). */
  forSaving?: (v: TemplateValues, keepPerson: boolean) => TemplateValues;
}

/** 1 pt in mm — type sizes in the book are in points. */
export const PT = 0.3528;
