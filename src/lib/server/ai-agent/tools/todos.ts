import "server-only";

/* ---------------------------------------------------------------------------
   To-do tools — agent-facing READ operations on koleex_todos.

   Security: this ports the EXACT per-user visibility scope from
   src/app/api/todos/route.ts GET so the AI can never surface a task the
   caller couldn't see in the To-do app itself. A non-super-admin sees only
   tasks they created, assigned, are assigned to, observe, that target their
   department, or that are broadcast to all — plus the private-task overlay.
   Super-admins skip the scope (tenant filter still applies).

   Phase 1 is read-only. Money/rate fields don't exist on todos, so no
   sensitive-field stripping is needed; we still select a conservative,
   operational column set.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../../supabase-server";
import type { ToolDef, ToolResult } from "../types";

const TODO_MODULE = "To-do";

/* Operational columns only — no internal blobs, no attachments payloads. */
const TODO_COLS = `id, title, description, status, completed, completed_at,
  priority, label, due_date, start_date, remind_at, recurrence,
  assigned_department, assign_to_all, is_private, created_by_account_id,
  created_at, updated_at`;

/** Day boundaries in ISO for simple due filters. Server runtime (not the
 *  workflow sandbox) so Date is available. */
function todayRangeISO(): { startOfToday: string; endOfToday: string; endOfWeek: string } {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const week = new Date(now); week.setDate(week.getDate() + 7); week.setHours(23, 59, 59, 999);
  return { startOfToday: start.toISOString(), endOfToday: end.toISOString(), endOfWeek: week.toISOString() };
}

const listMyTodos: ToolDef<
  { filter?: string; due?: string; limit?: number },
  Array<Record<string, unknown>>
> = {
  name: "listMyTodos",
  description:
    "List the current user's to-do tasks (from the To-do app), already scoped to what THEY are allowed to see. Use for questions like 'what are my tasks', 'what's due today', 'my open to-dos', 'overdue tasks'. Returns only this user's visible tasks — never anyone else's private work.",
  parameters: {
    type: "object",
    properties: {
      filter: {
        type: "string",
        description: "Which tasks: 'open' (not done, default), 'done', or 'all'.",
        enum: ["open", "done", "all"],
      },
      due: {
        type: "string",
        description: "Optional due filter: 'any' (default), 'overdue', 'today', 'week' (next 7 days).",
        enum: ["any", "overdue", "today", "week"],
      },
      limit: { type: "integer", description: "Max rows. Default 20, cap 50." },
    },
    required: [],
  },
  requiredModule: TODO_MODULE,
  requiredAction: "view",
  handler: async (ctx, args): Promise<ToolResult<Array<Record<string, unknown>>>> => {
    const accountId = ctx.auth.account_id;
    const tenantId = ctx.auth.tenant_id;
    const limit = Math.min(Math.max(Number(args.limit ?? 20) || 20, 1), 50);
    const filter = String(args.filter ?? "open");
    const due = String(args.due ?? "any");

    let q = supabaseServer.from("koleex_todos").select(TODO_COLS).eq("tenant_id", tenantId);

    /* ── Port of the route's non-SA visibility scope ── */
    if (!ctx.isSuperAdmin) {
      // Tasks the caller is an assignee of.
      const { data: asg } = await supabaseServer
        .from("koleex_todo_assignees")
        .select("todo_id")
        .eq("account_id", accountId);
      const assigneeIds = (asg ?? []).map((r) => (r as { todo_id: string }).todo_id);

      // Tasks the caller observes (metadata.observers jsonb containment).
      const { data: obs } = await supabaseServer
        .from("koleex_todos")
        .select("id")
        .contains("metadata", { observers: [{ account_id: accountId }] })
        .eq("tenant_id", tenantId);
      const observerIds = (obs ?? []).map((r) => (r as { id: string }).id);

      const orParts = [
        `created_by_account_id.eq.${accountId}`,
        `assigned_by_account_id.eq.${accountId}`,
        `assign_to_all.eq.true`,
      ];
      if (ctx.department) orParts.push(`assigned_department.eq.${ctx.department}`);
      const ids = [...new Set([...assigneeIds, ...observerIds])];
      if (ids.length > 0) orParts.push(`id.in.(${ids.join(",")})`);
      q = q.or(orParts.join(","));

      // Private-task overlay: hide others' private tasks unless break-glass.
      if (!ctx.canViewPrivate) {
        q = q.or(`is_private.eq.false,created_by_account_id.eq.${accountId}`);
      }
    }

    /* ── Convenience filters ── */
    if (filter === "open") q = q.eq("completed", false);
    else if (filter === "done") q = q.eq("completed", true);

    if (due !== "any") {
      const { endOfToday, endOfWeek } = todayRangeISO();
      const nowISO = new Date().toISOString();
      if (due === "overdue") q = q.lt("due_date", nowISO).eq("completed", false);
      else if (due === "today") q = q.gte("due_date", nowISO.slice(0, 10)).lte("due_date", endOfToday);
      else if (due === "week") q = q.gte("due_date", nowISO).lte("due_date", endOfWeek);
    }

    const { data, error } = await q
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(limit);

    if (error) {
      console.error("[tool.listMyTodos]", error);
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't load your tasks right now." };
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return {
      ok: true,
      permissionStatus: "allowed",
      data: rows,
      message: rows.length
        ? `You have ${rows.length} matching to-do task(s).`
        : "No matching to-do tasks.",
      sources: [`koleex_todos(scope=me,tenant=${tenantId.slice(0, 8)}…)`],
    };
  },
};

export const todoTools: ToolDef[] = [listMyTodos as ToolDef];
