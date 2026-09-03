/* ---------------------------------------------------------------------------
   voice/stt-lang — which language the caller SPEAKS, as distinct from which
   language the app is displayed in.

   THE BUG THIS REPLACES. The call sent the UI language as the transcription
   hint. The owner runs the Hub in English and speaks Egyptian Arabic, so
   every call told the transcriber "this is English" and the saved transcript
   of his own words came back as English nonsense ("On the autism spectrum,
   they were") while Koleex AI — which hears the audio, not the transcript —
   answered him correctly in Arabic. The two languages are different facts
   and only the caller knows the second one.

   So: a choice the caller makes, remembered on the device, defaulting to
   the best guess available (the device's own language when it is one the
   transcriber supports, else the UI language). Three codes, allow-listed
   here AND on the server (session-config.ts STT_LANGUAGES) — the value
   travels on a query string and a server writes it into a session.
   --------------------------------------------------------------------------- */

export const STT_LANGS = ["ar", "en", "zh"] as const;
export type SttLang = (typeof STT_LANGS)[number];

/** How each option reads on the chip — in its own script, because the person
 *  choosing it reads that script. Not the product language; the caller's. */
export const STT_LANG_LABELS: Record<SttLang, string> = {
  ar: "عربي",
  en: "English",
  zh: "中文",
};

export const STT_STORAGE_KEY = "koleex-voice-stt";

export function parseSttLang(raw: string | null | undefined): SttLang | null {
  const v = (raw ?? "").trim().toLowerCase();
  return (STT_LANGS as readonly string[]).includes(v) ? (v as SttLang) : null;
}

/**
 * The language to transcribe as, in order of who knows best:
 *   1. what the caller chose before (saved on this device),
 *   2. the device's own language, when the transcriber supports it,
 *   3. the UI language.
 * Pure: every input is handed in, so the suite can drive it.
 */
export function pickSttLang(
  saved: string | null | undefined,
  deviceLanguage: string | null | undefined,
  uiLang: string | null | undefined,
): SttLang {
  const chosen = parseSttLang(saved);
  if (chosen) return chosen;
  const device = parseSttLang((deviceLanguage ?? "").split(/[-_]/)[0]);
  if (device) return device;
  return parseSttLang(uiLang) ?? "en";
}

/** Read the device's memory. Never throws — storage can be absent or refused. */
export function readSavedSttLang(): SttLang | null {
  try {
    return parseSttLang(window.localStorage.getItem(STT_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Remember the caller's choice. Never throws. */
export function saveSttLang(lang: SttLang): void {
  try {
    window.localStorage.setItem(STT_STORAGE_KEY, lang);
  } catch {
    /* Private mode or a full store: the choice lasts for this page. */
  }
}
