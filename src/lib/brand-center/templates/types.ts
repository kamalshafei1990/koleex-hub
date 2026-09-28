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
  | { kind: "text"; max: number; placeholder?: string; hintKey?: string }
  | { kind: "choice"; options: Array<{ value: string; labelKey: string }> }
  | { kind: "switch" }
  | { kind: "range"; min: number; max: number; step: number; unit?: "%" | "x" }
  /** A picture chosen on this computer (stays in the browser) or the
   *  person's Hub photo — the value is a data: or https: URL. */
  | { kind: "image"; hintKey?: string; fromPerson?: "photo" }
  /** A job title from the title library, or typed. */
  | { kind: "title"; langKey: string }
  /** The contact lines: label + value each, add / remove / reorder / hide. */
  | { kind: "rows"; langKey: string }
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
  fields: FieldDef[];
  defaults: TemplateValues;
  pages: TemplatePage[];
  /** The QR codes to generate for this fill. */
  qrRequests?: (v: TemplateValues) => QrRequest[];
  /** Words keys of the print notes shown under the preview, for this fill. */
  specKeys?: (v: TemplateValues) => string[];
  /** A short name of this fill for the file name and the slug. */
  fillName?: (v: TemplateValues, t: (k: string) => string) => string;
  /** The fill after switching its language (labels, the address's default). */
  relang?: (v: TemplateValues, lang: string) => TemplateValues;
  /** The fill after picking another style (its own defaults, e.g. typeface). */
  restyle?: (v: TemplateValues, style: string) => TemplateValues;
  /** What is still missing before it can print (a words key), or null. */
  check?: (v: TemplateValues) => string | null;
  /** The fill as it is saved to "my templates": the look and the company's
   *  lines always; a person's own details only when `keepPerson`. Pictures
   *  are never saved (the server drops them too). */
  forSaving?: (v: TemplateValues, keepPerson: boolean) => TemplateValues;
}

/** 1 pt in mm — type sizes in the book are in points. */
export const PT = 0.3528;
