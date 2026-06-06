import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/qa/my-issues — the caller's OWN reported issues (list).

   Powers the reporter "My Issues" page so a non-admin can browse the reports
   they filed and open any of them (where they can edit while pre-work — issue
   e3bc4002). Strictly scoped to reporter_id = caller; tenant-isolated; returns
   only reporter-safe columns (never internal/developer notes).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabaseServer
    .from("qa_issue_reports")
    .select(
      "id, title, status, issue_type, severity, priority, app_module, route, reopen_count, created_at, updated_at, resolved_at",
    )
    .eq("tenant_id", auth.tenant_id)
    .eq("reporter_id", auth.account_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: "Couldn't load your reports." }, { status: 500 });
  }

  return NextResponse.json({ issues: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}
