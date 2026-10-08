import "server-only";

/* ---------------------------------------------------------------------------
   ai/seals/text — the text-level seals.

   Phase 2B. These run on the model's raw text, before any evidence check:
   strip tool syntax the model leaked into prose, enforce the Latin brand
   spelling, and rescue a usable answer out of tool results when the model
   returns nothing legible.

   Pure and synchronous, like every module under seals/. A seal that needed
   to await something could not be reasoned about at the one funnel.
   --------------------------------------------------------------------------- */

import type { AgentStep } from "@/lib/server/ai-agent/types";

/** Post-process any model reply to enforce the brand-name rule:
 *  "Koleex" (and its sub-brand names) must appear in Latin letters in
 *  every language. Small models drift here — they echo the user's
 *  Arabic/Chinese transliteration even when the system prompt forbids
 *  it. A deterministic string-replace is the simplest guarantee. */
const BRAND_NAME_REPLACEMENTS: Array<[RegExp, string]> = [
  [/كوليكس/g, "Koleex"],
  [/كوليكس جروب/g, "Koleex Group"],
  [/مجموعة كوليكس/g, "Koleex Group"],
  [/柯莱克斯/g, "Koleex"],
  [/科莱克斯/g, "Koleex"],
  [/كوليكس هاب/g, "Koleex Hub"],
];
export function normaliseBrandName(text: string): string {
  let out = text;
  for (const [pattern, replacement] of BRAND_NAME_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/* ─── Tool-syntax sanitizer ─────────────────────────────────────────
   Llama 3.x models occasionally emit tool-call syntax inline in the
   assistant `content` field instead of the structured `tool_calls`
   array (known quirk on 8B-instant; also seen on 70B under load).
   When that happens the raw markers flow into the chat bubble and
   users see something like:
       <function=searchProducts>{"query":"DD"}</function>
   This helper strips those markers unconditionally before the reply
   leaves the server. Three forms are covered:
     · <function=NAME>…</function>
     · <tool_call>…</tool_call>
     · [tool:NAME(…)]
   After stripping, whitespace is collapsed. If nothing is left we
   return "" so callers can substitute a clean follow-up instead of
   showing a blank message. */
export function cleanAssistantText(raw: string): string {
  if (!raw) return "";
  const stripped = raw
    .replace(/<function[=\s][\s\S]*?<\/function>/gi, "")
    .replace(/<function[=\s][^>]*\/?>/gi, "") // orphan open/self-close
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/<tool_call[^>]*\/?>/gi, "")
    .replace(/\[tool\s*:[^\]]*\]/gi, "")
    /* MARKDOWN-SAFE collapse (2026-08-03 fix): the old /\s{2,}/ → " "
       ate every blank line, so "…answer.\n\n## Heading\n\nBody…"
       became "…answer. ## Heading Body…" and the whole reply rendered
       as one crowded run-on paragraph. Collapse only runs of spaces/
       tabs; cap newline runs at one blank line; keep structure. */
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return stripped;
}

/** Text patterns that look like internal debug/validation strings
 *  and should NOT be promoted to the user's final reply. Keeps the
 *  safety-fallback picker from grabbing "(cached)" or a terse tool
 *  error message like "productId required." and showing it raw. */
export function looksLikeDebug(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  if (t === "(cached)") return true;
  if (/^[a-zA-Z_]+\s+(required|missing)\.?$/i.test(t)) return true;
  if (/^(need|please provide)\b/i.test(t) && t.length < 80) return true;
  return false;
}

/** Picked when we have nothing clean to surface — keeps the tone
 *  conversational rather than exposing internals. */
export const GENERIC_FOLLOWUP = "Could you share a bit more so I can help?";

/** Best-effort rescue when the post-tool Groq call fails (429, 5xx,
 *  empty response). Scans steps[] from newest to oldest and returns
 *  the most recent successful tool-result text so the user sees the
 *  data the tools already fetched instead of a generic error banner.
 *
 *  Returns "" when nothing usable is in steps[] — the caller then
 *  falls back to its original error/follow-up message. */
export function rescueFromToolResults(steps: AgentStep[]): string {
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (
      s.kind === "tool-result" &&
      s.permissionStatus !== "denied" &&
      s.text
    ) {
      const cleaned = cleanAssistantText(s.text);
      if (cleaned && !looksLikeDebug(cleaned)) {
        return normaliseBrandName(cleaned);
      }
    }
  }
  return "";
}

/** Deprecated phrasings that older builds of the agent used to emit.
 *  They were removed from the code but still live inside ai_messages
 *  rows from past conversations. If we forward those turns to Groq
 *  as history, the model can quote them verbatim on the next turn —
 *  users then see "Need a customerId and at least one valid line"
 *  even though the code no longer produces that string anywhere.
 *
 *  The history sanitiser (applied before building the Groq message
 *  list) drops any ASSISTANT history row whose content matches one
 *  of these patterns. User turns are always preserved. */
export const BANNED_ECHOES: RegExp[] = [
  /Need a customer[Ii]d and at least one valid line/i,
  /productId required\.?$/i,
  /customerId required\.?$/i,
  /Please provide a search query\.?$/i,
  /Please provide a customer code\.?$/i,
  /\bUnknown tool\b/i,
];


/* ─── Leaked tool-markup scrubber ───────────────────────────────────
   Owner screenshot 2026-08-21: a reply ended in raw provider tool
   tokens — "DSML ｜ tool_calls> … invoke name=\"getProductFullDetails\"
   … parameter name=\"code\" …" — because once the per-turn tool budget
   flips toolChoice to "none", a model that still WANTS a tool writes
   the call into its content as text, special tokens and all. The
   system nudge alone does not stop it, so the last line of defense is
   here: cut the reply at the FIRST tool marker (legit prose always
   precedes the leak), and if nothing legible remains, replace it with
   an honest hand-back instead of an empty bubble. These markers can
   never appear in a legitimate user-facing answer. */
const TOOL_LEAK_RE =
  /<?\s*[|｜]?\s*DSML\s*[|｜]|<\s*tool_calls|tool_calls\s*>|<?\s*invoke\s+name=|<[|｜]tool[▁_]calls|antml:invoke/i;

export function scrubLeakedToolMarkup(reply: string): string {
  const m = TOOL_LEAK_RE.exec(reply);
  if (!m) return reply;
  const kept = reply.slice(0, m.index).trim();
  console.warn(
    `[ai.agent.tool-leak] raw tool markup scrubbed from final reply (at ${m.index}/${reply.length}).`,
  );
  if (kept.length >= 20) return kept;
  return "I hit this turn's tool limit before finishing. Say “continue” and I'll pick up right where I stopped.";
}

