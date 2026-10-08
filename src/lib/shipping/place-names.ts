/* ---------------------------------------------------------------------------
   Place names — a port's name in the screen's language (plan published
   26/09/2026; the owner took every recommendation: "do the right way").

   A TRANSLATED DISPLAY NAME is the fifth identifier concept of the owner's
   rule (15/09/2026) — it is not a UN/LOCODE, not IATA, not a provider code
   and not a trade alias. It is SHOWN, never resolved: nothing here turns a
   name back into a port. The Latin `name` stays what is stored, sent to a
   provider and printed (a bill of lading carries the official spelling) —
   the invitation letters' cityDisplayName keeps the same rule.

   Only a name a person APPROVED is ever shown. An unreviewed port keeps its
   Latin name: empty beats a guess, and the proposals (Wikidata, by
   UN/LOCODE) are wrong often enough — Lobito came back as «وبيتو».

   Pure: the picker, the review screen, the API and the seed script share it.
   --------------------------------------------------------------------------- */

export const PLACE_NAME_LANGS = ["ar", "zh"] as const;
export type PlaceNameLang = (typeof PLACE_NAME_LANGS)[number];
/** The approved names of one place, by language. */
export type PlaceNames = Partial<Record<PlaceNameLang, string>>;
export type PlaceNameStatus = "proposed" | "approved" | "rejected";

export const PLACE_NAME_MAX = 120;

export const isPlaceNameLang = (v: unknown): v is PlaceNameLang => v === "ar" || v === "zh";

/** What the screen shows: the approved name in its language, else the Latin one. */
export function placeName(latin: string, names: PlaceNames | null | undefined, lang: string): string {
  const own = isPlaceNameLang(lang) ? names?.[lang] : undefined;
  return own || latin;
}

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿ]/;
const CJK = /[㐀-䶿一-鿿豈-﫿]/;
export const hasArabic = (s: string) => ARABIC.test(s);
export const hasCjk = (s: string) => CJK.test(s);
/** A search typed in Arabic or Chinese — the only kind that reads translated names. */
export const isTranslatedTerm = (s: string) => hasArabic(s) || hasCjk(s);

/** A name for a language must be written in it, short, and plain text.
 *  Returns the cleaned name, or null when it cannot be stored. */
export function checkPlaceName(lang: PlaceNameLang, raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!v || v.length > PLACE_NAME_MAX) return null;
  if (lang === "ar" ? !hasArabic(v) : !hasCjk(v)) return null;
  if (/[<>{}\\]/.test(v)) return null;
  return v;
}

/** What a search matches on. Arabic without tashkeel or tatweel, every alef
 *  as ا, ة as ه, ى and ئ as ي, ؤ as و — so «الاسكندريه» finds «الإسكندرية».
 *  Chinese is kept as written; Latin is lower-cased. */
export function placeSearchKey(s: string): string {
  return (s || "")
    .normalize("NFC")
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىئ]/g, "ي")
    .replace(/ؤ/g, "و")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/* ── Where review starts (owner's pick, 26/09/2026) ─────────────────────────
   Koleex's own ports, then China, Egypt and the Arab states: 544 ports. */
export const ARAB_STATES = [
  "EG", "SA", "AE", "OM", "QA", "BH", "KW", "IQ", "JO", "LB", "SY",
  "YE", "SD", "LY", "TN", "DZ", "MA", "MR", "DJ", "SO", "PS", "KM",
] as const;
export const NAME_GROUPS = ["koleex", "cn", "eg", "arab", "all"] as const;
export type NameGroup = (typeof NAME_GROUPS)[number];
export const isNameGroup = (v: unknown): v is NameGroup => (NAME_GROUPS as readonly unknown[]).includes(v);
