import "server-only";

/* ---------------------------------------------------------------------------
   ai-agent/audit — central audit logger for every tool invocation.

   A row is written to `public.ai_tool_calls` for every call, regardless
   of outcome. Never blocks the tool result — any logging failure is
   swallowed with a console.error so a degraded audit path never breaks
   the user's request.

   Design rules:
   - Don't log restricted values. Tools strip sensitive fields BEFORE
     handing args to logToolCall() (see scrubArgs() below).
   - `result_summary` is a short human-readable line, not the full
     payload. The payload might contain things we shouldn't persist
     (e.g. a customer's internal note). One sentence about what the
     tool did is enough for forensics.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../supabase-server";
import type { UserContext, ToolResult, PermissionStatus } from "./types";

/* Explicit allowlist of argument keys that are safe to log in clear.
   Anything not on this list is hashed before it hits the DB so we
   avoid accidentally recording a customer's credit card etc. */
const SAFE_LOG_KEYS = new Set([
  "id", "productId", "customerId", "supplierId", "quotationId",
  "invoiceId", "employeeId", "query", "limit", "code", "status",
  "name", "taskId", "conversationId", "module", "action",
]);

function scrubArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (SAFE_LOG_KEYS.has(k)) {
      out[k] = v;
    } else {
      out[k] = typeof v === "string"
        ? `<redacted:${v.length}ch>`
        : `<redacted:${typeof v}>`;
    }
  }
  return out;
}

export interface AuditEntry {
  ctx: UserContext;
  conversationId?: string | null;
  toolName: string;
  args: Record<string, unknown>;
  result: ToolResult;
  latencyMs: number;
  /** Override status if the tool errored before it could set one. */
  statusOverride?: PermissionStatus | "error";
}

export async function logToolCall(entry: AuditEntry): Promise<void> {
  const status = entry.statusOverride ?? entry.result.permissionStatus;
  try {
    await supabaseServer.from("ai_tool_calls").insert({
      tenant_id: entry.ctx.auth.tenant_id,
      account_id: entry.ctx.auth.account_id,
      conversation_id: entry.conversationId ?? null,
      tool_name: entry.toolName,
      args: scrubArgs(entry.args),
      permission_status: status,
      ok: entry.result.ok,
      filtered_fields: entry.result.filteredFields ?? [],
      sources: entry.result.sources ?? [],
      message: entry.result.message ?? null,
      result_summary: summariseResult(entry.result),
      latency_ms: entry.latencyMs,
    });
  } catch (e) {
    // Never break the user's request on a logging failure — just record
    // it in the server logs for later forensics.
    console.error("[ai.audit.logToolCall]", e);
  }
}

function summariseResult(result: ToolResult): string {
  if (!result.ok) return `not_ok: ${result.message ?? "unknown"}`;
  if (result.data === null) return "ok: no data";
  if (Array.isArray(result.data)) return `ok: ${result.data.length} rows`;
  if (typeof result.data === "object") {
    const keys = Object.keys(result.data as Record<string, unknown>);
    return `ok: object with ${keys.length} fields`;
  }
  return "ok";
}
