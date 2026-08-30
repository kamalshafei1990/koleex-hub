import "server-only";

/* ---------------------------------------------------------------------------
   ai/core/recovery — the paths taken when the tool loop cannot run.

   Phase 2E, moved from orchestrator.ts. Two of them:

     runDegradedTurn()  no provider key for the agent loop, but ANOTHER
                        provider is configured — answer conversationally
                        through aiChat(), with no tools and no live data.
     fallback()         build an AgentResponse for an error the user should
                        see as a sentence, not a stack trace.

   Both return the same AgentResponse shape as the full loop, so no caller
   has to know which path ran. Both still pass through sealFinalReply — a
   degraded answer is not an unguarded one.
   --------------------------------------------------------------------------- */

import type { AgentResponse, AgentStep } from "@/lib/server/ai-agent/types";
import { aiChat } from "@/lib/server/ai-provider";
import { sealFinalReply } from "@/lib/server/ai/seals";
import { buildDegradedSystemPrompt } from "@/lib/server/ai/prompts";
import { hasUntrustedContent } from "@/lib/server/ai/security/untrusted";
import { logSealTransform } from "@/lib/server/ai/observability/reply-log";
import { providerLabel } from "./transport";
import type { TurnInput } from "./types";

/* ── Provider-agnostic fallback ──
   Runs when GROQ_API_KEY is missing but another provider IS configured.
   We skip the tool-calling loop entirely and just produce a chat reply
   via the shared aiChat() abstraction (which already supports Gemini /
   Anthropic / OpenAI). The reply gets a one-line "Tools are off" tail
   so operators know live-data answers aren't available until Groq is
   wired. Same AgentResponse shape so the caller doesn't care which
   path was taken. */
export async function runDegradedTurn(
  input: TurnInput,
  tStart: number,
): Promise<AgentResponse> {
  const { ctx, history, userMessage, userLang, conversationId } = input;
  /* Same current-turn-only scope as orchestrate() — see AUDIT ISSUE 5 note
     there. This second copy still scanned retained history and would have
     kept the old, wider exemption alive on the no-key fallback path. */
  const attachedDocCtx = hasUntrustedContent(userMessage);
  /* Phase 2C — this fourth prompt used to be assembled inline here, which is
     precisely how a lane ends up with a different set of rules from the other
     three. It now lives in the prompt layer with them. */
  const systemPrompt = buildDegradedSystemPrompt(ctx, userLang);

  /* The route already applies the 60-message / char-budget window;
     mirror it here rather than silently narrowing memory on this path. */
  const trimmed = history.slice(-60).map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));
  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...trimmed,
    { role: "user" as const, content: userMessage },
  ];

  try {
    const result = await aiChat(messages);
    const reply =
      result?.reply?.trim() ||
      "I couldn't reach the AI provider just now. Try again in a moment.";
    const steps: AgentStep[] = [{ kind: "answer", text: reply }];
    const safeReply = sealFinalReply(reply, steps, userMessage, attachedDocCtx);
    console.log(
      `[ai.agent.timing] fast=no-groq provider=${result?.provider ?? "none"} total=${Date.now() - tStart}ms`,
    );
    return {
      steps,
      finalReply: safeReply,
      provider: result?.provider ?? "fallback",
      conversationId,
    };
  } catch (e) {
    console.error("[ai.agent.no-groq]", e);
    return fallback(
      "Something went wrong reaching the AI provider. Please try again.",
      conversationId,
      userMessage,
    );
  }
}

export function fallback(
  msg: string,
  conversationId: string,
  userMessage?: string,
): AgentResponse {
  /* Defense-in-depth: even this helper — which today is only called
     with fixed server-controlled strings — passes through the
     pricing-safety gate. Keeps every AgentResponse exit consistent. */
  const steps: AgentStep[] = [
    { kind: "answer", text: msg, permissionStatus: "denied" },
  ];
  const safeReply = sealFinalReply(msg, steps, userMessage);
  logSealTransform(msg, safeReply, "fallback");
  return {
    steps,
    finalReply: safeReply,
    provider: providerLabel(),
    conversationId,
  };
}
