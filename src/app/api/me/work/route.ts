import "server-only";

/* GET /api/me/work — the viewer's cross-app work snapshot:
   open project tasks assigned to them (due-soonest first) and their
   published Planning items for the next 7 days. To-dos are NOT included —
   the strip renders inside the To-do app, which already shows them. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const [taskRes, resourceRes] = await Promise.all([
    supabaseServer
      .from("project_tasks")
      .select("id, title, due_date, priority, project:project_id ( name, color )", { count: "exact" })
      .eq("tenant_id", auth.tenant_id)
      .eq("assignee_account_id", auth.account_id)
      .eq("status", "open")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(6),
    supabaseServer
      .from("planning_resources")
      .select("id")
      .eq("tenant_id", auth.tenant_id)
      .eq("account_id", auth.account_id)
      .eq("type", "employee")
      .maybeSingle(),
  ]);

  let planning: unknown[] = [];
  let planningCount = 0;
  if (resourceRes.data?.id) {
    const now = new Date().toISOString();
    const week = new Date(Date.now() + 7 * 86400_000).toISOString();
    const { data, count } = await supabaseServer
      .from("planning_items")
      .select("id, type, title, start_at, end_at", { count: "exact" })
      .eq("tenant_id", auth.tenant_id)
      .eq("resource_id", resourceRes.data.id)
      .eq("status", "published")
      .gte("end_at", now)
      .lt("start_at", week)
      .order("start_at", { ascending: true })
      .limit(6);
    planning = data ?? [];
    planningCount = count ?? 0;
  }

  // Open to-dos assigned to the viewer — powers the To-do app-icon badge.
  let todoCount = 0;
  {
    const { data: myAssign } = await supabaseServer
      .from("koleex_todo_assignees")
      .select("todo_id")
      .eq("account_id", auth.account_id);
    const tids = (myAssign ?? []).map((r) => (r as { todo_id: string }).todo_id);
    if (tids.length > 0) {
      const { count } = await supabaseServer
        .from("koleex_todos")
        .select("id", { count: "exact", head: true })
        .in("id", tids)
        .eq("completed", false);
      todoCount = count ?? 0;
    }
  }

  return NextResponse.json({
    tasks: taskRes.data ?? [],
    tasksCount: taskRes.count ?? 0,
    planning,
    planningCount,
    todoCount,
  });
}
