/* ---------------------------------------------------------------------------
   ai/core/canned-replies — the APPROVED Section 3 (Basic Conversation)
   answers, served before any provider call.

   Phase 2A. This table existed TWICE, byte-for-byte, in /api/ai/agent and
   /api/ai/chat, under a comment that asked a human to "keep in sync" — the
   kind of instruction that is correct on the day it is written and wrong
   some months later. The two copies were compared entry by entry before
   this file was created: the regexes and every Q1–Q10 string were identical
   and only the surrounding comments had drifted, so unifying them changes
   no behaviour. It is now one table.

   NOT to be merged with the fast-reply table in core/decide-turn.ts. That
   one is deliberately different and much narrower — greetings and thanks
   only, with short replies — because it serves the orchestrator, where a
   long canned paragraph would be the wrong shape. Two tables, two audiences,
   two names. If you find yourself deleting one, you are changing behaviour,
   not removing duplication.

   Pure: no imports, no I/O, no `server-only` — see core/decide-turn.ts for
   the reasoning.
   --------------------------------------------------------------------------- */

/* Canned replies using the APPROVED Section 3 (Basic Conversation)
   text verbatim. Exact-match regexes only — variations still flow
   to the orchestrator and get a natural response. Q9 "what are
   you?" intentionally NOT here — it routes through brand knowledge
   for the Section 2 identity answer. */
const Q1_GREETING =
  "Hello.\n\nKoleex AI is here and ready to help.\n\nFeel free to ask anything — about Koleex, business topics, or general questions — or to request assistance with tasks.\n\nHow can I help you today?";
const Q2_HOW_ARE_YOU =
  "I'm doing well, thank you for asking.\n\nEverything is running smoothly, and I'm ready to help with anything you need — whether it's a question, a task, or just a quick conversation.\n\nHow can I help you today?";
const Q3_HOW_OLD =
  "I don't have an age like a human.\n\nI'm a digital system, so I don't grow older, but I'm continuously updated and improved to provide better support and performance over time.\n\nYou can think of me as always up to date and evolving to serve you better.";
const Q4_WHAT_DOING =
  "I'm here with you and ready to help.\n\nRight now, I'm just waiting for your next question or anything you'd like me to do — whether it's answering something, helping with a task, or just having a quick chat.";
const Q5_WHERE_ARE_YOU =
  "I'm not in a physical place like a person.\n\nI exist digitally, so you can access me from anywhere — whether you're using a computer, a phone, or any connected device.\n\nSo in a way, I'm right here with you.";
const Q7_CAN_YOU_HELP =
  "Of course, I'd be happy to help.\n\nJust tell me what you need, and I'll do my best to assist — whether it's answering a question, helping with a task, or guiding you through something step by step.\n\nYou can keep it simple and just say what's on your mind. I'm here for you.";
const Q8_ARE_YOU_BUSY =
  "Not at all.\n\nI'm always available and ready to help you whenever you need.\n\nYou can ask anything or request any task, and I'll be here to support you. Take your time — I'm here.";
const Q10_PURPOSE =
  "My purpose is to make things easier for you.\n\nI'm here to help you find information, complete tasks, and communicate more smoothly — whether it's related to Koleex, business needs, or general questions.\n\nI'm designed to save you time, simplify processes, and support you whenever you need assistance.";

const CANNED_REPLIES: Array<[RegExp, string]> = [
  // Q1 — greetings
  [/^(hi|hello|hey|yo|hola)[\s,!.?]*$/i,                       Q1_GREETING],
  [/^(good\s+(morning|afternoon|evening|night))[\s,!.?]*$/i,   Q1_GREETING],
  [/^(salam|salaam|مرحبا|اهلا|أهلا|السلام)[\s,!.?]*$/i,         "مرحبا! أنا Koleex AI، جاهز لمساعدتك. اسأل عن أي شيء يخص Koleex أو أي موضوع آخر، أو اطلب مساعدة في أي مهمة."],
  [/^(你好|您好|嗨)[\s,!.?]*$/,                                 "你好!我是 Koleex AI,随时为您提供帮助。您可以问关于 Koleex、业务或任何其他话题的问题。"],

  // Q2 — how are you
  [/^how\s+(are|r)\s+(you|u)\s*[?!.]*$/i,                      Q2_HOW_ARE_YOU],
  [/^how's\s+it\s+going\s*[?!.]*$/i,                           Q2_HOW_ARE_YOU],

  // Q3 — how old are you
  [/^how\s+old\s+(are|r)\s+(you|u)\s*[?!.]*$/i,                Q3_HOW_OLD],

  // Q4 — what are you doing
  [/^what\s+(are|r)\s+(you|u)\s+doing(\s+now)?\s*[?!.]*$/i,    Q4_WHAT_DOING],

  // Q5 — where are you
  [/^where\s+(are|r)\s+(you|u)(\s+now)?\s*[?!.]*$/i,           Q5_WHERE_ARE_YOU],

  // Q7 — can you help / help me
  [/^(can\s+you\s+help\s+(me|us)|help\s+me)(\s+with\s+something)?\s*[?!.]*$/i, Q7_CAN_YOU_HELP],

  // Q8 — are you busy
  [/^(are|r)\s+(you|u)\s+busy(\s+right\s+now)?\s*[?!.]*$/i,    Q8_ARE_YOU_BUSY],

  // Q10 — what is your purpose
  [/^what('?s|\s+is)\s+your\s+purpose\s*[?!.]*$/i,             Q10_PURPOSE],

  /* Identity questions (Q9 "what are you", "who are you", "who
     created you", "what can you do") DROPPED — they flow through
     the orchestrator for Section 2 brand-knowledge answers. */

  // Acks
  [/^(thanks|thank\s+you|thx|ty)[\s!.?]*$/i,                   "You're welcome."],
  [/^(ok|okay|cool|got\s+it|understood)[\s!.?]*$/i,            "Okay."],
  [/^(bye|goodbye|see\s+you)[\s!.?]*$/i,                       "See you!"],
];

/** Exact-match lookup. Returns the approved answer, or null so the caller
 *  falls through to the model. Named tryCannedReply, NOT tryFastReply, so
 *  that importing the wrong one of the two tables is a compile error rather
 *  than a silent change of what users read. */
export function tryCannedReply(msg: string): string | null {
  const m = msg.trim();
  if (!m) return null;
  for (const [pat, reply] of CANNED_REPLIES) {
    if (pat.test(m)) return reply;
  }
  return null;
}
