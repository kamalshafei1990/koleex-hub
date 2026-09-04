/* ---------------------------------------------------------------------------
   lib/ai-personalization — how ONE user wants Koleex AI to speak to them.

   The owner put ChatGPT's Personalization and Memory screens side by side
   with ours and asked what fitted. This is the part that did: a base style,
   four dials (warmth, enthusiasm, formatting, emoji), standing instructions
   in the user's own words, and the memory controls — on, a nickname, an
   occupation, a few lines about themselves, and a way to see and delete
   what Koleex AI has remembered.

   ONE SHAPE, THREE READERS. The Settings tab edits it, the API route
   normalises it, every prompt lane (chat, agent, voice) reads it. So the
   shape, its limits and its normaliser live in one client-safe module with
   no server import, and every reader gets the same answer to "what is this
   user's setting" — the trap being three private copies that disagree the
   day a field is added.

   STORED IN accounts.preferences.ai — the JSONB that already holds
   ai_memory and ai_reply_language. Per account by definition, tiny, and no
   migration: the standing rule is never a table that is not needed.

   WHAT THIS IS NOT. Preferences shape tone, format and personal context.
   They are written by the user and quoted to the model as the user's words;
   the prompt block that carries them (server/ai/personalization-prompt.ts)
   says so and says they change nothing about identity, permissions, data
   access or any rule of the system. Normalising here caps every string, so
   no field can carry a novel.
   --------------------------------------------------------------------------- */

export const AI_STYLES = ["default", "professional", "friendly", "candid", "efficient"] as const;
export type AiStyle = (typeof AI_STYLES)[number];

export const AI_LEVELS = ["less", "default", "more"] as const;
export type AiLevel = (typeof AI_LEVELS)[number];

export type AiPersonalization = {
  /** Base style and tone. */
  style: AiStyle;
  warmth: AiLevel;
  enthusiasm: AiLevel;
  /** Headings and lists: more structure, or more prose. */
  formatting: AiLevel;
  emoji: AiLevel;
  /** Show the suggestion tiles on the empty conversation. */
  suggestions: boolean;
  /** Standing instructions, in the user's words. Tone and context only. */
  instructions: string;
  /** Whether Koleex AI may remember facts the user tells it. */
  memory: boolean;
  nickname: string;
  occupation: string;
  about: string;
};

/** Hard caps. Every string is trimmed and cut here, whoever sends it. */
export const AI_PERSONALIZATION_LIMITS = {
  instructions: 1500,
  nickname: 40,
  occupation: 120,
  about: 600,
} as const;

export const DEFAULT_AI_PERSONALIZATION: AiPersonalization = {
  style: "default",
  warmth: "default",
  enthusiasm: "default",
  formatting: "default",
  emoji: "default",
  suggestions: true,
  instructions: "",
  memory: true,
  nickname: "",
  occupation: "",
  about: "",
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function pickEnum<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T {
  return typeof raw === "string" && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

function pickBool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === "boolean" ? raw : fallback;
}

/** Free text as the model will see it: control characters removed,
 *  whitespace collapsed (newlines kept — instructions are often a list),
 *  trimmed, capped. The « » quote marks are the delimiters the prompt block
 *  uses around the user's words, so they are turned into plain quotes here
 *  and a stored string can never close its own quotation early. */
export function cleanAiText(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[«»]/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max)
    .trim();
}

/** Anything → a complete, valid AiPersonalization. Unknown keys are
 *  dropped, unknown values fall back to the default, strings are cleaned
 *  and capped. Never throws: a broken stored value reads as defaults. */
export function normalizeAiPersonalization(raw: unknown): AiPersonalization {
  const r = isRecord(raw) ? raw : {};
  const L = AI_PERSONALIZATION_LIMITS;
  return {
    style: pickEnum(r.style, AI_STYLES, DEFAULT_AI_PERSONALIZATION.style),
    warmth: pickEnum(r.warmth, AI_LEVELS, DEFAULT_AI_PERSONALIZATION.warmth),
    enthusiasm: pickEnum(r.enthusiasm, AI_LEVELS, DEFAULT_AI_PERSONALIZATION.enthusiasm),
    formatting: pickEnum(r.formatting, AI_LEVELS, DEFAULT_AI_PERSONALIZATION.formatting),
    emoji: pickEnum(r.emoji, AI_LEVELS, DEFAULT_AI_PERSONALIZATION.emoji),
    suggestions: pickBool(r.suggestions, DEFAULT_AI_PERSONALIZATION.suggestions),
    instructions: cleanAiText(r.instructions, L.instructions),
    memory: pickBool(r.memory, DEFAULT_AI_PERSONALIZATION.memory),
    nickname: cleanAiText(r.nickname, L.nickname),
    occupation: cleanAiText(r.occupation, L.occupation),
    about: cleanAiText(r.about, L.about),
  };
}

/** Apply a partial edit on top of a stored value, then normalise. Only
 *  known keys are taken from the patch. */
export function patchAiPersonalization(
  current: unknown,
  patch: unknown,
): AiPersonalization {
  const base = normalizeAiPersonalization(current);
  if (!isRecord(patch)) return base;
  const merged: Record<string, unknown> = { ...base };
  for (const key of Object.keys(DEFAULT_AI_PERSONALIZATION) as (keyof AiPersonalization)[]) {
    if (key in patch) merged[key] = patch[key];
  }
  return normalizeAiPersonalization(merged);
}

/** True when nothing differs from the defaults — the prompt block is then
 *  empty and the model's behaviour is exactly what it was before this file. */
export function isDefaultAiPersonalization(p: AiPersonalization): boolean {
  return (Object.keys(DEFAULT_AI_PERSONALIZATION) as (keyof AiPersonalization)[])
    .every((k) => p[k] === DEFAULT_AI_PERSONALIZATION[k]);
}
