import "server-only";

/* ---------------------------------------------------------------------------
   ai/core/general-search — the ONE lookup the general fast lane may make.

   Dependability plan A4, second slice. The general lane is where most
   ordinary questions are answered, tool-less, at streaming speed. The first
   slice (isWorldFactQuery) sends a question that LOOKS like a world fact to
   the tool loop; this slice covers the questions the detector misses, by
   letting the general lane itself call search_web — once — and answer from
   the result. One hop, one tool, and the second call carries no tools at
   all, so the lane can never become a loop (owner: "do not create
   uncontrolled agent loops").

   Why only search_web. The general lane runs for callers on every fast
   path; Hub data tools belong to the orchestrator, whose loop has the
   permission guard, the confirmation ledger and the pricing evidence rules
   around them. A public-web lookup reads nothing from the tenant, so it is
   the one tool that fits a lane with none of that machinery. The list is
   still taken from the connector — koleexHub.availableTools(ctx) — so the
   tool is OFFERED only to a caller who may run it, and invoke() re-checks
   every call regardless.
   --------------------------------------------------------------------------- */

import type { UserContext, ToolResult, AgentStep } from "@/lib/server/ai-agent/types";
import type { IrMessage, IrTool, IrToolCall } from "@/lib/server/ai/provider/turn-ir";
import { koleexHub } from "@/lib/server/ai/connectors/koleex-hub";
import { toLlmSafe, humaniseCall } from "@/lib/server/ai/core/wire";
import { logToolRun } from "@/lib/server/ai/observability/turn-trace";
import { READ_PAGE_TOOL, READ_PAGE_MAX_PER_ANSWER, linksFromSearchResult } from "@/lib/server/ai/core/read-page";

/** The only tool the general lane may see. */
export const GENERAL_LANE_TOOL = "search_web";

/** How many search calls one hop will run. A model that asks for more gets
 *  a refusal for the rest — providers require a reply to every call, and a
 *  silent drop would 400 the second request. */
export const GENERAL_SEARCH_MAX_CALLS = 2;

/** Appended to the general system prompt when the tool is offered. Short,
 *  because the tool's own description already says WHEN to look something
 *  up; this line says only what the lane needs the model to know: it has
 *  the tool, it gets one chance to use it, and explanations do not need
 *  it. */
export const GENERAL_SEARCH_NOTE =
  "You have ONE tool on this turn: search_web. Use it for a fact about the world you would otherwise recall from training " +
  "(a person, a company, a place, a figure, a ranking, anything recent) — look it up, then answer from the result. " +
  "Do not use it for an explanation, a definition, a translation, a draft, or small talk: answer those directly. " +
  "You get at most one lookup per answer, so make the query count. " +
  "If the result covers only part of what was asked (a list, a table, a ranking), still give the whole answer: " +
  "use the result for what it covers and complete the rest from what you know, saying in one line which part comes from general knowledge. " +
  "When the user asked for a number of items (top 100, 20 companies), give that many: in a table, add a Source column that says \"search\" " +
  "for rows from the result and \"general knowledge — may be out of date\" for the rest. A ranking that changes over time is a reason to say " +
  "it may be dated, never a reason to stop short. Never answer with only a link. " +
  "Cite a source as a short markdown link named by its site — [Forbes](https://…) — at the end of the sentence it supports, never a bare web address.";

export type GeneralInvoke = (
  ctx: UserContext,
  toolName: string,
  args: Record<string, unknown>,
  opts: { conversationId: string },
) => Promise<ToolResult>;

/** The tools the general lane may offer this caller: search_web if the
 *  connector lists it for them, otherwise nothing (null → the request is
 *  the tool-less one it always was). */
export function generalLaneTools(ctx: UserContext): IrTool[] | null {
  const tools = koleexHub
    .availableTools(ctx)
    .filter((t) => t.name === GENERAL_LANE_TOOL)
    .map((t) => ({ name: t.name, description: t.description, parameters: t.parameters }));
  return tools.length > 0 ? tools : null;
}

/** Appended beside GENERAL_SEARCH_NOTE when the page reader is on
 *  (core/read-page.ts). */
export const READ_PAGE_NOTE =
  "After a lookup you may open up to two of its result pages with read_page — or a link the user wrote — when the snippets are not enough " +
  "(a full list, a table, a ranking, an article's details), and answer from the page. Only those links can be opened.";

export interface GeneralSearchHop {
  /** Steps for the screen: a tool-call and a tool-result per call run. */
  steps: AgentStep[];
  /** The conversation to send on the next call. */
  messages: IrMessage[];
  /** How many calls were actually run (the rest were refused). */
  ran: number;
  /** How many of those were page reads. */
  reads: number;
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const NOT_RUN: ToolResult = {
  ok: false,
  permissionStatus: "denied",
  data: null,
  message: `Not run: at most ${GENERAL_SEARCH_MAX_CALLS} lookups and ${READ_PAGE_MAX_PER_ANSWER} page reads per answer on this lane. Answer from what already ran.`,
};

/** Run the model's search calls and build the messages for the answer call.
 *
 *  `priorContent` is whatever the model streamed before it decided to look
 *  something up; it goes on the assistant turn beside the calls so the
 *  transcript the model sees is the one it produced. The route retracts it
 *  from the screen — the answer that follows replaces it. */
export async function runGeneralSearchHop(input: {
  ctx: UserContext;
  conversationId: string;
  calls: IrToolCall[];
  priorContent: string;
  messages: IrMessage[];
  invoke?: GeneralInvoke;
  onStep?: (steps: AgentStep[]) => void;
  /** The turn's trace id for the [ai.tool] line; the conversation id stands in. */
  traceId?: string | null;
  /** THE PAGE READER, when it is on for this turn (core/read-page.ts): the
   *  reader itself, the reads this answer has already made, and the turn's
   *  provenance set — every search result run here adds its links to it. */
  readPage?: (url: unknown) => Promise<ToolResult>;
  readsBefore?: number;
  allowedLinks?: Set<string>;
  /** False on the reading hop: a second round of searching is not offered. */
  allowSearch?: boolean;
}): Promise<GeneralSearchHop> {
  const invoke = input.invoke ?? ((ctx, name, args, opts) => koleexHub.invoke(ctx, name, args, opts));
  const steps: AgentStep[] = [];
  const replies: IrMessage[] = [];
  let ran = 0;
  let searches = 0;
  let reads = 0;
  for (const call of input.calls) {
    const args = parseArgs(call.argumentsJson);
    /* Only the lane's tools, only so many times. Anything else the model asks
       for is answered with a refusal the model can read — never run. */
    const isSearch = call.name === GENERAL_LANE_TOOL && input.allowSearch !== false && searches < GENERAL_SEARCH_MAX_CALLS;
    const isRead = call.name === READ_PAGE_TOOL && !!input.readPage && (input.readsBefore ?? 0) + reads < READ_PAGE_MAX_PER_ANSWER;
    const allowed = isSearch || isRead;
    let result: ToolResult = NOT_RUN;
    if (allowed) {
      steps.push({ kind: "tool-call", tool: call.name, text: humaniseCall(call.name, args), payload: args });
      /* Announced before the lookup runs, so the screen shows what is being
         looked up during the seconds it takes — the orchestrator's rule. */
      try {
        input.onStep?.(steps.slice());
      } catch {
        /* A listener must not take the turn down. */
      }
      ran++;
      if (isSearch) searches++;
      else reads++;
      const tTool = Date.now();
      result = isRead
        ? await input.readPage!(args.url)
        : await invoke(input.ctx, call.name, args, { conversationId: input.conversationId });
      /* A search's result pages join the links this turn may open. */
      if (isSearch && input.allowedLinks) for (const u of linksFromSearchResult(result)) input.allowedLinks.add(u);
      /* Plan G1: the same [ai.tool] line the orchestrator writes. */
      logToolRun({ tool: call.name, ms: Date.now() - tTool, ok: result.ok, status: result.permissionStatus, trace: input.traceId ?? input.conversationId });
      steps.push({
        kind: "tool-result",
        tool: call.name,
        text: result.message,
        payload: result.data,
        permissionStatus: result.permissionStatus,
        sources: result.sources,
        filteredFields: result.filteredFields,
      });
    }
    replies.push({ role: "tool", content: JSON.stringify(toLlmSafe(result)), toolCallId: call.id, name: call.name });
  }
  return {
    steps,
    messages: [
      ...input.messages,
      { role: "assistant", content: input.priorContent || null, toolCalls: input.calls },
      ...replies,
    ],
    ran,
    reads,
  };
}
