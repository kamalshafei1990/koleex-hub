import "server-only";

/* ---------------------------------------------------------------------------
   logAudit — reusable, masked, append-only business-action audit logger.

   Call from any server route after a sensitive mutation succeeds. Best-effort:
   never throws, never blocks the operation. Writes to the service-role-only
   `audit_logs` table.

   SECURITY — masking is mandatory:
     · Never persist passwords, tokens, secrets, api keys, hashes, or auth
       material. maskValues() recursively redacts any key whose name matches
       SENSITIVE_KEY_RE before old/new values are stored.
     · Financial/cost values ARE stored (Super Admin needs visibility) but the
       column-level mask list is centralised here so future role-based
       restrictions can extend it without touching call sites.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { ServerAuthContext } from "@/lib/server/auth";
import { requestMeta, locationLabel } from "@/lib/server/activity";
import { notifySuperAdmins, type AlertKind } from "@/lib/server/sa-notify";

export type AuditSeverity = "info" | "warning" | "critical";

/** Keys that must never be stored in old/new values, anywhere in the object. */
const SENSITIVE_KEY_RE =
  /(password|passwd|pwd|secret|token|api[_-]?key|apikey|auth|authorization|cookie|session|credential|private[_-]?key|client[_-]?secret|refresh|access[_-]?token|otp|mfa|2fa|salt|hash|signature|bearer)/i;

const REDACTED = "‹redacted›";

/** Recursively redact sensitive keys. Caps depth/size so a huge payload can't
 *  bloat the log row. */
export function maskValues(input: unknown, depth = 0): unknown {
  if (depth > 6 || input == null) return input;
  if (Array.isArray(input)) return input.slice(0, 200).map((v) => maskValues(v, depth + 1));
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY_RE.test(k) ? REDACTED : maskValues(v, depth + 1);
    }
    return out;
  }
  return input;
}

/** Diff two flat-ish objects → the list of keys whose (masked) values changed. */
export function changedFields(
  oldVals: Record<string, unknown> | null | undefined,
  newVals: Record<string, unknown> | null | undefined,
): string[] {
  if (!oldVals || !newVals) return [];
  const keys = new Set([...Object.keys(oldVals), ...Object.keys(newVals)]);
  const out: string[] = [];
  for (const k of keys) {
    if (SENSITIVE_KEY_RE.test(k)) continue; // don't even name secret fields
    if (JSON.stringify(oldVals[k]) !== JSON.stringify(newVals[k])) out.push(k);
  }
  return out;
}

export interface AuditInput {
  /** Auth context of the actor (from requireAuth/getServerAuth). */
  auth: Pick<ServerAuthContext, "account_id" | "real_account_id" | "tenant_id">;
  action_type: string; // create | update | delete | archive | export_pdf | change_price | ...
  entity_type?: string | null;
  entity_id?: string | null;
  entity_label?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  severity?: AuditSeverity;
  module?: string | null;
  route?: string | null;
  req?: Request | null;
  metadata?: Record<string, unknown>;
}

/** Insert one masked audit row. Returns nothing; failures are logged only. */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    const oldMasked = (input.old_values ? maskValues(input.old_values) : null) as
      | Record<string, unknown>
      | null;
    const newMasked = (input.new_values ? maskValues(input.new_values) : null) as
      | Record<string, unknown>
      | null;
    const changed =
      input.old_values && input.new_values
        ? changedFields(input.old_values, input.new_values)
        : null;

    const accountId = input.auth.real_account_id ?? input.auth.account_id;
    const meta = input.req ? requestMeta(input.req) : null;
    const ip = meta?.ip ?? null;

    await supabaseServer.from("audit_logs").insert({
      account_id: accountId,
      tenant_id: input.auth.tenant_id ?? null,
      action_type: input.action_type,
      entity_type: input.entity_type ?? null,
      entity_id: input.entity_id != null ? String(input.entity_id) : null,
      entity_label: input.entity_label ?? null,
      old_values: oldMasked,
      new_values: newMasked,
      changed_fields: changed,
      severity: input.severity ?? "info",
      module: input.module ?? null,
      route: input.route ?? null,
      ip,
      metadata: input.metadata ?? {},
    });

    // Fan out a Super-Admin alert for sensitive (non-info) actions.
    const severity = input.severity ?? "info";
    if (severity !== "info") {
      const label = input.entity_label || input.entity_id || input.entity_type || "record";
      // Push body reads "{action} {entity}: {label}" — e.g. "Deleted product: NEXD 9000".
      const entity = input.entity_type ?? "record";
      await notifySuperAdmins({
        kind: alertKindForAction(input.action_type),
        subject: `${humanizeAction(input.action_type)} — ${entity}: ${label}`,
        action: `${humanizeAction(input.action_type)} ${entity}: ${label}`,
        location: locationLabel(meta),
        body: input.module ? `In ${input.module}${input.route ? ` (${input.route})` : ""}` : null,
        severity,
        link: "/super-admin/activity",
        actorAccountId: accountId,
        tenantId: input.auth.tenant_id,
        metadata: { entity_type: input.entity_type, entity_id: input.entity_id, action: input.action_type },
      });
    }
  } catch (e) {
    console.error("[audit.logAudit]", e instanceof Error ? e.message : e);
  }
}

function humanizeAction(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function alertKindForAction(action: string): AlertKind {
  if (/delete|remove|purge|destroy/i.test(action)) return "data_delete";
  if (/price|cost/i.test(action)) return "price_cost_change";
  if (/permission|role|admin/i.test(action)) return "admin_role_change";
  if (/setting|policy/i.test(action)) return "settings_change";
  if (/export/i.test(action)) return "sensitive_export";
  if (/upload|file/i.test(action)) return "file_change";
  return "suspicious";
}

/** Convenience severity for common destructive/sensitive actions. */
export function severityForAction(action: string): AuditSeverity {
  if (/delete|remove|revoke|disable|purge|destroy/i.test(action)) return "critical";
  if (/change_(price|cost|permission|setting|policy)|export|admin|role/i.test(action))
    return "warning";
  return "info";
}
