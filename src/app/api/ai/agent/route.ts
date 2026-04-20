import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/ai/agent
     body: { conversationId: string, content: string, user_lang?: 'en'|'zh'|'ar' }
     response: AgentResponse  (see ai-agent/types.ts)

   Thin wrapper around the orchestrator:
   - requireAuth() + ownership check (sequential — 404 must stay side-effect-free)
   - fast-path for canned prompts (greetings / identity / thanks / acks):
       · skips history SELECT + buildUserContext + orchestrator entirely
       · three parallel DB writes (user insert, assistant insert, conv update)
       · response shape identical to the orchestrator path
   - non-canned path:
       · history SELECT (last 10), buildUserContext, user-insert run in parallel
       · orchestrate() once dependencies resolve
       · assistant-insert + conversation update run in parallel

   Conversation storage stays in the existing ai_conversations /
   ai_messages tables so the sidebar, rename, delete flows keep
   working. Tool-call and tool-result steps live only in the wire
   response (replayed to the UI in this turn, then the audit table
   is the permanent record).

   Timing log: [ai.agent.timing] reports auth / conv / deps / orch / writes
   / total ms. canned=1 flag marks the fast-path branch.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { buildUserContext } from "@/lib/server/ai-agent/permissions";
import { orchestrate } from "@/lib/server/ai-agent/orchestrator";
import type { AgentResponse } from "@/lib/server/ai-agent/types";

/* Hard cap on history we ship to the orchestrator. 10 messages = 5
   user+assistant pairs; enough for multi-turn context, small enough
   that the payload stays well under provider limits. Pure performance
   cap — does not alter tool routing or business behaviour. */
const HISTORY_LIMIT = 10;

/* Canned fast-path mirror. Keep in sync with /api/ai/chat FAST_REPLIES
   and orchestrator.ts. Matched server-side before any provider call —
   skips buildUserContext + history SELECT + orchestrator entirely so
   greetings / identity / acks return in roughly the auth+writes budget
   instead of auth+6-round-trips+provider. */
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

const FAST_REPLIES: Array<[RegExp, string]> = [
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

function tryFastReply(msg: string): string | null {
  const m = msg.trim();
  if (!m) return null;
  for (const [pat, reply] of FAST_REPLIES) {
    if (pat.test(m)) return reply;
  }
  return null;
}

/** Auto-title rule — identical to /chat. Pulled into a helper so the
 *  canned and non-canned branches can share it without drift. */
function computeTitle(
  conv: { title: string | null; message_count: number | null },
  content: string,
): string | null {
  if ((conv.title !== "New chat" && conv.title) || (conv.message_count ?? 0) !== 0) {
    return conv.title;
  }
  const trimmed = content.trim();
  const words = trimmed.split(/\s+/);
  return words.length <= 4
    ? trimmed.slice(0, 60)
    : words.slice(0, 4).join(" ").slice(0, 60);
}

export async function POST(req: Request) {
  const t0 = Date.now();
  const auth = await requireAuth();
  const tAuth = Date.now();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    conversationId?: string;
    content?: string;
    user_lang?: "en" | "zh" | "ar";
  };

  const content = body.content?.trim();
  const conversationId = body.conversationId;
  if (!content) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId required" }, { status: 400 });
  }

  /* Confirm the conversation is mine. Must stay sequential — a 404
     should be side-effect-free; no inserts fire if the conv isn't ours. */
  const { data: conv } = await supabaseServer
    .from("ai_conversations")
    .select("id, title, message_count")
    .eq("id", conversationId)
    .eq("tenant_id", auth.tenant_id)
    .eq("account_id", auth.account_id)
    .maybeSingle();
  const tConv = Date.now();
  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userLang: "en" | "zh" | "ar" =
    body.user_lang === "zh" ? "zh" :
    body.user_lang === "ar" ? "ar" :
    "en";

  /* ─── Fast-path: canned reply ────────────────────────────────
     Skips buildUserContext + history SELECT + orchestrate. Writes
     (user turn, assistant turn, conversation update) are independent
     once we know the conversation is ours, so run them in parallel. */
  const fast = tryFastReply(content);
  if (fast) {
    const finalTitle = computeTitle(conv, content);
    const [, assistantInsert] = await Promise.all([
      supabaseServer.from("ai_messages").insert({
        tenant_id: auth.tenant_id,
        conversation_id: conversationId,
        role: "user",
        content,
      }),
      supabaseServer
        .from("ai_messages")
        .insert({
          tenant_id: auth.tenant_id,
          conversation_id: conversationId,
          role: "assistant",
          content: fast,
          provider: "fast-path",
        })
        .select("*")
        .single(),
      supabaseServer
        .from("ai_conversations")
        .update({
          title: finalTitle,
          last_preview: fast.slice(0, 180),
          message_count: (conv.message_count ?? 0) + 2,
        })
        .eq("id", conversationId)
        .eq("tenant_id", auth.tenant_id)
        .eq("account_id", auth.account_id),
    ]);
    const tEnd = Date.now();
    console.log(
      `[ai.agent.timing] auth=${tAuth - t0}ms conv=${tConv - tAuth}ms` +
        ` writes=${tEnd - tConv}ms total=${tEnd - t0}ms canned=1`,
    );

    const agent: AgentResponse = {
      steps: [{ kind: "answer", text: fast, permissionStatus: "allowed" }],
      finalReply: fast,
      provider: "fast-path",
      conversationId,
    };
    return NextResponse.json({
      agent,
      message: assistantInsert.data,
      conversation: { id: conversationId, title: finalTitle },
    });
  }

  /* ─── Non-canned path ────────────────────────────────────────
     History load, permission context build, and the user-turn insert
     are independent of each other — Promise.all them. Orchestrate only
     needs history + ctx; the user insert is fire-and-wait purely so we
     don't lose the turn on a provider blip. */
  const [historyRes, ctx] = await Promise.all([
    supabaseServer
      .from("ai_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    buildUserContext(auth),
    supabaseServer.from("ai_messages").insert({
      tenant_id: auth.tenant_id,
      conversation_id: conversationId,
      role: "user",
      content,
    }),
  ]);
  const tDeps = Date.now();

  /* Query pulled newest-first with a limit, then flipped back to
     chronological order for the orchestrator. Behaviour (tool routing,
     multi-turn context) is unchanged — only the window size is bounded. */
  const history = (historyRes.data ?? [])
    .slice()
    .reverse()
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as string,
    }));

  const agent = await orchestrate({
    ctx,
    history,
    userMessage: content,
    userLang,
    conversationId,
  });
  const tOrch = Date.now();

  /* Final writes — assistant insert + conversation meta update are
     independent, so run them in parallel. */
  const finalTitle = computeTitle(conv, content);
  const [assistantInsert] = await Promise.all([
    supabaseServer
      .from("ai_messages")
      .insert({
        tenant_id: auth.tenant_id,
        conversation_id: conversationId,
        role: "assistant",
        content: agent.finalReply,
        provider: agent.provider,
      })
      .select("*")
      .single(),
    supabaseServer
      .from("ai_conversations")
      .update({
        title: finalTitle,
        last_preview: agent.finalReply.slice(0, 180),
        message_count: (conv.message_count ?? 0) + 2,
      })
      .eq("id", conversationId)
      .eq("tenant_id", auth.tenant_id)
      .eq("account_id", auth.account_id),
  ]);
  const tEnd = Date.now();
  console.log(
    `[ai.agent.timing] auth=${tAuth - t0}ms conv=${tConv - tAuth}ms` +
      ` deps=${tDeps - tConv}ms orch=${tOrch - tDeps}ms writes=${tEnd - tOrch}ms` +
      ` total=${tEnd - t0}ms canned=0`,
  );

  return NextResponse.json({
    agent,
    message: assistantInsert.data,
    conversation: { id: conversationId, title: finalTitle },
  });
}
