import "server-only";

/* ---------------------------------------------------------------------------
   ai/core/wire — what the MODEL sees of a tool result, and what the USER sees
   of a tool call.

   Phase 2E, moved verbatim. Two small translators that sit either side of the
   tool layer. They are separated from the loop because they answer a question
   the loop should not have to re-decide at each call site: exactly which
   fields of a ToolResult are safe to hand back to a model.
   --------------------------------------------------------------------------- */

import type { ToolResult } from "@/lib/server/ai-agent/types";

export function toLlmSafe(result: ToolResult): Record<string, unknown> {
  return {
    ok: result.ok,
    permissionStatus: result.permissionStatus,
    message: result.message,
    data: result.data,
    filteredFields: result.filteredFields,
    sources: result.sources,
  };
}

export function humaniseCall(toolName: string, args: Record<string, unknown>): string {
  const q = (args.query as string | undefined) ?? (args.code as string | undefined);
  if (q) return `Running ${toolName}("${q}")…`;
  return `Running ${toolName}…`;
}


