/* ---------------------------------------------------------------------------
   The title a new chat gets from its first message — one rule for the typed
   lane and the voice lane.

   Both routes used to cut the text by hand: the typed lane took the first
   four words (so a Chinese sentence, which has no spaces, came through
   whole — sixty ideographs in a 248 px row), the voice lane the first N
   characters (so an Arabic sentence was cut mid-word). Owner, 2026-09-13,
   against the ChatGPT sidebar: a title is a short label, in the language of
   the message.

   No model call: this runs on every first turn, on a route that must stay
   cheap, and a label does not need one. Pure, so it is proved by a suite.
   --------------------------------------------------------------------------- */
import { textScript } from "@/lib/text-direction";

const MAX_WORDS = 5;
const MAX_CHARS = 48;
const MAX_CJK_CHARS = 12;
/* Words a label should not end on, in the three languages this app speaks. */
const TRAILING_FILLER = new Set([
  "to", "of", "the", "a", "an", "and", "or", "for", "in", "on", "at", "with", "by", "about", "that", "is", "are", "be", "my", "our",
  "في", "من", "على", "و", "إلى", "الى", "عن", "أن", "ان", "اللي", "الذي", "التي", "مع", "لل", "ل", "يا",
]);
const TRAILING_CJK_FILLER = /[的和与及或了吗呢吧呀啊在是把给到]+$/;

function words(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

function stripMarkdown(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/^[\s>#*\-•·]+/gm, "")
    .replace(/[*_~]{1,3}/g, "");
}

function trimEnds(s: string): string {
  return s.replace(/^[\s"'“”‘’«»(\[{،,.:;!?؟؛。！？；：、，\-–—]+/, "").replace(/[\s"'“”‘’«»)\]}،,.:;!?؟؛。！？；：、，\-–—]+$/, "");
}

/* Chinese words, when the runtime can segment them (Node and every current
   browser ship ICU's dictionary-based segmenter); a plain character cut when
   it cannot. */
function cjkWords(s: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment(t: string): Iterable<{ segment: string; isWordLike?: boolean }> } }).Segmenter;
  if (!Seg) return Array.from(s);
  try {
    return Array.from(new Seg("zh", { granularity: "word" }).segment(s)).map((x) => x.segment);
  } catch {
    return Array.from(s);
  }
}

/* The clauses of the first line, greetings dropped: "Hello, can you…" and
   "你好，请帮我…" are about the second clause, not the first. */
const CLAUSE_SPLIT = /[.!?;:؟؛。！？；：,،，、]+\s*/;
function leadClause(line: string, cjk: boolean): string {
  const parts = line.split(CLAUSE_SPLIT).map((x) => x.trim()).filter(Boolean);
  if (parts.length === 0) return line;
  let i = 0;
  const short = (x: string) => (cjk ? Array.from(x).length <= 3 : words(x).length <= 2);
  while (i < parts.length - 1 && short(parts[i])) i++;
  /* A sentence or clause that is already a label's worth stands alone;
     a short first clause with nothing after it is kept whole. */
  const chosen = parts[i];
  if (cjk ? Array.from(chosen).length >= 4 : words(chosen).length >= 2) return chosen;
  return parts.slice(i).join(" ");
}

/** The label for a chat whose first message is `content`. Empty in → empty
 *  out; the caller keeps its own fallback ("New chat"). */
export function conversationTitle(content: string): string {
  const flat = stripMarkdown(content ?? "").replace(/\s+/g, " ").trim();
  if (!flat) return "";
  const cjk = textScript(flat) === "zh";
  const head = leadClause(flat, cjk);

  /* A label's length, cut on a boundary the script has. */
  let out: string;
  if (cjk) {
    out = "";
    for (const w of cjkWords(head)) {
      if (Array.from(out + w).length > MAX_CJK_CHARS) break;
      out += w;
    }
    if (!out) out = Array.from(head).slice(0, MAX_CJK_CHARS).join("");
    out = out.replace(TRAILING_CJK_FILLER, "");
  } else {
    const ws = words(head).slice(0, MAX_WORDS);
    while (ws.length > 1 && TRAILING_FILLER.has(ws[ws.length - 1].toLowerCase().replace(/[^\p{L}]/gu, ""))) ws.pop();
    out = ws.join(" ");
    if (out.length > MAX_CHARS) {
      const cut = out.lastIndexOf(" ", MAX_CHARS);
      out = cut > 12 ? out.slice(0, cut) : out.slice(0, MAX_CHARS);
    }
  }
  out = trimEnds(out);
  return out || trimEnds(Array.from(flat).slice(0, MAX_CHARS).join(""));
}
