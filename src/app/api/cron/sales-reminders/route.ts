import "server-only";

/* GET /api/cron/sales-reminders  (daily)
   The two sales notices that no one's click triggers — only the calendar:

   1. A quotation still "sent" past its valid-till date tells its creator
      it expired (quotation_expired). Once per quotation per date: the
      same valid-till is never reminded twice, and a renewed date that
      lapses again is a new reminder. Settled when the quotation leaves
      "sent" or is deleted (lib/server/commerce-notify).
   2. A CRM follow-up due today, or overdue by up to a week, reminds its
      assignee (else its author) each morning until it is done
      (crm_followup_due). Today's reminder replaces yesterday's unread one.

   Look-back windows are short on purpose: the first run must not bury
   anyone under months of old quotations and forgotten follow-ups.

   Dedupe is a jsonb containment probe on inbox_messages.metadata — the
   pattern of /api/cron/hr-expiry-reminders; no schema needed. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { notifyLite } from "@/lib/server/notify-lite";
import { dmyDate } from "@/lib/work-reports";

export const dynamic = "force-dynamic";

const QUOTE_LOOKBACK_DAYS = 7;
const FOLLOWUP_LOOKBACK_DAYS = 7;
const DAY = 86_400_000;

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

async function alreadySent(recipient: string, meta: Record<string, string>): Promise<boolean> {
  const { data } = await supabaseServer
    .from("inbox_messages")
    .select("id")
    .eq("recipient_account_id", recipient)
    .contains("metadata", meta)
    .limit(1);
  return (data ?? []).length > 0;
}

async function expiredQuotations(today: string): Promise<number> {
  const { data, error } = await supabaseServer
    .from("quotations")
    .select("id, tenant_id, quote_no, valid_till, created_by")
    .eq("status", "sent")
    .lt("valid_till", today)
    .gte("valid_till", isoDay(Date.parse(today) - QUOTE_LOOKBACK_DAYS * DAY))
    .not("created_by", "is", null)
    .limit(500);
  if (error) {
    console.error("[cron/sales-reminders quotations]", error.message);
    return 0;
  }
  let fired = 0;
  for (const q of (data ?? []) as Array<{ id: string; tenant_id: string; quote_no: string | null; valid_till: string; created_by: string }>) {
    const validTill = q.valid_till.slice(0, 10);
    if (await alreadySent(q.created_by, { type: "quotation_expired", quotation_id: q.id, valid_till: validTill })) continue;
    await notifyLite({
      tenantId: q.tenant_id,
      recipients: [q.created_by],
      tpl: { k: "quotation_expired", p: { no: q.quote_no || "—", date: dmyDate(validTill) } },
      link: `/quotations?doc=${encodeURIComponent(q.id)}`,
      type: "quotation_expired",
      metadata: { source: "quotations", quotation_id: q.id, valid_till: validTill },
      tag: `quotation:${q.id}`,
    });
    fired++;
  }
  return fired;
}

async function dueFollowups(today: string): Promise<number> {
  const start = new Date(Date.parse(today) - FOLLOWUP_LOOKBACK_DAYS * DAY).toISOString();
  const end = new Date(Date.parse(today) + DAY).toISOString();
  const { data, error } = await supabaseServer
    .from("crm_activities")
    .select("id, tenant_id, opportunity_id, title, due_at, assignee_account_id, created_by_account_id")
    .is("done_at", null)
    .gte("due_at", start)
    .lt("due_at", end)
    .limit(1000);
  if (error) {
    console.error("[cron/sales-reminders followups]", error.message);
    return 0;
  }
  type Row = {
    id: string; tenant_id: string; opportunity_id: string; title: string; due_at: string;
    assignee_account_id: string | null; created_by_account_id: string | null;
  };
  const rows = (data ?? []) as Row[];
  if (!rows.length) return 0;

  const oppIds = [...new Set(rows.map((r) => r.opportunity_id))];
  const { data: opps } = await supabaseServer.from("crm_opportunities").select("id, name").in("id", oppIds.slice(0, 200));
  const dealName = new Map(((opps ?? []) as Array<{ id: string; name: string | null }>).map((o) => [o.id, o.name]));

  let fired = 0;
  for (const a of rows) {
    const owner = a.assignee_account_id ?? a.created_by_account_id;
    if (!owner) continue;
    if (await alreadySent(owner, { type: "crm_followup_due", activity_id: a.id, day: today })) continue;
    await notifyLite({
      tenantId: a.tenant_id,
      recipients: [owner],
      tpl: {
        k: "crm_followup_due",
        p: { title: a.title, date: dmyDate(a.due_at.slice(0, 10)), deal: dealName.get(a.opportunity_id) ?? undefined },
      },
      link: `/crm?opportunity=${encodeURIComponent(a.opportunity_id)}`,
      type: "crm_followup_due",
      metadata: { source: "crm", activity_id: a.id, opportunity_id: a.opportunity_id, day: today },
      tag: `crm-followup:${a.id}`,
      supersede: { type: "crm_followup_due", activity_id: a.id },
    });
    fired++;
  }
  return fired;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const today = new Date().toISOString().slice(0, 10);
  const [quotations, followups] = await Promise.all([expiredQuotations(today), dueFollowups(today)]);
  return NextResponse.json({ ok: true, quotations, followups });
}
