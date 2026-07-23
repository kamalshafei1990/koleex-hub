/* ---------------------------------------------------------------------------
   Personal-detail vocabularies for the Employee form.

   These were free-text inputs, so the same fact arrived spelled six ways
   ("Islam", "islam", "muslim", "Moslem") and no report could group on it.
   A closed list per field makes the column groupable; `Other` keeps the odd
   case enterable rather than blocked.

   Storage stays a plain string (the DB columns are `text`), so nothing here
   needs a migration — the list only constrains what the operator can pick.
   --------------------------------------------------------------------------- */

/** World religions + the non-religious answers an HR form must accept. */
export const RELIGION_OPTIONS: readonly string[] = [
  "Islam",
  "Christianity",
  "Catholicism",
  "Orthodox Christianity",
  "Protestantism",
  "Judaism",
  "Hinduism",
  "Buddhism",
  "Taoism",
  "Confucianism",
  "Sikhism",
  "Jainism",
  "Shinto",
  "Zoroastrianism",
  "Bahá'í",
  "Druze",
  "Yazidi",
  "Folk religion",
  "Agnostic",
  "Atheist",
  "None",
  "Prefer not to say",
  "Other",
];

/** Languages an employee may speak. Multi-select — a person is rarely
    monolingual, and the old single text field forced a comma-joined guess. */
export const LANGUAGE_OPTIONS: readonly string[] = [
  "Arabic",
  "English",
  "Chinese (Mandarin)",
  "Chinese (Cantonese)",
  "French",
  "Spanish",
  "German",
  "Italian",
  "Portuguese",
  "Russian",
  "Turkish",
  "Persian",
  "Urdu",
  "Hindi",
  "Bengali",
  "Punjabi",
  "Japanese",
  "Korean",
  "Vietnamese",
  "Thai",
  "Indonesian",
  "Malay",
  "Filipino",
  "Dutch",
  "Polish",
  "Ukrainian",
  "Romanian",
  "Greek",
  "Hebrew",
  "Kurdish",
  "Swahili",
  "Amharic",
  "Hausa",
  "Somali",
  "Uzbek",
  "Kazakh",
  "Nepali",
  "Sinhala",
  "Tamil",
  "Telugu",
  "Burmese",
  "Khmer",
  "Lao",
  "Mongolian",
  "Uyghur",
  "Tibetan",
  "Swedish",
  "Norwegian",
  "Danish",
  "Finnish",
  "Czech",
  "Hungarian",
  "Serbian",
  "Croatian",
  "Bulgarian",
];

/** Emergency-contact relationships. The old list was six entries and forced
    "Other" for anything as ordinary as a spouse's parent. */
export const RELATIONSHIP_OPTIONS: readonly string[] = [
  "",
  "Spouse",
  "Husband",
  "Wife",
  "Partner",
  "Fiancé(e)",
  "Father",
  "Mother",
  "Parent",
  "Son",
  "Daughter",
  "Child",
  "Brother",
  "Sister",
  "Sibling",
  "Grandfather",
  "Grandmother",
  "Grandson",
  "Granddaughter",
  "Uncle",
  "Aunt",
  "Nephew",
  "Niece",
  "Cousin",
  "Father-in-law",
  "Mother-in-law",
  "Son-in-law",
  "Daughter-in-law",
  "Brother-in-law",
  "Sister-in-law",
  "Stepfather",
  "Stepmother",
  "Stepchild",
  "Guardian",
  "Friend",
  "Neighbour",
  "Colleague",
  "Roommate",
  "Doctor",
  "Lawyer",
  "Other",
];

/** Number of children. Capped at 6+ because the field exists for benefits and
    dependant allowances, not for a census — beyond six the exact count stops
    changing any calculation. */
export const CHILDREN_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "—" },
  { value: "0", label: "0" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
  { value: "6", label: "6+" },
];

/** Split a stored multi-value string back into chips. Tolerates the comma,
    Arabic comma, Chinese comma and slash separators already in the data. */
export function splitMulti(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,،、/;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Join chips back to the single text column the DB already has. */
export function joinMulti(values: readonly string[]): string {
  return values.map((v) => v.trim()).filter(Boolean).join(", ");
}
