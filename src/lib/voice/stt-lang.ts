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

   So: LEARNED, not asked. The first version put three language chips on the
   call screen; the owner did not want to be asked. Koleex AI hears the audio
   and answers in the caller's language, so its own replies say which
   language the caller speaks: the device remembers what it learned from the
   last call, and the server reads the same thing off the conversation's
   history before the client's guess. Until anything is learned, the device's
   language, then the UI language. Three codes, allow-listed here AND on the
   server (session-config.ts STT_LANGUAGES) — the value travels on a query
   string and a server writes it into a session.
   --------------------------------------------------------------------------- */

import { detectConversationLang } from "./script-lang";

export const STT_LANGS = ["ar", "en", "zh"] as const;
export type SttLang = (typeof STT_LANGS)[number];

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

/**
 * What a call taught us: the language Koleex AI answered in. Null when it has
 * not answered yet. Read from the transcript the screen already holds, so no
 * new event is needed — and from the assistant's lines only, for the reason
 * detectConversationLang gives.
 */
export function learnSttLang(lines: readonly { role: string; text: string; final?: boolean }[]): SttLang | null {
  const turns = lines.filter((l) => l.final !== false).map((l) => ({ role: l.role, content: l.text }));
  return detectConversationLang(turns);
}
