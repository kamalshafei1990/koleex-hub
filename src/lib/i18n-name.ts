import type { Lang } from "@/lib/i18n";

/* ---------------------------------------------------------------------------
   Localised display names for DB-stored reference data.

   Library rows (skill_categories, skills, behavior_categories,
   behavior_indicators) carry the English `name` as the source of truth plus
   optional `name_zh` / `name_ar`. English is ALWAYS the fallback: product and
   standard names (Python, Figma, ISO 9001) are deliberately left untranslated,
   and a missing translation must degrade to readable English — never to a
   blank label.

   The API returns all three columns so switching language is instant and needs
   no refetch; resolution happens here, at render time.
   --------------------------------------------------------------------------- */

export interface NamedRow {
  name: string;
  name_zh?: string | null;
  name_ar?: string | null;
}

/** The row's name in `lang`, falling back to English. */
export function localizedName(row: NamedRow | null | undefined, lang: Lang): string {
  if (!row) return "";
  const translated = lang === "zh" ? row.name_zh : lang === "ar" ? row.name_ar : null;
  return (translated ?? "").trim() || row.name;
}

/** Search haystack — matches what the user sees AND the English original, so
    an Arabic UI still finds "Python" and a Chinese UI still finds "Excel". */
export function nameMatches(row: NamedRow, query: string, lang: Lang): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    localizedName(row, lang).toLowerCase().includes(q) ||
    row.name.toLowerCase().includes(q)
  );
}
