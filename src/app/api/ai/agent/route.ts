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
const FAST_REPLIES: Array<[RegExp, string]> = [
  // Greetings
  [/^(hi|hello|hey|yo|hola)[\s,!.?]*$/i,                      "Hi! How can I help?"],
  [/^(good\s+(morning|afternoon|evening|night))[\s,!.?]*$/i,  "Hello! How can I help?"],
  [/^(salam|salaam|مرحبا|اهلا|أهلا|السلام)[\s,!.?]*$/i,        "مرحبا! كيف أقدر أساعدك؟"],
  [/^(你好|您好|嗨)[\s,!.?]*$/,                                "你好!有什么可以帮您的吗?"],
  // Identity — English
  [/^who\s+(are|r)\s+you\s*\??$/i,                            "I'm Koleex AI, your assistant inside Koleex Hub."],
  [/^what\s+(are|r)\s+you\s*\??$/i,                           "I'm Koleex AI, your in-app assistant."],
  [/^what\s+can\s+you\s+do\s*\??$/i,                          "I help with quick answers, drafting, and navigating the hub. What do you need?"],
  // Identity — Arabic
  [/^(من\s+(أنت|انت)|مين\s+(أنت|انت))\s*[?؟]?$/,              "أنا Koleex AI، مساعدك داخل Koleex Hub."],
  [/^(ماذا\s+(تستطيع|يمكنك)|ما\s+الذي\s+(تستطيع|يمكنك)|شو\s+(تقدر|بتقدر)|ايش\s+تقدر).*[?؟]?$/, "أساعدك في إجابات سريعة والصياغة والتنقل داخل Koleex Hub. ما الذي تحتاجه؟"],
  // Identity — Chinese
  [/^你是谁\s*[?？]?$/,                                        "我是 Koleex AI,您在 Koleex Hub 的助手。"],
  [/^你(能|可以)(做|干)什么\s*[?？]?$/,                         "我可以帮您快速回答、起草内容和在 Koleex Hub 中导航。需要什么?"],
  // Acks
  [/^(thanks|thank\s+you|thx|ty)[\s!.?]*$/i,                  "You're welcome."],
  [/^(ok|okay|cool|got\s+it|understood)[\s!.?]*$/i,           "Okay."],
  [/^(bye|goodbye|see\s+you)[\s!.?]*$/i,                      "See you!"],
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
