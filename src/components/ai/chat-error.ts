/* ---------------------------------------------------------------------------
   components/ai/chat-error — a failed turn, said in the chat's own words.

   The chat used the Hub-wide humanizeError, whose Arabic is formal ("تحقق
   من اتصالك ثم أعد المحاولة") inside an Egyptian screen, and which passes an
   unknown sentence through as it is — so the server's English "Koleex AI hit
   a problem while answering" reached Arabic and Chinese screens word for
   word (review, 2026-09-26). The failures a chat turn actually meets are few:
   the link dropped, the answer failed, the server said a bare HTTP status.
   Those three are said here from copy.ts; anything else still goes through
   humanizeError, which knows permissions and sessions.

   The language is read the way humanizeError reads it (the header switcher's
   localStorage key), so a callback with no `copy` in reach can still say it.
   Pure apart from that read; no React.
   --------------------------------------------------------------------------- */

import { humanizeError } from "@/lib/ui/humanize-error";
import { COPY } from "@/components/ai/copy";
import type { Lang } from "@/lib/i18n";

/** The sentence the agent route sends with an error frame. */
export const SERVER_ANSWER_FAILED = "Koleex AI hit a problem while answering. Please try again.";

function activeChatLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const v = window.localStorage.getItem("koleex-lang");
    return v === "ar" || v === "zh" ? v : "en";
  } catch {
    return "en";
  }
}

export function chatError(input: unknown, lang: Lang = activeChatLang()): string {
  const copy = COPY[lang] ?? COPY.en;
  const raw = input instanceof Error ? input.message : typeof input === "string" ? input : "";
  if (/network|fetch failed|failed to fetch|load failed/i.test(raw)) return copy.networkDropped;
  if (raw === SERVER_ANSWER_FAILED) return copy.answerFailed;
  if (/^HTTP\s?5\d\d\b/.test(raw) || /timeout/i.test(raw)) return copy.answerFailed;
  if (/^HTTP\s?\d{3}\b/.test(raw)) return copy.somethingWrong;
  return humanizeError(input);
}
