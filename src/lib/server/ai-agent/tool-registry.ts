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

/* ─────────────────────────────────────────────────────────────────────
   Import individual tool modules. Each file exports its own tool(s)
   and this registry aggregates them. Adding a new tool = (1) write the
   handler, (2) register it here.
   ───────────────────────────────────────────────────────────────────── */

import { customerTools } from "./tools/customers";
import { productTools } from "./tools/products";
import { inventoryTools } from "./tools/inventory";
import { permissionTools } from "./tools/permissions-tool";

/** Flat registry: name → definition. Frozen so handlers can't be swapped at runtime. */
const REGISTRY: Readonly<Record<string, ToolDef>> = Object.freeze(
  Object.fromEntries(
    [
      ...customerTools,
      ...productTools,
      ...inventoryTools,
      ...permissionTools,
    ].map((t) => [t.name, t]),
  ),
);

export function listTools(): ReadonlyArray<ToolDef> {
  return Object.values(REGISTRY);
}

export function getTool(name: string): ToolDef | undefined {
  return REGISTRY[name];
}

/* OpenAI-compatible schema — Groq accepts this shape on its
   /openai/v1/chat/completions endpoint when tool-calling is enabled. */
export function openAiToolSchemas(): Array<{
  type: "function";
  function: { name: string; description: string; parameters: unknown };
}> {
  return listTools().map((t) => ({
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
      message: `Unknown tool "${name}".`,
    };
    return result;
  }

  // Module / action guard first — cheapest rejection path.
  if (tool.requiredModule) {
    const decision = checkModule(
      ctx,
      tool.requiredModule,
      tool.requiredAction ?? "view",
    );
    if (!decision.allowed) {
      const result: ToolResult = {
        ok: false,
        permissionStatus: decision.status,
        data: null,
        message: decision.reason ?? "Permission denied.",
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

  // Min-role guard — super_admin, admin, internal, any.
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
      const result: ToolResult = {
        ok: false,
        permissionStatus: "denied",
        data: null,
        message: `This action requires a higher role (${tool.minRole}).`,
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

  // Execute the tool. Any thrown error becomes a typed denial so the
  // LLM never sees a stack trace and nothing leaks via error messages.
  let result: ToolResult;
  let statusOverride: PermissionStatus | "error" | undefined;
  try {
    result = await tool.handler(ctx, args);
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
