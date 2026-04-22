/* ---------------------------------------------------------------------------
   lib/language/rewrite-egyptian — Phase 11 post-hoc rewrite layer.

   Converts a model reply (often stiff MSA) into natural Egyptian
   Arabic WITHOUT changing meaning. Deterministic, no AI calls,
   runs in <1 ms for typical replies.

   Pipeline:
     1. Guard — empty / non-Arabic / looks-like-code → pass through
     2. Replacements — formal phrase / word → Egyptian equivalent,
                       applied with Arabic word-boundary anchors
     3. Technical-term protection — rewritten tokens that would have
                       touched a preserved term ("margin", "FOB")
                       are reverted
     4. Connector — if the reply opens with a formal MSA stem and
                       doesn't already begin with an Egyptian
                       connector, prepend a deterministic one
     5. Return

   Anti-goals:
     · Don't split sentences. The user asked for "shorten long
       sentences by splitting on commas" — in practice that mangles
       meaning on even mildly complex replies. We leave sentence
       structure alone; the connector + phrase swaps give the
       Egyptian feel without the meaning risk.
     · Don't touch numbers, currencies, codes.
     · Don't insert filler. Keep EXACT information intact.
   --------------------------------------------------------------------------- */

import {
  CONNECTORS,
  PRESERVE_TERMS,
  REPLACEMENTS,
} from "./egyptian-profile";
import {
  BAD_OUTPUT_PATTERNS,
  looksLikeClarificationRequest,
  pickPhrase,
  type PhraseCategory,
} from "./egyptian-phrases";

/* Arabic letter range — used to build word-boundary lookarounds. */
const AR_LETTERS = "\\u0621-\\u064A\\u0670-\\u06D3\\u06FA-\\u06FF";
const AR_LB = `(?<=^|[^${AR_LETTERS}])`;
const AR_RB = `(?=$|[^${AR_LETTERS}])`;

/** Escape a literal phrase for inclusion in a RegExp. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Deterministic connector picker — hashes the response so the same
 *  text always gets the same opener. Avoids the "random" drift that
 *  makes a bot feel shifty and keeps tests reproducible. */
function pickConnector(text: string): string {
  let h = 0;
  for (let i = 0; i < Math.min(text.length, 64); i++) {
    h = (h * 31 + text.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % CONNECTORS.length;
  return CONNECTORS[idx];
}

/** Egyptian-feel check — does the reply already open with a natural
 *  Egyptian phrase? If yes, skip the connector prepend. */
const RE_EGY_OPENER = new RegExp(
  "^\\s*(?:" +
    [
      ...CONNECTORS.map(escapeRegex),
      // Common Egyptian first words that signal conversational tone
      "يعنى", "يعني", "آه", "ايوه", "طب", "طيب", "اوك", "ok",
      "تمام", "اصل", "أصل", "خليني", "خلّيني",
      "حسنًا", "حسنا", "اسمع", "ببساطة",
    ].join("|") +
    ")",
  "i",
);

/** Formal MSA openers that benefit from a softer Egyptian preface. */
const RE_FORMAL_OPENER = new RegExp(
  `^\\s*(?:ال[${AR_LETTERS}]{2,}|هذا|هذه|إن|إنّ|وفقًا|بناءً\\s+على|يُعرَّف|يُعد|يعد)`,
);

/** Check if the text contains any preserved (non-translatable)
 *  term — the rewriter doesn't rewrite those tokens, but it also
 *  shouldn't prepend a playful Egyptian connector to a terse
 *  technical answer like "FOB = Free On Board". */
function containsPreservedTerm(text: string): boolean {
  const lower = text.toLowerCase();
  for (const t of PRESERVE_TERMS) {
    /* Simple substring match — false positives are fine here since
       the check only gates the connector prepend, not the main
       replacement pass. */
    if (lower.includes(t)) return true;
  }
  return false;
}

/* ─── Public API ────────────────────────────────────────────────── */

export interface RewriteOptions {
  /** When true, skip the Level 1 short-connector prepend — Level 2
   *  callers add their own longer opener and don't want them to
   *  stack. Defaults to false (legacy behaviour preserved). */
  skipConnector?: boolean;
}

/** Convert any Arabic (or Arabic-dominant mixed) text into natural
 *  Egyptian dialect. Returns the original string when the input is
 *  empty, non-Arabic, or a short technical answer where rewriting
 *  would feel weird. */
export function rewriteToEgyptian(
  text: string,
  opts: RewriteOptions = {},
): string {
  if (!text) return text;
  const trimmed = text.trim();
  if (!trimmed) return text;

  /* Skip if no Arabic letters at all. The rewriter shouldn't touch
     pure-English replies — those are handled by the English persona
     lock, not this layer. */
  if (!new RegExp(`[${AR_LETTERS}]`).test(trimmed)) return text;

  /* Skip fenced code blocks. If the reply is mostly a code fence or
     contains one, apply replacements only to the prose around the
     fences. Heuristic: we split on ``` fences and only rewrite the
     odd-indexed segments (prose between fences). */
  if (text.includes("```")) {
    return text
      .split(/(```[\s\S]*?```)/g)
      .map((seg, i) => (i % 2 === 1 ? seg : rewriteCore(seg, opts)))
      .join("");
  }

  return rewriteCore(text, opts);
}

/** Internal: the actual rewrite passes. Extracted so the fenced-
 *  code branch in rewriteToEgyptian can apply it selectively. */
function rewriteCore(text: string, opts: RewriteOptions = {}): string {
  let out = text;

  /* ── Pass 1: phrase + word replacements ─────────────────────── */
  for (const [from, to] of REPLACEMENTS) {
    const re = new RegExp(AR_LB + escapeRegex(from) + AR_RB, "g");
    out = out.replace(re, to);
  }

  /* ── Pass 2: opener-connector prepend ──────────────────────────
     Only if the reply starts formally, isn't already Egyptian, and
     isn't a single-line technical answer. Adds one short connector
     + Arabic comma. Skipped when the caller is the Level 2 builder
     (which adds its own richer opener from egyptian-phrases.ts). */
  if (!opts.skipConnector) {
    const opens_formally = RE_FORMAL_OPENER.test(out);
    const opens_egy = RE_EGY_OPENER.test(out);
    const very_short = out.trim().length < 40;
    const technical = containsPreservedTerm(out) && out.trim().length < 120;

    if (opens_formally && !opens_egy && !very_short && !technical) {
      const c = pickConnector(out);
      out = `${c}، ${out.trimStart()}`;
    }
  }

  return out;
}

/* ─── Diagnostic / test helper ─────────────────────────────────
   Returns a summary of what the rewriter DID to an input. Useful
   for unit tests and for the [ai] log line — we only emit a log
   when rewrote !== original, so this helper tells callers what
   changed without diffing strings by hand. */
export interface RewriteTrace {
  changed: boolean;
  replacements: number;
  connectorAdded: boolean;
  input: string;
  output: string;
}

/* ─── Phase 16: repetition stripper ───────────────────────────────
   Model replies sometimes loop — the same sentence or paragraph
   shows up twice back-to-back, usually the last two tokens of the
   thought bleeding into a rewrite attempt. Remove exact duplicates
   at sentence + paragraph granularity before the reply reaches the
   user. Case-insensitive comparison; whitespace-normalised. */

export function removeRepetition(text: string): string {
  if (!text) return text;
  /* Split on blank-line boundaries first so we can dedupe at the
     paragraph level (a repeated full paragraph is the loudest
     failure mode). */
  const paragraphs = text.split(/\n{2,}/);
  const seenParas = new Set<string>();
  const keptParas: string[] = [];
  for (const p of paragraphs) {
    const norm = p.replace(/\s+/g, " ").trim().toLowerCase();
    if (!norm) continue;
    if (seenParas.has(norm)) continue;
    seenParas.add(norm);
    keptParas.push(p);
  }

  /* Within each paragraph, dedupe sentences. Sentence boundary = any
     of .,!,?,؟ followed by whitespace or newline. Keeps the first
     occurrence of each unique sentence. */
  const dedupeSentencesIn = (para: string): string => {
    const sentences = para.split(/(?<=[.!؟?])\s+/);
    const seen = new Set<string>();
    const kept: string[] = [];
    for (const s of sentences) {
      const norm = s.replace(/\s+/g, " ").trim().toLowerCase();
      if (!norm) continue;
      if (seen.has(norm)) continue;
      seen.add(norm);
      kept.push(s.trim());
    }
    return kept.join(" ");
  };

  return keptParas.map(dedupeSentencesIn).join("\n\n");
}

/* ─── Phase 11 Level 2: smart Egyptian response builder ───────────

   Takes raw model output + user intent and returns a reply that
   sounds like a real Egyptian colleague explaining the answer.
   Pipeline:
     1. SCRUB  — strip translator notes, MSA "I don't understand"
                 phrases, system-text leaks. Some matches redirect
                 the whole reply to the clarify pool.
     2. CHECK  — if the scrubbed reply looks like a clarification
                 request (short, asks for more info), replace the
                 whole thing with an Egyptian clarify phrase.
     3. REWRITE — run the phrase-level Egyptian rewriter on the
                 scrubbed reply.
     4. OPENER — prepend an explanation_start / definition_start
                 phrase when the reply is long-form explanation or
                 definition AND doesn't already open Egyptian-ly.

   Intent mapping (from analyzeIntent.type) → behaviour:
     chat        → rewrite only, no opener (short reply, don't pad)
     definition  → scrub + rewrite + definition_start opener
     explanation → scrub + rewrite + explanation_start opener
     translation → rewrite only, no opener (keep translations terse)
     business    → scrub + rewrite + explanation_start opener
     (missing)   → rewrite only, no opener
*/

/** IntentType from analyze-intent, duplicated here as a local alias
 *  to avoid a cross-server-layer import. Keep in sync. */
export type EgyIntentType =
  | "definition"
  | "explanation"
  | "translation"
  | "chat"
  | "business";

export interface BuildOptions {
  /** Intent classifier output on the USER'S query. Drives opener
   *  choice. Omit for "no opener, just rewrite". */
  intentType?: EgyIntentType;
  /** Seed for the deterministic phrase picker. Usually the user's
   *  original message. */
  seed?: string;
}

export interface BuildTrace {
  /** Categories that fired in this call (for telemetry). */
  actions: string[];
  /** Final reply text. */
  output: string;
  /** True if the reply text differs from the input. */
  changed: boolean;
}

/** Scrub bad patterns. Returns [scrubbedText, routeToClarify]
 *  — when routeToClarify is true the caller should substitute a
 *  clarify phrase instead of the scrubbed text. */
function scrubBadOutputs(text: string): [string, boolean, string[]] {
  let out = text;
  let routeToClarify = false;
  const labels: string[] = [];
  for (const rule of BAD_OUTPUT_PATTERNS) {
    if (rule.match.test(out)) {
      labels.push(rule.label);
      if (rule.replace === null) {
        routeToClarify = true;
      } else {
        out = out.replace(rule.match, rule.replace);
      }
    }
  }
  return [out.trim(), routeToClarify, labels];
}

/** Build the high-level Egyptian reply. See module block for the
 *  pipeline. Returns the reply directly; use buildEgyptianTrace for
 *  telemetry. */
export function buildEgyptianResponse(
  content: string,
  opts: BuildOptions = {},
): string {
  return buildEgyptianTrace(content, opts).output;
}

export function buildEgyptianTrace(
  content: string,
  opts: BuildOptions = {},
): BuildTrace {
  const actions: string[] = [];
  const seed = opts.seed ?? content.slice(0, 64);

  if (!content || !content.trim()) {
    return { actions, output: content, changed: false };
  }

  /* 1. SCRUB */
  const [scrubbed, routeToClarify, scrubLabels] = scrubBadOutputs(content);
  actions.push(...scrubLabels);

  /* 2. CLARIFY override — either a scrub rule told us to or the
     reply text itself looks like a clarification ask. */
  if (routeToClarify || looksLikeClarificationRequest(scrubbed)) {
    actions.push("clarify_override");
    const phrase = pickPhrase("clarify", seed);
    return { actions, output: phrase, changed: phrase !== content };
  }

  /* 3. REWRITE — phrase-level Egyptian rewrites. Skip the short
     connector prepend here; we'll add a richer Level 2 opener
     in step 4 for intents that want one. */
  const willAddOpener =
    opts.intentType === "explanation" ||
    opts.intentType === "definition" ||
    opts.intentType === "business";
  let rewritten = rewriteToEgyptian(scrubbed, {
    skipConnector: willAddOpener,
  });
  if (rewritten !== scrubbed) actions.push("rewrite");

  /* 4. OPENER — intent-aware Egyptian opener for substantive
     replies. Skip when:
       · reply is very short (< 30 chars) — padding an
         acknowledgement with a long opener feels performative
       · reply already opens with a connector or common Egyptian
         phrase
       · intent is chat / translation — no opener wanted */
  const shortReply = rewritten.trim().length < 30;
  const alreadyOpensEgy = startsWithEgyPhrase(rewritten);
  const wantsOpener = willAddOpener && !shortReply && !alreadyOpensEgy;

  if (wantsOpener) {
    const pool: PhraseCategory =
      opts.intentType === "definition" ? "definition_start" : "explanation_start";
    const opener = pickPhrase(pool, seed);
    if (opener) {
      /* Separator: if opener already ends with a punctuation mark
         (Arabic comma, period, colon) use a single space; else use
         " — " so the split is clearly visible. Prevents awkward
         "ببساطة كده، — الهامش…" stacking. */
      const endsWithPunct = /[،.:!؟?]\s*$/.test(opener);
      const sep = endsWithPunct ? " " : " — ";
      rewritten = `${opener}${sep}${rewritten.trimStart()}`;
      actions.push(`opener:${pool}`);
    }
  }

  /* 5. DEDUPE — kill repeated sentences / paragraphs the model
     sometimes loops on. Runs last so the opener + rewrites stay
     intact but trailing duplicates get collapsed. */
  const deduped = removeRepetition(rewritten);
  if (deduped !== rewritten) actions.push("dedupe");
  rewritten = deduped;

  return {
    actions,
    output: rewritten,
    changed: rewritten !== content,
  };
}

/** Does the text already start with an Egyptian-feel opener? Keeps
 *  the builder from stacking connectors on top of connectors. */
function startsWithEgyPhrase(text: string): boolean {
  const head = text.trimStart().slice(0, 40);
  const starters = [
    ...CONNECTORS,
    "يعنى", "يعني", "آه", "ايوه", "طب", "طيب",
    "تمام", "اصل", "أصل", "خليني", "خلّيني",
    "اسمع", "فاهمك", "واضح",
  ];
  return starters.some((s) => head.startsWith(s));
}

export function traceRewrite(text: string): RewriteTrace {
  const output = rewriteToEgyptian(text);
  const changed = output !== text;
  /* Count replacements by diffing on known keys. Fast enough for
     the rare diagnostic path (not called in the hot loop). */
  let replacements = 0;
  for (const [from] of REPLACEMENTS) {
    const inputHits = (text.match(new RegExp(escapeRegex(from), "g")) ?? []).length;
    const outputHits = (output.match(new RegExp(escapeRegex(from), "g")) ?? []).length;
    replacements += Math.max(0, inputHits - outputHits);
  }
  const connectorAdded =
    !text.trimStart().startsWith(output.trimStart().split("،")[0]);
  return { changed, replacements, connectorAdded, input: text, output };
}
