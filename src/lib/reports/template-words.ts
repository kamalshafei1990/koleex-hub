/* ---------------------------------------------------------------------------
   Reports — the few words helpers a page needs for a builder type (Phase 4E):
   its key, its name in the reader's language, its words as the Reports
   dictionary holds a built-in's. Kept apart from custom-templates.ts (the
   builder's rules), so the report pages carry none of the builder.
   --------------------------------------------------------------------------- */

import type { Lang, Translations } from "@/lib/i18n";
import type { RrIconName } from "@/components/ui/RrIcon";
import type { ReportCadence } from "./templates";

/** What work_reports.template_key holds for a builder type. */
export const CUSTOM_KEY = /^c-[a-z0-9]{10}$/;
export const isCustomKey = (key: unknown): key is string => typeof key === "string" && CUSTOM_KEY.test(key);

export type Word = Partial<Record<Lang, string>>;
export type TemplateWords = Record<string, Word>;

/** What a list needs of a report's type: its name, icon and period. */
export interface TemplateHead { name: Word; icon: RrIconName; cadence: ReportCadence; urgent: boolean }

const LANGS: Lang[] = ["en", "zh", "ar"];
export const isWritten = (w: Word | undefined): boolean => LANGS.some((l) => !!w?.[l]?.trim());

/** The word in this language — or, until someone writes it, in the one it
 *  was written in (English first, then Arabic, then Chinese). */
export function pickWord(w: Word | undefined, lang: Lang): string {
  if (!w) return "";
  return w[lang]?.trim() || w.en?.trim() || w.ar?.trim() || w.zh?.trim() || "";
}

/** A builder type's words as the Reports dictionary holds a built-in's
 *  (`tpl.<key>.…`, every language filled), so every screen that names a
 *  section, a point, a column or an answer reads them the same way. */
export function templateWords(key: string, words: TemplateWords): Translations {
  const out: Translations = {};
  for (const [k, w] of Object.entries(words)) {
    if (!isWritten(w)) continue;
    out[`tpl.${key}.${k}`] = { en: pickWord(w, "en"), zh: pickWord(w, "zh"), ar: pickWord(w, "ar") };
  }
  return out;
}

/** The names and descriptions of builder types, for a list or a picker. */
export function headWords(heads: Array<{ key: string; name: Word; desc: Word }>): Translations {
  const out: Translations = {};
  for (const h of heads) Object.assign(out, templateWords(h.key, { name: h.name, desc: h.desc }));
  return out;
}
