import "server-only";

/* GET /api/cron/hr-expiry-reminders  (daily)
   Makes the HR expiry dates the Add Employee form collects ACTIONABLE:
   visa, insurance, contract end, probation end and driving licence.
   Any of them falling within the next 30 days notifies HR (super admins +
   accounts holding the "HR" role) via inbox + web push.

   Dedupe: one inbox row per employee+field+date, checked with a jsonb
   containment probe on inbox_messages.metadata — NO schema needed, same
   pattern as /api/cron/project-task-reminders. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { sendPushToAccounts } from "@/lib/server/web-push";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 30;

const EXPIRY_FIELDS: { column: string; label: string }[] = [
  { column: "visa_expiry_date", label: "Visa" },
  { column: "insurance_expiry_date", label: "Insurance" },
  { column: "contract_end_date", label: "Contract" },
  { column: "probation_end_date", label: "Probation" },
  { column: "driving_license_expiry", label: "Driving licence" },
];

interface EmployeeRow {
  id: string;
  person_id: string | null;
  employment_status: string | null;
  [key: string]: unknown;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + WINDOW_DAYS * 86400_000)
    .toISOString()
    .slice(0, 10);

  // Recipients: super admins + HR-role accounts (internal, active).
  const { data: hrRole } = await supabaseServer
    .from("roles")
    .select("id")
    .eq("name", "HR")
    .maybeSingle();
  let recQuery = supabaseServer
    .from("accounts")
    .select("id")
    .eq("user_type", "internal")
    .eq("status", "active");
  recQuery = hrRole
    ? recQuery.or(`is_super_admin.eq.true,role_id.eq.${(hrRole as { id: string }).id}`)
    : recQuery.eq("is_super_admin", true);
  const { data: recRows } = await recQuery;
  const recipients = (recRows ?? []).map((r) => (r as { id: string }).id);
  if (recipients.length === 0) return NextResponse.json({ ok: true, fired: 0 });

  // Active employees with at least one expiry inside the window.
  const cols = EXPIRY_FIELDS.map((f) => f.column).join(", ");
  const orParts = EXPIRY_FIELDS.map(
    (f) => `and(${f.column}.gte.${today},${f.column}.lte.${horizon})`,
  ).join(",");
  const { data: empRows, error } = await supabaseServer
    .from("koleex_employees")
    .select(`id, person_id, employment_status, ${cols}`)
    .eq("employment_status", "active")
    .or(orParts);
  if (error) {
    console.error("[cron/hr-expiry]", error.message);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
  const employees = (empRows ?? []) as unknown as EmployeeRow[];
  if (employees.length === 0) return NextResponse.json({ ok: true, fired: 0 });

  // Resolve names for readable notifications.
  const personIds = employees.map((e) => e.person_id).filter(Boolean) as string[];
  const { data: people } = personIds.length
    ? await supabaseServer.from("people").select("id, full_name").in("id", personIds)
    : { data: [] as Array<{ id: string; full_name: string | null }> };
  const nameMap = new Map(
    ((people ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p.full_name]),
  );

  let fired = 0;
  for (const emp of employees) {
    const empName =
      (emp.person_id && nameMap.get(emp.person_id)) || "an employee";
    for (const field of EXPIRY_FIELDS) {
      const date = emp[field.column] as string | null;
      if (!date) continue;
      const day = date.slice(0, 10);
      if (day < today || day > horizon) continue;

      // Already notified for this employee+field+date?
      const { data: existing } = await supabaseServer
        .from("inbox_messages")
        .select("id")
        .contains("metadata", {
          type: "hr_expiry",
          employee_id: emp.id,
          field: field.column,
          date: day,
        })
        .limit(1);
      if (existing && existing.length > 0) continue;

      const subject = `${field.label} expiring soon: ${empName}`;
      const body = `${field.label} for ${empName} expires on ${day}. Review and renew before the deadline.`;
      await supabaseServer.from("inbox_messages").insert(
        recipients.map((recipientId) => ({
          recipient_account_id: recipientId,
          category: "task",
          subject,
          body,
          link: `/employees/${emp.id}`,
          metadata: {
            type: "hr_expiry",
            employee_id: emp.id,
            field: field.column,
            date: day,
          },
        })),
      );
      await sendPushToAccounts(recipients, {
        title: subject,
        body,
        url: `/employees/${emp.id}`,
      });
      fired++;
    }
  }

  return NextResponse.json({ ok: true, fired, checked: employees.length });
}
