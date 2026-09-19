import type { Translations } from "@/lib/i18n";

/* Contacts — the `refreshing.*` strings, split out of the one 225 KB dictionary.
   See the header of ../contacts.ts for why. */

export const CT_REFRESHING: Translations = {
  /* Shown beside the list title while fresh rows are fetched under a list that
     is already on screen (warm start + background revalidation). */
  "refreshing":           { en: "Updating…",             zh: "更新中…",               ar: "جارٍ التحديث…" },
};
