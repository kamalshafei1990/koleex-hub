import "server-only";
import { dmyDate } from "@/lib/work-reports";

/* GET /api/cron/finance-reminders — fire the Finance payment reminders.

   Finance › Reminders schedules a row in finance_notifications with a
   computed `remind_at`, but until this cron existed nothing ever READ that
   date: a reminder was a line in a list that someone had to remember to
   look at, which is the opposite of a reminder. Once a day, every reminder
   whose remind_at has arrived (scheduled or snoozed) becomes an inbox row +
   push for the people who handle money — the tenant's Finance role and its
   Super Admins — and is stamped `sent` so it never fires twice. The Finance
   page's own list keeps showing it until someone marks it collected/paid.

   Guarded by CRON_SECRET like the other crons (skipped when unset for local
   hand-runs). */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { notifyLite } from "@/lib/server/notify-lite";
import { superAdminAccountIds } from "@/lib/server/sa-notify";

export const dynamic = "force-dynamic";

interface ReminderRow {
  id: string;
  tenant_id: string | null;
  type: "collect" | "pay";
  party_name: string | null;
  amount: number | string | null;
  currency: string | null;
  due_date: string;
  status: string;
}

/* What the reminder says — collect / pay × named / unnamed ("a party") ×
   due / overdue: one template each, so no reader gets a sentence glued from
   translated fragments. The counterparty's name and the amount are plain
   values (a name is never machine-translated). */
const REMINDER_TPL = {
  collect: {
    named: { due: { k: "finance_reminder.collect.due" }, overdue: { k: "finance_reminder.collect.overdue" } },
    unnamed: { due: { k: "finance_reminder.collect.unnamed.due" }, overdue: { k: "finance_reminder.collect.unnamed.overdue" } },
  },
  pay: {
    named: { due: { k: "finance_reminder.pay.due" }, overdue: { k: "finance_reminder.pay.overdue" } },
    unnamed: { due: { k: "finance_reminder.pay.unnamed.due" }, overdue: { k: "finance_reminder.pay.unnamed.overdue" } },
  },
} as const;

/** Active accounts whose role is named "Finance", plus the Super Admins. */
async function financeRecipients(tenantId: string | null): Promise<string[]> {
  const ids = new Set<string>(await superAdminAccountIds(tenantId));
  let q = supabaseServer
    .from("accounts")
    .select("id, role:roles(name)")
    .eq("status", "active");
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q;
  for (const row of (data ?? []) as Array<{ id: string; role: { name?: string } | Array<{ name?: string }> | null }>) {
    const role = Array.isArray(row.role) ? row.role[0] : row.role;
    if ((role?.name ?? "").toLowerCase() === "finance") ids.add(row.id);
  }
  return [...ids];
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseServer
    .from("finance_notifications")
    .select("id, tenant_id, type, party_name, amount, currency, due_date, status")
    .in("status", ["scheduled", "snoozed"])
    .lte("remind_at", today)
    .order("remind_at", { ascending: true })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due = (data ?? []) as ReminderRow[];
  const recipientsByTenant = new Map<string | null, string[]>();
  let fired = 0;
  for (const r of due) {
    let recipients = recipientsByTenant.get(r.tenant_id);
    if (!recipients) {
      recipients = await financeRecipients(r.tenant_id);
      recipientsByTenant.set(r.tenant_id, recipients);
    }
    const amount = r.amount != null ? `${Number(r.amount).toLocaleString("en")} ${r.currency ?? ""}`.trim() : null;
    const overdue = r.due_date < today;
    const side = r.type === "collect" ? REMINDER_TPL.collect : REMINDER_TPL.pay;
    const { k } = side[r.party_name ? "named" : "unnamed"][overdue ? "overdue" : "due"];
    await notifyLite({
      tenantId: r.tenant_id,
      recipients,
      tpl: { k, p: { who: r.party_name || null, amount, due: dmyDate(r.due_date) } },
      link: "/finance/notifications",
      type: "finance_reminder",
      metadata: { source: "finance", reminder_id: r.id, reference_type: r.type, due_date: r.due_date },
      tag: `finance-reminder:${r.id}`,
      /* A snoozed reminder firing again replaces its own unread copy. */
      supersede: { type: "finance_reminder", reminder_id: r.id },
    });
    /* Stamp regardless of recipients so a tenant with nobody to tell does
       not re-fire every morning. */
    await supabaseServer
      .from("finance_notifications")
      .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", r.id);
    fired += 1;
  }

  return NextResponse.json({ ok: true, due: due.length, fired });
}
