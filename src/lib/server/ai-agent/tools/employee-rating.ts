import "server-only";

/* ---------------------------------------------------------------------------
   employee-rating tool — the agent reads monthly rating results.

   Phase 5 (plan §G.1). Two scopes, decided in the handler (never wider than
   the caller's own rights):
     · no argument  → the CALLER's own latest published rating — every signed
       user may read their own, module gate or not (it is their report);
     · an employee  → someone else's rating — needs HR module view (the same
       gate the HR screens use).

   Only FINALIZED/PUBLISHED cycles answer. The AI permission intersection
   (user ∩ tenant ∩ module ∩ tool) holds; a viewing-as super admin reads
   their own, like everyone.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../../supabase-server";
import { requireModuleAction } from "@/lib/server/auth";
import type { ToolDef, ToolResult } from "../types";
import { isUuid } from "../uuid";
import { resourceRef, type ResourceRef } from "@/lib/server/ai/core/resource-ref";

type RatingPayload = {
  employee: string;
  month: string;
  overall: number | null;
  band: string | null;
  skills_avg: number | null;
  behavior_avg: number | null;
  delta_overall: number | null;
  report_link: string | null;
  /** The report as a client-neutral ref beside its Hub link — the
      client-neutral rule for every tool link (validate:ai-client-neutral). */
  report_resource: ResourceRef | null;
};

const getEmployeeRating: ToolDef<{ employee?: string }, RatingPayload> = {
  name: "get_employee_rating",
  description:
    "Read a monthly employee rating (the HR monthly rating system). Without arguments, returns the CALLER's own latest rating. With an employee name or id, reads that person's rating — HR only. Returns overall score, band, skills/behavior averages, the change vs last month, and a link to the full report.",
  parameters: {
    type: "object",
    properties: {
      employee: { type: "string", description: "Name or id of the employee. Omit for the caller's own rating." },
    },
    required: [],
  },
  /* Gated in the handler: own rating needs no module, others need HR view. */
  requiredModule: undefined,
  requiredAction: "view",
  handler: async (ctx, args): Promise<ToolResult<RatingPayload>> => {
    const q = typeof args.employee === "string" ? args.employee.trim() : "";

    let employeeId: string;
    if (!q) {
      const { data: self } = await supabaseServer
        .from("koleex_employees").select("id")
        .eq("account_id", ctx.auth.account_id)
        .eq("tenant_id", ctx.auth.tenant_id)
        .maybeSingle();
      if (!self) return { ok: false, permissionStatus: "allowed", data: null,
        message: "No employee record is linked to your account." };
      employeeId = self.id;
    } else {
      /* someone else's rating — the HR gate, same as the screens */
      const deny = await requireModuleAction(ctx.auth, "HR", "view");
      if (deny) return { ok: false, permissionStatus: "denied", data: null,
        message: "Reading someone else's rating requires HR access." };
      let query = supabaseServer.from("koleex_employees").select("id, person:person_id(full_name)")
        .eq("tenant_id", ctx.auth.tenant_id);
      query = isUuid(q) ? query.eq("id", q) : query;
      const { data: rows } = await query.limit(50);
      const matches = (rows ?? []).filter((r) => {
        if (isUuid(q)) return r.id === q;
        const p = (r as { person?: { full_name?: string } | Array<{ full_name?: string }> }).person;
        const name = (Array.isArray(p) ? p[0]?.full_name : p?.full_name) ?? "";
        return name.toLowerCase().includes(q.toLowerCase());
      });
      if (matches.length === 0) return { ok: false, permissionStatus: "allowed", data: null,
        message: `No employee matches "${q}".` };
      if (matches.length > 1) return { ok: false, permissionStatus: "allowed", data: null,
        message: `Several employees match "${q}" — be more specific.` };
      employeeId = matches[0].id;
    }

    /* latest cycle that is finalized or published — drafts never answer */
    const { data: sum } = await supabaseServer
      .from("rating_summaries")
      .select("cycle_id, overall, band, skills_avg, behavior_avg, delta_overall, rating_cycles!inner(month, status)")
      .eq("employee_id", employeeId)
      .eq("tenant_id", ctx.auth.tenant_id)
      .in("rating_cycles.status", ["finalized", "published"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sum) return { ok: false, permissionStatus: "allowed", data: null,
      message: "No finalized rating exists yet for this employee." };

    const cycleRel = (sum as unknown as { rating_cycles: { month: string } | Array<{ month: string }> }).rating_cycles;
    const month = (Array.isArray(cycleRel) ? cycleRel[0]?.month : cycleRel?.month) ?? "";

    /* the report it became, for the link */
    const { data: report } = await supabaseServer
      .from("work_reports").select("id")
      .eq("tenant_id", ctx.auth.tenant_id).eq("template_key", "hr_monthly_rating")
      .eq("period_key", month.slice(0, 7))
      .maybeSingle();

    const emp = await supabaseServer.from("koleex_employees").select("person:person_id(full_name)")
      .eq("id", employeeId).eq("tenant_id", ctx.auth.tenant_id).maybeSingle();
    const person = (emp.data as { person?: { full_name?: string } | Array<{ full_name?: string}> } | null)?.person;
    const name = (Array.isArray(person) ? person[0]?.full_name : person?.full_name) ?? "the employee";

    return {
      ok: true,
      permissionStatus: "allowed",
      data: {
        employee: name,
        month,
        overall: sum.overall,
        band: sum.band,
        skills_avg: sum.skills_avg,
        behavior_avg: sum.behavior_avg,
        delta_overall: sum.delta_overall,
        report_link: report ? `/reports/${report.id}` : null,
        report_resource: report ? resourceRef("report", report.id) : null,
      },
    };
  },
};

export const employeeRatingTools: ToolDef[] = [getEmployeeRating as unknown as ToolDef];
