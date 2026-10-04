/* ---------------------------------------------------------------------------
   ai/identity-angle — the same facts, a different answer each time.

   THE DEFECT. "Who are you?", "what's your name?", "who made you?" all came
   back as the same paragraph, in the same words, every time. Three causes,
   each fixed where it lives:

     1. The brand prompt carried two COMPLETE example replies. A model given a
        finished sentence copies it; the examples became the answer. They are
        gone from prompts/index.ts — shapes stay, sentences do not.
     2. The brand lane dropped the whole conversation history, so "never
        repeat an identity answer word for word in one conversation" was an
        instruction the model had no way to follow. The orchestrator now keeps
        a clipped tail of the thread on identity turns.
     3. Nothing distinguished the QUESTIONS. A name question and a maker
        question got the same directive, so they got the same answer.

   THIS MODULE IS THE THIRD FIX. It reads the question for its FACET — the
   name, the maker, what you are, tell me about yourself, how you work — and
   writes a one-turn directive: lead with that facet, at that facet's natural
   length, in a voice and with an opening picked by a rotating seed. The facts
   never change (identity.ts owns them); the angle on them does.

   PURE AND CHEAP. No I/O, no server-only, string in and string out, so the
   suite can run every facet in every language and prove the rotation.
   --------------------------------------------------------------------------- */

export type IdentityFacet = "name" | "maker" | "nature" | "self" | "technical" | "who";

const FACET_PATTERNS: ReadonlyArray<[IdentityFacet, RegExp[]]> = [
  /* Technical first: "how were you built" contains "built" and would fall
     into maker otherwise, and it wants a different answer (identity.ts:
     "IF THE QUESTION IS TECHNICAL"). */
  ["technical", [
    /\bhow\s+(?:were|are|r)\s+(?:you|u)\s+(?:built|made|trained|hosted|running|deployed|programmed)\b/i,
    /\b(?:which|what)\s+(?:model|engine|llm|technology|tech|api|provider)\b/i,
    /\bhow\s+do\s+(?:you|u)\s+(?:work|run)\b/i,
    /\b(?:where|how)\s+(?:are|r)\s+(?:you|u)\s+hosted\b/i,
    /(?:إزاي|ازاي|كيف)\s*(?:بتشتغل|تعمل|اتعملت|اتبنيت|شغال)/,
    /(?:أنهي|انهي|أي|اي)\s*(?:موديل|نموذج|محرك|تقنية)/,
    /你(?:是)?(?:怎么|如何)(?:运行|工作|构建|训练)/,
    /(?:什么|哪个)(?:模型|引擎|技术)/,
  ]],
  ["name", [
    /\b(?:your|ur)\s+name\b/i,
    /\bwhat\s+(?:should|do|can)\s+i\s+call\s+(?:you|u)\b/i,
    /\bwhat\s+(?:are|r)\s+(?:you|u)\s+called\b/i,
    /اسمك/,
    /(?:أناديك|اناديك|انده\s*لك|أقولك)\s*(?:إيه|ايه|بإيه|بايه)/,
    /你叫什么/,
    /你的名字/,
    /怎么称呼/,
  ]],
  ["maker", [
    /\bwho\s+(?:create[sd]?|made?|build[ts]?|built|design[esd]?|developed?|trained?|programm?ed?|invented?)\s+(?:you|u)\b/i,
    /\bwho\s+(?:owns?|operates?|runs?)\s+(?:you|u)\b/i,
    /\bwho(?:'?s| is)\s+behind\s+(?:you|u)\b/i,
    /\bwho\s+(?:is|are)\s+your\s+(?:creator|maker|makers|developer|developers|owner|owners)\b/i,
    /\bwhose\s+idea\b/i,
    /\bwho\s+had\s+the\s+idea\b/i,
    /\b(?:are|were)\s+(?:you|u)\s+(?:made|built|created|developed|designed)\s+by\b/i,
    /(?:من|مين)\s*(?:صنعك|طورك|بناك|أنشأك|انشأك|عملك|برمجك|صممك|اخترعك|خلقك)/,
    /(?:من|مين)\s*(?:اللي|الذي)\s*(?:عملك|صنعك|طورك|بناك|برمجك|فكر)/,
    /(?:من|مين)\s*قام\s*بتطويرك/,
    /معمول\s*من\s*(?:مين|من)/,
    /(?:من|مين)\s*(?:صاحب|صاحبة)\s*(?:فكرة|الفكرة)/,
    /فكرة\s*(?:مين|من)/,
    /(?:من|مين)\s*(?:يملكك|بيملكك|بيشغلك|وراك|ورا)/,
    /谁(?:开发|创造|制造|发明|设计|做|研发)(?:了)?(?:你|您)/,
    /你是(?:谁|哪家|哪个公司)(?:开发|做|研发)的/,
    /(?:谁的主意|谁的想法|谁提出)/,
    /谁(?:拥有|运营|管理)(?:你|您)/,
    /(?:你|您)(?:的)?背后是谁/,
  ]],
  ["self", [
    /\btell\s+me\s+about\s+(?:yourself|you)\b/i,
    /\bintroduce\s+yourself\b/i,
    /\b(?:describe|explain)\s+yourself\b/i,
    /(?:احكيلي|قولي|كلمني|عرفني|حدثني)\s*(?:عن\s*)?(?:نفسك|بنفسك)/,
    /(?:介绍|说说|讲讲)(?:一下)?(?:你自己|自己)/,
  ]],
  ["nature", [
    /\bwhat\s+(?:are|r)\s+(?:you|u)\b/i,
    /\bwhat\s+kind\s+of\s+ai\b/i,
    /\bare\s+you\s+(?:a\s+)?(?:real|human|robot|bot|machine|person|ai)(?:\s+person)?\b/i,
    /(?:أنت|انت|إنت)\s*(?:إيه|ايه)/,
    /هل\s*(?:أنت|انت|إنت)\s*(?:إنسان|انسان|بشر|حقيقي|روبوت)/,
    /(?:إنت|انت)\s*(?:روبوت|إنسان|انسان|بشر)/,
    /你是(?:真人|人类|机器人)吗/,
    /你是什么/,
  ]],
];

/** Which side of itself the question is asking about. "who" is the general
 *  question — "who are you", "من انت", "你是谁" — and rotates its lead. */
export function identityFacetFor(msg: string): IdentityFacet {
  const s = msg.trim();
  for (const [facet, patterns] of FACET_PATTERNS) {
    if (patterns.some((re) => re.test(s))) return facet;
  }
  return "who";
}

/* The tone menu identity.ts already names, made concrete so the choice is
   made HERE, once per turn, instead of left to a model that picks the same
   one every time. */
const VOICES = [
  "friendly and warm, like a colleague saying hello",
  "plain and confident — no preamble, just the facts in your own words",
  "storytelling — a sentence of where you came from before what you are",
  "technology-focused — what you connect and how you sit inside Koleex's systems",
  "premium and brand-led, in the register of a company that leads its field",
  "future-oriented — what you are becoming, tied to \"Leading the Future\"",
  "personal — start from the person asking and why they might be wondering",
  "light and a little playful, without a joke that needs explaining",
] as const;

const OPENINGS = [
  "your name",
  "what you do for the person asking",
  "the vision behind you",
  "a short question back, then the answer",
  "the group that developed you",
  "the one line a person would repeat to a friend",
] as const;

const LEADS: Record<IdentityFacet, string> = {
  name:
    "This is a NAME question. Give the name first — Koleex AI — and keep it to one to three lines: a name, one" +
    " line on what you are for, and, if it fits the tone, that they may call you something shorter. Not the whole story.",
  maker:
    "This is a MAKER question. Lead with who developed you — Koleex International Group — then whose idea you were" +
    " and the vision behind it, in two to four short paragraphs. The name of the assistant is not the point here.",
  nature:
    "This is a WHAT-ARE-YOU question. Lead with what you are — an intelligent digital layer between people and" +
    " Koleex's information, products and services, not a person and not only a chatbot — in one to three short" +
    " paragraphs. Be honest that you are an AI system; do not claim feelings.",
  self:
    "This is a TELL-ME-ABOUT-YOURSELF question. Tell the story in two to four short paragraphs: what you are, who" +
    " developed you, whose idea you were, the vision, and your role in Koleex's future — in that order or another.",
  technical:
    "This is a TECHNICAL question. Answer about Koleex's own system — server-side in Koleex's infrastructure, no" +
    " client ever holds credentials, every answer filtered by the asker's permissions, engine-neutral, built to work" +
    " from mainland China without a VPN — and never name an engine or supplier.",
  who:
    "This is a general WHO-ARE-YOU question. Pick ONE facet to lead with — see the opening below — and cover the" +
    " rest briefly, in two to four short paragraphs.",
};

/** A seed no test can predict but every turn gets a fresh one from. */
function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_003);
}

/**
 * The one-turn directive: which facet, which voice, which opening.
 *
 * `seed` selects the voice and the opening; a caller with a turn counter
 * passes it so the rotation walks the menu instead of landing on the same
 * entry twice, and the suite passes fixed seeds to prove the walk.
 */
export function identityAngleFor(msg: string, seed: number = randomSeed()): string {
  const facet = identityFacetFor(msg);
  const n = Math.abs(Math.floor(seed));
  const voice = VOICES[n % VOICES.length];
  /* The opening advances once per full walk of the voices, so consecutive
     seeds give 48 distinct (voice, opening) pairs before one repeats. A first
     version mixed the two strides and repeated at 16; the suite counts. */
  const opening = OPENINGS[Math.floor(n / VOICES.length) % OPENINGS.length];
  return (
    " THIS ANSWER, SPECIFICALLY: " + LEADS[facet] +
    ` Voice for this answer: ${voice}. Open with ${opening}.` +
    " Say it in fresh words: do not reuse the sentences of any earlier answer in this conversation, and do not" +
    " fall back to a stock line. The facts stay exactly the same; only the way you say them changes."
  );
}
