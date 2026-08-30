import "server-only";

/* ---------------------------------------------------------------------------
   ai-agent/tool-registry — central registry of all tools available to
   the Koleex AI agent, plus the dispatcher that runs them safely.

   Why a dispatcher (not tools calling each other freely):
   - Every invocation runs through `dispatchTool()` which does the
     permission guard, wraps the handler in a timer, logs to the audit
     trail, and returns a typed ToolResult. Tools themselves only
     express business intent — they never touch auth cookies, never
     write to ai_tool_calls, never care about the LLM.
   - The LLM sees only `openAiToolSchemas()` — an OpenAI-compatible
     tools array that Groq's tool-calling endpoint accepts. That schema
     is derived from the ToolDef entries, so you can't accidentally
     expose a tool without registering it.
   --------------------------------------------------------------------------- */

import type { ToolDef, UserContext, ToolResult, PermissionStatus } from "./types";
import { checkModule } from "./permissions";
import { logToolCall } from "./audit";
import {
  ledgerMode,
  recordPendingAction,
  consumePendingAction,
  riskClassFor,
  UNCONFIRMED_MESSAGE,
} from "../ai/security/pending-actions";
import { raceTimeout, timeoutFor } from "../ai/skills/timeout";
import { validateArgs, validationMode, formatValidationLine } from "../ai/skills/validate";

/* ─────────────────────────────────────────────────────────────────────
   Import individual tool modules. Each file exports its own tool(s)
   and this registry aggregates them. Adding a new tool = (1) write the
   handler, (2) register it here.
   ───────────────────────────────────────────────────────────────────── */

import { customerTools } from "./tools/customers";
import { productTools } from "./tools/products";
import { catalogTools } from "./tools/catalog";
import { machineKnowledgeTools } from "./tools/machine-knowledge-tool";
/* Published standards knowledge (ICC Incoterms 2020 / UCP 600 / URC 522) —
   ungated, holds no Koleex data. See tools/trade-terms-tool.ts. */
import { tradeTermsTools } from "./tools/trade-terms-tool";
import { inventoryTools } from "./tools/inventory";
import { permissionTools } from "./tools/permissions-tool";
import { askUserTools } from "./tools/ask-user";
import { quotationTools } from "./tools/quotations";
/* Work-management read tools (To-do / Projects / Planning / Calendar).
   Each ports the owning app's per-user visibility scope verbatim, so the
   agent can only surface rows the caller could see in the app itself. */
import { todoTools } from "./tools/todos";
import { projectTools } from "./tools/projects";
import { planningTools } from "./tools/planning";
import { calendarTools } from "./tools/calendar";
import { userMemoryTools } from "./tools/user-memory";
import { teamKnowledgeTools } from "./tools/team-knowledge";
import { knowledgeSearchTools } from "./tools/knowledge-search";
/* The agent's only route to the public internet — see tools/web-search.ts
   for the public-information-only and brand guards. */
import { webSearchTools } from "./tools/web-search";

/** Flat registry: name → definition. Frozen so handlers can't be swapped at runtime. */
const REGISTRY: Readonly<Record<string, ToolDef>> = Object.freeze(
  Object.fromEntries(
    [
      ...customerTools,
      ...productTools,
      ...catalogTools,
      ...machineKnowledgeTools,
      ...tradeTermsTools,
      ...inventoryTools,
      ...permissionTools,
      ...askUserTools,
      ...quotationTools,
      ...todoTools,
      ...projectTools,
      ...planningTools,
      ...calendarTools,
  ...userMemoryTools,
  ...teamKnowledgeTools,
  ...knowledgeSearchTools,
      ...webSearchTools,
    ].map((t) => [t.name, t]),
  ),
);

export function listTools(): ReadonlyArray<ToolDef> {
  return Object.values(REGISTRY);
}

export function getTool(name: string): ToolDef | undefined {
  return REGISTRY[name];
}

/* ─────────────────────────────────────────────────────────────────────
   The STATIC gates — the ones that depend only on (ctx, tool), never on
   arguments or conversation state.

   Phase 2F. These used to exist only inside dispatchTool(), which meant the
   model was offered all 45 tools regardless of who was asking: a Sales user
   saw every schema, tried the ones they could not use, and burned a turn
   being denied. Exposure is now derived from this same function, so the set
   the model can SEE and the set it can RUN cannot drift apart. That is the
   whole point of it being one function rather than two lists — a filter that
   reimplements the guard is a filter that will disagree with it eventually,
   and both directions of disagreement are bugs: hiding a permitted tool
   breaks a feature, offering a forbidden one wastes a turn.

   NOT included here, deliberately: the confirmation ledger. That gate depends
   on arguments and on conversation state, so it cannot be decided at exposure
   time — a write tool is still OFFERED to someone allowed to use it, and is
   still stopped at dispatch until a matching pending action exists.
   ───────────────────────────────────────────────────────────────────── */
export function staticToolDenial(
  ctx: UserContext,
  tool: ToolDef,
): { status: PermissionStatus; message: string } | null {
  if (tool.requiredModule) {
    const decision = checkModule(ctx, tool.requiredModule, tool.requiredAction ?? "view");
    if (!decision.allowed) {
      return { status: decision.status, message: decision.reason ?? "Permission denied." };
    }
  }

  if (tool.minRole && tool.minRole !== "any") {
    const ut = (ctx.auth.user_type ?? "").toLowerCase();
    const tier =
      ctx.isSuperAdmin ? 3 :
      ut === "admin" ? 2 :
      ut === "internal" ? 1 :
      0;
    const needed =
      tool.minRole === "super_admin" ? 3 :
      tool.minRole === "admin" ? 2 :
      tool.minRole === "internal" ? 1 :
      0;
    if (tier < needed) {
      /* Don't leak role-tier naming (super_admin, admin, internal)
         to end users. The audit record still captures the real
         reason. */
      return { status: "denied", message: "You do not have access to that action." };
    }
  }

  return null;
}

/** The tools this particular user may actually run. */
export function toolsFor(ctx: UserContext): ReadonlyArray<ToolDef> {
  return listTools().filter((t) => staticToolDenial(ctx, t) === null);
}

/* OpenAI-compatible schema — Groq accepts this shape on its
   /openai/v1/chat/completions endpoint when tool-calling is enabled.
   Phase 2F: takes the caller's context and offers only what they may run. */
export function openAiToolSchemas(ctx: UserContext): Array<{
  type: "function";
  function: { name: string; description: string; parameters: unknown };
}> {
  return toolsFor(ctx).map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

/* ─────────────────────────────────────────────────────────────────────
   Dispatcher. The orchestrator calls this. Never skip it.
   ───────────────────────────────────────────────────────────────────── */

export interface DispatchOptions {
  conversationId?: string | null;
}

export async function dispatchTool(
  ctx: UserContext,
  name: string,
  args: Record<string, unknown>,
  opts: DispatchOptions = {},
): Promise<ToolResult> {
  const tool = REGISTRY[name];
  const startedAt = Date.now();

  if (!tool) {
    const result: ToolResult = {
      ok: false,
      permissionStatus: "denied",
      data: null,
      /* User-facing copy. The raw tool name is intentionally omitted
         so we don't expose internal identifiers if the model
         hallucinates one. The real name is still in the audit log. */
      message: "I can't do that action here.",
    };
    return result;
  }

  /* Phase 2F — the two static gates now come from staticToolDenial(), the
     same function openAiToolSchemas() filters with. Defence in depth is
     unchanged: a tool the model was never offered is still denied here if it
     asks for it anyway, because a model can name a tool it was not given. */
  {
    const denial = staticToolDenial(ctx, tool);
    if (denial) {
      const result: ToolResult = {
        ok: false,
        permissionStatus: denial.status,
        data: null,
        message: denial.message,
      };
      await logToolCall({
        ctx,
        conversationId: opts.conversationId ?? null,
        toolName: name,
        args,
        result,
        latencyMs: Date.now() - startedAt,
      });
      return result;
    }
  }

  /* ── PHASE 6C: argument validation against the tool's OWN schema ────────
     LOG-ONLY unless AI_TOOL_VALIDATION=enforce. These schemas have never been
     enforced, so the first enforcing release is also the first time anyone
     learns whether they describe the calls tools actually receive — enforcing
     on day one would turn every inaccuracy across 45 schemas into a
     user-visible failure. Until the flag is set this MEASURES; it does not
     protect, and it is not described as a guard.

     Unknown properties never block, in either mode: models add stray keys,
     and a handler that does not read a key is unaffected by it. */
  {
    const vMode = validationMode();
    if (vMode !== "off") {
      const v = validateArgs(tool.parameters, args);
      if (v.issues.length > 0) {
        console.warn(formatValidationLine(name, v, vMode));
      }
      if (vMode === "enforce" && !v.valid) {
        const result: ToolResult = {
          ok: false,
          permissionStatus: "denied",
          data: null,
          /* Names no field and no value — the model gets told to retry, the
             detail is in the log where it cannot reach a user. */
          message: "That request was missing something I need. Could you rephrase it?",
        };
        await logToolCall({
          ctx,
          conversationId: opts.conversationId ?? null,
          toolName: name,
          args,
          result,
          latencyMs: Date.now() - startedAt,
        });
        return result;
      }
    }
  }

  /* ── AUDIT ISSUE 1 (P0): server-enforced write confirmation ──────────────
     Until now the ONLY thing separating a preview from an execution was the
     model choosing to omit `confirm: true`. Nothing here inspected it, and
     `pendingAction` — returned by 15 tools — was read by nothing.

     A confirm must now match an unexpired pending row this same conversation
     caused to be written. The model cannot fabricate one. A confirm carrying
     DIFFERENT arguments hashes differently and is refused: a changed action
     needs a new preview, which is the correct answer, not a bug. */
  const mode = ledgerMode();
  if (mode !== "off" && args.confirm === true) {
    const consumed = await consumePendingAction({
      ctx,
      conversationId: opts.conversationId ?? null,
      toolName: name,
      args,
    });
    if (!consumed.matched) {
      console.warn(
        `[ai.ledger.unmatched] tool=${name} reason=${consumed.reason} mode=${mode}`,
      );
      if (mode === "enforce") {
        const result: ToolResult = {
          ok: false,
          /* NOT "denied": a denial short-circuits the orchestrator and prints
             `message` verbatim, which would show English to an Arabic speaker.
             As an ordinary unsuccessful result the model relays it in the
             user's language and re-asks — the contract search_web already uses. */
          permissionStatus: "allowed",
          data: null,
          message: UNCONFIRMED_MESSAGE,
        };
        await logToolCall({
          ctx,
          conversationId: opts.conversationId ?? null,
          toolName: name,
          args,
          result,
          latencyMs: Date.now() - startedAt,
        });
        return result;
      }
      /* observe: fall through and execute, having logged what enforce would
         have blocked. Mirrors this repo's AUTH_RATELIMIT staging pattern. */
    }
  }

  // Execute the tool. Any thrown error becomes a typed denial so the
  // LLM never sees a stack trace and nothing leaks via error messages.
  let result: ToolResult;
  let statusOverride: PermissionStatus | "error" | undefined;
  try {
    /* PHASE 6B — bounded wait. A handler that hangs used to hold the agent
       loop until the whole invocation was killed: the user saw nothing, then
       a failure with no explanation, and the audit row below was never
       written because it sits downstream of this await.

       This bounds how long the TURN waits, NOT how long the query runs —
       Promise.race frees the caller and cannot cancel the work. Real
       cancellation needs an AbortSignal through all 45 handlers, and Phase 6
       is metadata-only by design. See skills/timeout.ts, which says the same
       thing at greater length rather than implying more than it delivers. */
    const raced = await raceTimeout(tool.handler(ctx, args), timeoutFor(name));
    if (raced.timedOut) {
      console.error(`[ai.tool.${name}] timed out after ${timeoutFor(name)}ms`);
      result = {
        ok: false,
        permissionStatus: "denied",
        data: null,
        /* Same shape a thrown handler already produces, so the loop's existing
           error path handles it unchanged. The user-facing copy names no tool
           and no internal detail. */
        message: "That took too long to look up. Please try again.",
      };
      statusOverride = "error";
    } else {
      result = raced.value as ToolResult;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[ai.tool.${name}]`, msg);
    result = {
      ok: false,
      permissionStatus: "denied",
      data: null,
      message: "Something went wrong while running that tool.",
    };
    statusOverride = "error";
  }

  /* The tool returned a PREVIEW — record it so the follow-up confirm has
     something to match. No tool changed: `pendingAction` was already being
     returned by all 15 write tools and read by nothing. */
  const pending = (result as { pendingAction?: { tool: string; args: Record<string, unknown> } })
    .pendingAction;
  if (mode !== "off" && pending && result.ok) {
    await recordPendingAction({
      ctx,
      conversationId: opts.conversationId ?? null,
      toolName: pending.tool ?? name,
      args: pending.args ?? {},
      preview: result.data,
      riskClass: riskClassFor(name, tool.requiredAction),
    });
  }

  await logToolCall({
    ctx,
    conversationId: opts.conversationId ?? null,
    toolName: name,
    args,
    result,
    latencyMs: Date.now() - startedAt,
    statusOverride,
  });

  return result;
}
