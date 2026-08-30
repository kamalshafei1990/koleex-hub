import "server-only";

/* ---------------------------------------------------------------------------
   ai/core/types — the turn contract.

   Phase 2E. TurnInput described one function's arguments while it lived in
   orchestrator.ts; now that the loop and the recovery paths both take it, it
   belongs to neither of them. Putting it here also removes the only import
   cycle the extraction would otherwise have created (recovery needs the type,
   the loop needs recovery).
   --------------------------------------------------------------------------- */

import type { UserContext } from "@/lib/server/ai-agent/types";

export interface TurnInput {
  ctx: UserContext;
  /** Conversation history — role/content pairs, oldest first. */
  history: Array<{ role: "user" | "assistant"; content: string }>;
  /** Latest user message (already persisted by the caller). */
  userMessage: string;
  userLang: "en" | "zh" | "ar";
  /** Set when the language detector flags Egyptian dialect / Franco —
   *  the model then generates natural Egyptian Arabic natively. */
  dialect?: "egyptian" | null;
  conversationId: string;
  /** The composer's globe control was on for this turn. A nudge toward
   *  search_web, never a command — the model still decides. */
  webSearchRequested?: boolean;
  /** Appended to whichever system prompt this turn builds when the user has
   *  a stored "always answer me in X" preference. Built by the route, which
   *  owns the preference, so every lane applies the identical text. */
  languageLock?: string;
  /** Owner-taught Q&A block (approved canonical replies) — appended to
   *  every lane's system prompt; the model does the meaning-matching. */
  taughtAnswers?: string;
  /** Streaming hook: when set, the ANSWER-phase model call streams and
   *  each content token is forwarded here in real time. */
  onDelta?: (text: string) => void;
}


