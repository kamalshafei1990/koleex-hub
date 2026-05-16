import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import type { FinanceNotification } from "@/lib/finance/types";

/* GET  /api/finance/notifications
 *   Returns scheduled + recently-sent reminders for the tenant. The UI
 *   uses the same list for "upcoming", "overdue" and "done" segments.
 * POST /api/finance/notifications
 *   Schedule a new reminder. Body:
 *     {
 *       type: 'collect'|'pay',
 *       reference_type, reference_id,
 *       party_name, amount, currency,
 *       due_date, reminder_offset_days
 *     }
 *   The server computes remind_at = due_date - reminder_offset_days.
 * PATCH /api/finance/notifications
 *   Body: { id, action: 'done'|'snooze'|'cancel', snooze_days? }
 */

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  let q = supabaseServer.from("finance_notifications").select("*").eq("tenant_id", auth.tenant_id);
  if (status) q = q.eq("status", status);
  q = q.order("remind_at", { ascending: true });
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notifications: data });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const body = (await req.json()) as Partial<FinanceNotification>;
  if (!body.type || !body.reference_type || !body.reference_id || !body.due_date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const offset = Math.max(0, Math.floor(Number(body.reminder_offset_days) || 0));
  const due = new Date(body.due_date);
  due.setDate(due.getDate() - offset);
  const remindAt = due.toISOString().slice(0, 10);
  const { data, error } = await supabaseServer
    .from("finance_notifications")
    .insert({
      tenant_id: auth.tenant_id,
      type: body.type,
      reference_type: body.reference_type,
      reference_id: body.reference_id,
      party_name: body.party_name ?? "",
      amount: Number(body.amount) || 0,
      currency: body.currency ?? "USD",
      due_date: body.due_date,
      reminder_offset_days: offset,
      remind_at: remindAt,
      status: "scheduled",
      notes: body.notes ?? null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notification: data });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const body = (await req.json()) as { id: string; action: "done" | "snooze" | "cancel"; snooze_days?: number };
  if (!body?.id || !body?.action) {
    return NextResponse.json({ error: "id + action required" }, { status: 400 });
  }
  let update: Record<string, unknown>;
  if (body.action === "done") {
    update = { status: "done", sent_at: new Date().toISOString() };
  } else if (body.action === "cancel") {
    update = { status: "cancelled" };
  } else {
    /* snooze: bump remind_at forward by snooze_days (default 1) */
    const days = Math.max(1, Math.floor(body.snooze_days ?? 1));
    const { data: row } = await supabaseServer
      .from("finance_notifications")
      .select("remind_at")
      .eq("id", body.id)
      .eq("tenant_id", auth.tenant_id)
      .maybeSingle();
    const base = row?.remind_at ? new Date(row.remind_at) : new Date();
    base.setDate(base.getDate() + days);
    update = { remind_at: base.toISOString().slice(0, 10), status: "snoozed" };
  }
  const { data, error } = await supabaseServer
    .from("finance_notifications")
    .update(update)
    .eq("id", body.id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notification: data });
}
