import type { Translations } from "@/lib/i18n";

/* Contacts — the `resumeType.*` strings, split out of the one 225 KB dictionary.
   See the header of ../contacts.ts for why. */

export const CT_RESUMETYPE: Translations = {
  /* ── Resume Line Types ── */
  "resumeType.experience":      { en: "Experience",                zh: "经验",                 ar: "الخبرة" },
  "resumeType.education":       { en: "Education",                 zh: "教育",                 ar: "التعليم" },
  "resumeType.training":        { en: "Training",                  zh: "培训",                 ar: "التدريب" },
  "resumeType.certification":   { en: "Certification",             zh: "认证",                 ar: "الشهادة" },
  "resumeType.internalCert":    { en: "Internal Certification",    zh: "内部认证",              ar: "شهادة داخلية" },
};
