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
  /* Identifiers — never secret, and the whole point of an audit row.
     camelCase set (quotation/product tools). */
  "id", "productId", "customerId", "supplierId", "quotationId",
  "invoiceId", "employeeId", "taskId", "conversationId",

  /* snake_case set — AUDIT ISSUE 6 (P0). These are the parameter names the
     work-management tools ACTUALLY take (`task_id`, `event_id`, `item_id`,
     `project_id`); only the camelCase `taskId` was listed, so every todo,
     calendar and planning write was recorded as `<redacted:36ch>`. The
     consequence: "who asked Koleex AI to delete this task?" could not be
     answered from the audit table at all — the row that changed was not
     identified. An id is not sensitive; omitting it only blinded forensics. */
  "task_id", "event_id", "item_id", "project_id",
  /* Who a task was assigned to IS the forensic content of a reassignment,
     and account ids already appear in every audit row's own account_id. */
  "assign_to_account_ids", "add_account_ids", "remove_account_ids",
  "replace_with_account_ids",

  /* Control flags — these separate a PREVIEW from an EXECUTION in the log.
     Without `confirm` the two are nearly indistinguishable after the fact. */
  "confirm", "done",

  /* Non-sensitive filters and enums. `q` is the same class as `query`,
     which was already allowed. */
  "query", "q", "limit", "code", "status", "name", "module", "action",
  "priority", "type", "days", "mine", "market", "brand", "filter", "due",
]);

/* Deliberately NOT allowlisted — free text and personal content stay
   redacted: title, description, notes, fact, value, key, label, tags, and
   all date/time arguments. Forensics gets the identifier and the outcome;
   it does not need the prose. */

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
