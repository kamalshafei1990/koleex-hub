import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

/* ---------------------------------------------------------------------------
   POST /api/hr/data — the HR app's single data gateway.

   Why it exists: every hr_* table has RLS enabled with NO policies (deny-all
   by design — HR data is sensitive), while the HR modules used to query them
   from the BROWSER with the anon key. Every read came back empty and every
   write failed, so the whole app was a dead shell. This route runs the same
   queries server-side with the service role, gated by the caller's HR module
   permission — no RLS change needed.

   The body is a QUERY DESCRIPTOR mirroring the small supabase-js surface the
   HR lib actually uses (see src/lib/hr-client.ts, which serializes it). Only
   whitelisted tables and filter operators are accepted; anything else 400s.
   --------------------------------------------------------------------------- */

/** Tables the gateway may touch, and what it may do to them. */
const TABLES: Record<string, { write: boolean }> = {
  hr_leave_types: { write: true },
  hr_leave_balances: { write: true },
  hr_leave_requests: { write: true },
  hr_attendance_policies: { write: true },
  hr_attendance_records: { write: true },
  hr_job_postings: { write: true },
  hr_applicants: { write: true },
  hr_interview_rounds: { write: true },
  hr_appraisal_cycles: { write: true },
  hr_appraisals: { write: true },
  hr_goals: { write: true },
  hr_checklists: { write: true },
  hr_checklist_instances: { write: true },
  hr_salary_records: { write: true },
  hr_payslips: { write: true },
  hr_courses: { write: true },
  hr_training_records: { write: true },
  hr_documents: { write: true },
  /* Name lookups only — these live in the org structure, not HR. */
  koleex_departments: { write: false },
  koleex_positions: { write: false },
};

type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "is" | "not_is";
const FILTER_OPS: ReadonlySet<string> = new Set([
  "eq", "neq", "gt", "gte", "lt", "lte", "in", "is", "not_is",
]);

interface QueryDescriptor {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  /** Column list for select (default "*"). Letters, digits, _ , commas, spaces only. */
  columns?: string;
  filters?: Array<{ col: string; op: FilterOp; value: unknown }>;
  order?: { col: string; ascending?: boolean };
  limit?: number;
  /** count:"exact" + head → returns { count } without rows. */
  count?: boolean;
  single?: "single" | "maybeSingle";
  /** insert/update payload. */
  values?: Record<string, unknown> | Record<string, unknown>[];
}

const IDENT = /^[a-zA-Z0-9_]+$/;
const COLUMNS = /^[a-zA-Z0-9_,\s*]+$/;

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let q: QueryDescriptor;
  try {
    q = (await req.json()) as QueryDescriptor;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const spec = TABLES[q.table];
  if (!spec) return NextResponse.json({ error: `Unknown table` }, { status: 400 });
  if (q.op !== "select" && !spec.write) {
    return NextResponse.json({ error: "Read-only table" }, { status: 403 });
  }

  /* Permission: reads need HR view, writes need the matching HR action.
     Same module the Roles & Permissions editor governs. */
  const action =
    q.op === "select" ? "view"
    : q.op === "insert" ? "create"
    : q.op === "update" ? "edit"
    : "delete";
  const denied = await requireModuleAction(auth, "HR", action);
  if (denied) return denied;

  /* Validate identifiers before they reach the query builder. */
  if (q.columns && !COLUMNS.test(q.columns)) {
    return NextResponse.json({ error: "Bad columns" }, { status: 400 });
  }
  for (const f of q.filters ?? []) {
    if (!IDENT.test(f.col) || !FILTER_OPS.has(f.op)) {
      return NextResponse.json({ error: "Bad filter" }, { status: 400 });
    }
  }
  if (q.order && !IDENT.test(q.order.col)) {
    return NextResponse.json({ error: "Bad order column" }, { status: 400 });
  }

  try {
    const table = supabaseServer.from(q.table);

    /* eslint-disable @typescript-eslint/no-explicit-any -- dynamic builder */
    let builder: any;
    switch (q.op) {
      case "select":
        builder = q.count
          ? table.select(q.columns || "id", { count: "exact", head: true })
          : table.select(q.columns || "*");
        break;
      case "insert":
        builder = table.insert(q.values as never).select();
        break;
      case "update":
        if (!q.filters?.length) {
          return NextResponse.json({ error: "Update requires filters" }, { status: 400 });
        }
        builder = table.update(q.values as never).select();
        break;
      case "delete":
        if (!q.filters?.length) {
          return NextResponse.json({ error: "Delete requires filters" }, { status: 400 });
        }
        builder = table.delete();
        break;
      default:
        return NextResponse.json({ error: "Bad op" }, { status: 400 });
    }

    for (const f of q.filters ?? []) {
      if (f.op === "in") builder = builder.in(f.col, f.value as unknown[]);
      else if (f.op === "is") builder = builder.is(f.col, f.value as null);
      else if (f.op === "not_is") builder = builder.not(f.col, "is", f.value as null);
      else builder = builder[f.op](f.col, f.value);
    }
    if (q.order) builder = builder.order(q.order.col, { ascending: q.order.ascending ?? true });
    if (q.limit) builder = builder.limit(q.limit);
    if (q.single === "single") builder = builder.single();
    else if (q.single === "maybeSingle") builder = builder.maybeSingle();

    const { data, error, count } = await builder;
    if (error) {
      /* Surface the DB message — the HR lib logs it exactly as supabase-js
         would have, so debugging stays familiar. */
      return NextResponse.json({ data: null, count: null, error: error.message }, { status: 200 });
    }
    return NextResponse.json({ data: data ?? null, count: count ?? null, error: null });
  } catch (e) {
    console.error("[api/hr/data]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
