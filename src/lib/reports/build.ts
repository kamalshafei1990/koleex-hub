import "server-only";

/* ===========================================================================
   Phase R.1 — Server-side report build + audit helper.
   Called by every /api/reports/* route so audit logging and the
   internal/external visibility contract live in one place.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { ServerAuthContext } from "@/lib/server/auth";
import {
  findMissingRequiredFilter,
  getReportEntry,
} from "./registry";
import type {
  ReportBuildContext,
  ReportChannel,
  ReportFilters,
  ReportPayload,
  ReportType,
} from "./types";

export interface BuildAndAuditInput {
  auth: ServerAuthContext;
  type: ReportType;
  filters: ReportFilters;
  channel: ReportChannel;
  /** Optional storage path if the caller persisted a PDF. */
  filePath?: string | null;
  /** Suppress the audit insert. Used by the preview route — preview
   *  doesn't get written so the audit table doesn't fill with every
   *  keystroke. */
  skipAudit?: boolean;
}

export interface BuildAndAuditResult {
  payload: ReportPayload;
  exportId: string | null;
}

export async function buildAndAudit(input: BuildAndAuditInput): Promise<
  | { ok: true; result: BuildAndAuditResult }
  | { ok: false; status: number; error: string }
> {
  const entry = getReportEntry(input.type);
  if (!entry) return { ok: false, status: 400, error: `Unknown report_type '${input.type}'` };

  const missing = findMissingRequiredFilter(input.type, input.filters as Record<string, unknown>);
  if (missing) {
    return { ok: false, status: 400, error: `Missing required filter '${missing}' for ${input.type}` };
  }

  const ctx: ReportBuildContext = {
    tenantId: input.auth.tenant_id,
    tenantName: "",
    generatedByName: input.auth.username || input.auth.login_email || "Operator",
    generatedByAccountId: input.auth.account_id,
    filters: input.filters,
  };

  let payload: ReportPayload;
  try {
    payload = await entry.build(ctx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[reports build]", input.type, msg);
    return { ok: false, status: 500, error: `Builder failed: ${msg}` };
  }

  /* DEFENCE IN DEPTH — visibility contract enforcement. If the builder
     misconfigured visibility, the registry's descriptor wins. */
  if (payload.meta.visibility !== entry.descriptor.visibility) {
    payload = { ...payload, meta: { ...payload.meta, visibility: entry.descriptor.visibility } };
  }
  /* And external reports never carry an internal_warning. */
  if (payload.meta.visibility === "external") {
    payload = { ...payload, internal_warning: undefined };
  }

  let exportId: string | null = null;
  if (!input.skipAudit) {
    const { data, error } = await supabaseServer
      .from("finance_report_exports")
      .insert({
        tenant_id: input.auth.tenant_id,
        report_type: input.type,
        visibility: entry.descriptor.visibility,
        channel: input.channel,
        target_entity_type: pickTargetEntityType(input.type),
        target_entity_id: pickTargetEntityId(input.type, input.filters),
        generated_by: input.auth.account_id,
        filters: input.filters,
        file_path: input.filePath ?? null,
        row_count: payload.row_count,
        total_amount: payload.total_amount ?? null,
        currency: payload.meta.currency,
        metadata: {
          report_no: payload.meta.report_no,
        },
      })
      .select("id")
      .single();
    if (error) {
      /* Logging failure is non-blocking for the user — the report
         is still returned. The error is captured for ops. */
      console.error("[reports audit]", error.message);
    } else if (data) {
      exportId = (data as { id: string }).id;
    }
  }

  return { ok: true, result: { payload, exportId } };
}

function pickTargetEntityType(type: ReportType): string | null {
  switch (type) {
    case "customer_statement":
      return "customer";
    case "supplier_statement":
      return "supplier";
    case "reconciliation_report":
      return "bank_account";
    default:
      return null;
  }
}

function pickTargetEntityId(type: ReportType, filters: ReportFilters): string | null {
  switch (type) {
    case "customer_statement":
      return filters.customer_id ?? null;
    case "supplier_statement":
      return filters.supplier_id ?? null;
    case "reconciliation_report":
      return filters.bank_account_id ?? null;
    default:
      return null;
  }
}
