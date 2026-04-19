import "server-only";

/* ---------------------------------------------------------------------------
   ai-agent/orchestrator — the tool-calling loop.

   Pipeline per user turn:

     1. Build the message list for Groq (system prompt + history + user msg).
     2. Call Groq with `tools = openAiToolSchemas()` and `tool_choice = auto`.
     3. If the model replies with tool_calls, dispatch them all in parallel
        through dispatchTool() (permission guards + audit log apply),
        attach results, loop.
     4. If the model replies with content, that's the final answer; stop.
     5. Hard-cap at MAX_ITERATIONS so a misbehaving model can't spin.

   The model NEVER sees raw DB rows it isn't allowed to see — tools
   strip sensitive fields before returning, and denied calls come back
   with permissionStatus so the model can explain honestly.
   --------------------------------------------------------------------------- */

import type {
  AgentStep,
  AgentResponse,
  UserContext,
  ToolResult,
} from "./types";
import { openAiToolSchemas, dispatchTool } from "./tool-registry";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
/* Default to Llama 3.1 8B Instant for the agent path — 30k tokens /
   minute on Groq's free tier (vs 6k for 3.3 70B) and roughly 3× faster
   inference. Tool-calling quality is still strong for ERP-style
   orchestration; we're not asking the model to reason deeply, just to
   pick the right tool and summarise results. `GROQ_AGENT_MODEL` env
   overrides, so we can A/B swap to 70B later without a deploy. */
const GROQ_MODEL =
  process.env.GROQ_AGENT_MODEL ||
  process.env.GROQ_MODEL ||
  "llama-3.1-8b-instant";
const MAX_ITERATIONS = 6;

/* OpenAI-compatible message shapes — kept loose because the Groq API
   accepts the whole family (system/user/assistant/tool). */
interface WireMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

export interface OrchestrateInput {
  ctx: UserContext;
  /** Conversation history — role/content pairs, oldest first. */
  history: Array<{ role: "user" | "assistant"; content: string }>;
  /** Latest user message (already persisted by the caller). */
  userMessage: string;
  userLang: "en" | "zh" | "ar";
  conversationId: string;
}

export async function orchestrate(input: OrchestrateInput): Promise<AgentResponse> {
  const { ctx, history, userMessage, userLang, conversationId } = input;
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return fallback(
      "Koleex AI isn't configured. Ask an admin to add GROQ_API_KEY.",
      conversationId,
    );
  }

  const systemPrompt = buildSystemPrompt(ctx, userLang);

  const messages: WireMsg[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  const steps: AgentStep[] = [];
  let finalReply = "";

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const res = await callGroqWithRetry(key, messages);

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      console.error("[ai.agent.groq]", res.status, bodyText.slice(0, 500));
      /* Rate limits (429) and overloaded (503) deserve a friendly
         message — they're recoverable; a 5xx/400 family error is
         different and can surface the raw status. */
      const isRateLimited = res.status === 429 || res.status === 503;
      const msg = isRateLimited
        ? "Koleex AI is handling a lot of requests right now. Give it a moment and try again."
        : `Koleex AI couldn't reach the language model (provider error ${res.status}).`;
      steps.push({ kind: "answer", text: msg, permissionStatus: "denied" });
      return {
        steps,
        finalReply: msg,
        provider: `groq:${GROQ_MODEL}`,
        conversationId,
      };
    }

    const json = (await res.json()) as {
      choices?: Array<{
        message?: {
          role: string;
          content: string | null;
          tool_calls?: WireMsg["tool_calls"];
        };
        finish_reason?: string;
      }>;
    };

    const choice = json.choices?.[0]?.message;
    if (!choice) {
      return fallback("Empty model response.", conversationId);
    }

    const toolCalls = choice.tool_calls ?? [];
    const content = choice.content ?? "";

    // If the model asked for tool calls we execute them all, otherwise
    // this is the final assistant turn.
    if (toolCalls.length === 0) {
      finalReply = content.trim();
      if (finalReply) {
        steps.push({
          kind: "answer",
          text: finalReply,
          permissionStatus: "allowed",
        });
      }
      break;
    }

    // Push the assistant turn (with the tool_calls array) so the tool
    // results we append next reference the right call_ids.
    messages.push({
      role: "assistant",
      content: content || null,
      tool_calls: toolCalls,
    });

    // Execute tool calls in parallel. Each dispatched through the registry,
    // which runs permission + audit + error isolation.
    const toolRuns = await Promise.all(
      toolCalls.map(async (tc) => {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = tc.function.arguments
            ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
            : {};
        } catch {
          parsedArgs = {};
        }
        steps.push({
          kind: "tool-call",
          tool: tc.function.name,
          text: humaniseCall(tc.function.name, parsedArgs),
          payload: parsedArgs,
        });

        const result = await dispatchTool(ctx, tc.function.name, parsedArgs, {
          conversationId,
        });

        steps.push({
          kind: "tool-result",
          tool: tc.function.name,
          text: result.message,
          payload: result.data,
          permissionStatus: result.permissionStatus,
          sources: result.sources,
          filteredFields: result.filteredFields,
        });

        return { tc, result };
      }),
    );

    // Feed tool outputs back as tool-role messages. We only send a
    // minimal, LLM-safe projection — never the full raw object if it
    // could contain anything sensitive we haven't already filtered.
    for (const { tc, result } of toolRuns) {
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        name: tc.function.name,
        content: JSON.stringify(toLlmSafe(result)),
      });
    }

    // If every tool call was denied we can short-circuit to avoid
    // burning another round-trip — tell the user plainly.
    const allDenied = toolRuns.every((r) => r.result.permissionStatus === "denied");
    if (allDenied) {
      const lastMsg = toolRuns[toolRuns.length - 1]?.result.message
        ?? "Access denied.";
      steps.push({
        kind: "denied",
        text: lastMsg,
        permissionStatus: "denied",
      });
      finalReply = lastMsg;
      break;
    }
  }

  // Safety: if we hit max iterations without a clean answer, compose a
  // short message from the last tool result so the UI gets *something*.
  if (!finalReply) {
    const lastText = [...steps].reverse().find((s) => s.text)?.text ?? "";
    finalReply = lastText || "I couldn't complete that request.";
    steps.push({
      kind: "answer",
      text: finalReply,
      permissionStatus: "allowed",
    });
  }

  return {
    steps,
    finalReply,
    provider: `groq:${GROQ_MODEL}`,
    conversationId,
  };
}

/* ─── Helpers ─────────────────────────────────────────── */

function buildSystemPrompt(ctx: UserContext, userLang: "en" | "zh" | "ar"): string {
  const langName =
    userLang === "zh" ? "Chinese (Simplified)" :
    userLang === "ar" ? "Arabic" :
    "English";

  return `You are Koleex AI, the in-app business agent for Koleex Hub — a multilingual ERP used by Koleex International Group.

Your job is to:
1. Interpret the user's intent.
2. Call the available tools to look up real Koleex data.
3. Summarize tool results in natural language.

General rules:
- Reply in ${langName}.
- Never invent business data. If a tool returns nothing, say so plainly.
- Never reveal values that were filtered out by the permission layer. A "limited" or "denied" result means the user isn't allowed to see those values — acknowledge honestly, don't hint at them, don't summarize around them.
- Prefer calling tools over guessing.
- Keep answers concise and business-focused. Bullet lists welcome.
- If you don't know, say so.

Quotation drafting workflow (Session 2):
- When the user asks to create / draft / prepare a quotation, FOLLOW THIS ORDER STRICTLY. Do not skip steps.
  1. Resolve the customer with getCustomerByName or getCustomerByCode (if they only gave a name). Use the returned customer.id.
  2. Resolve each product they named with searchProducts or getProductByCode. Use the returned product.id. If a product isn't in the catalog, tell the user and stop — do not invent SKUs.
  3. Call calculateQuotationPricing with { customerId, lines: [{ productId, qty }, ...] }. Never compute prices yourself. Do not multiply, do not sum — the pricing engine is the only source of numbers.
  4. Show the calculated totals to the user in natural language and ASK THEM TO CONFIRM before creating the draft.
  5. Only after confirmation, call createQuotationDraft with the same inputs. It creates a row with status='draft' — NOT sent, NOT final — and returns a review_url the user can open.
- If calculateQuotationPricing returns permissionStatus="approval_required" or any line has status "no_price" or "out_of_policy", say so clearly in your reply. Do not hide it. The user must know the draft needs a human approval before it can go out.
- Never set a quotation to anything other than draft. Never send, never finalise, never email. If the user asks for that, tell them to open the draft in the Quotations app to review and send it there.

Current user: ${ctx.auth.username} (${ctx.auth.user_type}${ctx.isSuperAdmin ? ", super admin" : ""}).`;
}

function toLlmSafe(result: ToolResult): Record<string, unknown> {
  return {
    ok: result.ok,
    permissionStatus: result.permissionStatus,
    message: result.message,
    data: result.data,
    filteredFields: result.filteredFields,
    sources: result.sources,
  };
}

function humaniseCall(toolName: string, args: Record<string, unknown>): string {
  const q = (args.query as string | undefined) ?? (args.code as string | undefined);
  if (q) return `Running ${toolName}("${q}")…`;
  return `Running ${toolName}…`;
}

function fallback(msg: string, conversationId: string): AgentResponse {
  return {
    steps: [{ kind: "answer", text: msg, permissionStatus: "denied" }],
    finalReply: msg,
    provider: `groq:${GROQ_MODEL}`,
    conversationId,
  };
}

/* ─── Groq call with retry-after aware backoff ────────────────────────
   Groq's free tier is ~6k tokens / minute on Llama 3.3 70B. With the
   agent loop invoking the model several times per user turn (tool
   schemas alone cost 2-3k tokens each call), bursts can hit 429 even
   on normal use. When that happens Groq returns a `retry-after`
   header (seconds). We honour it up to 3 times before giving up so a
   brief rate-limit doesn't surface as a scary error. */
async function callGroqWithRetry(
  key: string,
  messages: WireMsg[],
  attempt = 0,
): Promise<Response> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      tools: openAiToolSchemas(),
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });
  /* Tight retry budget: 1 extra attempt, waiting at most 2 s. If we
     still can't serve we surface the friendly message. Large retry
     windows just make the UI feel frozen — Llama 3.1 8B + higher free-
     tier throughput should prevent most 429s from reaching here. */
  if ((res.status === 429 || res.status === 503) && attempt < 1) {
    const ra = Number(res.headers.get("retry-after"));
    const waitMs = Math.min((Number.isFinite(ra) && ra > 0 ? ra : 1) * 1000, 2000);
    await new Promise((r) => setTimeout(r, waitMs));
    return callGroqWithRetry(key, messages, attempt + 1);
  }
  return res;
}
