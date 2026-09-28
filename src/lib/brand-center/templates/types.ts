/* ---------------------------------------------------------------------------
   Brand Center templates (plan step C6) — the engine's shapes.

   A template is a LOCKED design with slots. Everything is drawn in
   millimetres at the real size, so the same drawing is the preview on
   screen and the print file: trim size + bleed around it (+ crop marks
   outside the bleed when printed). Nobody can move the logo or change a
   colour; people only fill the slots.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";

export type FieldDef =
  | { key: string; kind: "text"; labelKey: string; max: number; placeholder?: string }
  | { key: string; kind: "choice"; labelKey: string; options: Array<{ value: string; labelKey: string }> }
  | { key: string; kind: "switch"; labelKey: string };

export type TemplateValues = Record<string, string | boolean>;

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
  /** The contact QR's modules for this fill (null when off). */
  qr: boolean[][] | null;
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
  fields: FieldDef[];
  defaults: TemplateValues;
  pages: TemplatePage[];
  /** Text encoded in the QR code, or null for no QR. */
  qrText?: (v: TemplateValues) => string | null;
}

/** 1 pt in mm — type sizes in the book are in points. */
export const PT = 0.3528;
