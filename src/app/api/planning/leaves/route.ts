import "server-only";

/* GET /api/planning/leaves?from=YYYY-MM-DD&to=YYYY-MM-DD
   Approved HR leave mapped onto Planning employee resources, so the
   schedule board can block those days visually and flag any item
   scheduled over someone's leave — plus (`away`) the same people's
   Calendar out-of-office time, in ONE request so the week's overlay and
   its warm-cache entry stay a single fetch.

   `away` reads through loadOutOfOffice (lib/server/planning-conflicts),
   the exact helper the conflict check uses: this tenant's out_of_office
   events of the accounts behind its employee resources, one-offs plus
   recurring series expanded with their per-occurrence exceptions. A span
   carries its `title` ONLY when the caller could open that event in
   Calendar anyway — the free/busy rule (lib/server/calendar-feed
   loadBusyBlocks): never a private event; otherwise the caller organizes
   it, is invited to it, or is a Super Admin. Computed here, server-side;
   every other span is a bare time span.
   The window is widened a day each side so any planner zone's days are
   covered; the board clips to its own days. A Calendar read failure is
   logged and answers `away: []` — it never hides the leave.

   Tenant scope: hr_leave_requests carries no tenant_id, so the query is
   driven FROM the tenant — its employee resources → their accounts → the
   employees behind those accounts → only those employees' leave. The row
   limit therefore applies within this tenant, not across all of them. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { loadOutOfOffice } from "@/lib/server/planning-conflicts";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** One out-of-office span on a resource, as the board draws it. */
interface AwayOut {
  resource_id: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  /** All-day only: inclusive local date keys on the owner's clock. */
  start_date?: string;
  end_date?: string;
  /** Only when the caller may read the event (see the header). */
  title?: string;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const noStore = { headers: { "Cache-Control": "private, no-store" } };
  const fail = (where: string, msg: string) => {
    console.error(`[api/planning/leaves] ${where}:`, msg);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  };

  const { data: resources, error: resErr } = await supabaseServer
    .from("planning_resources")
    .select("id, account_id")
    .eq("tenant_id", auth.tenant_id)
    .eq("type", "employee")
    .not("account_id", "is", null);
  if (resErr) return fail("resources", resErr.message);
  /* One account can sit behind more than one employee resource. */
  const accountToResources = new Map<string, string[]>();
  for (const r of resources ?? []) {
    const list = accountToResources.get(r.account_id as string) ?? [];
    list.push(r.id as string);
    accountToResources.set(r.account_id as string, list);
  }
  const accountIds = [...accountToResources.keys()];
  if (accountIds.length === 0) return NextResponse.json({ leaves: [], away: [] }, noStore);

  /* Calendar out-of-office, alongside the HR chain. */
  const fromIso = new Date(Date.parse(`${from}T00:00:00Z`) - DAY_MS).toISOString();
  const toIso = new Date(Date.parse(`${to}T00:00:00Z`) + 2 * DAY_MS).toISOString();
  const awayP: Promise<AwayOut[]> = loadOutOfOffice(auth.tenant_id, accountIds, fromIso, toIso, {
    account_id: auth.account_id,
    is_super_admin: !!auth.is_super_admin,
  }).then(
    (byAccount) => {
      const out: AwayOut[] = [];
      for (const [acct, spans] of byAccount) {
        for (const resource_id of accountToResources.get(acct) ?? []) {
          for (const sp of spans) {
            out.push({
              resource_id,
              start_at: new Date(sp.s).toISOString(),
              end_at: new Date(sp.e).toISOString(),
              all_day: !!sp.days,
              ...(sp.days ? { start_date: sp.days.start, end_date: sp.days.end } : {}),
              ...(sp.title ? { title: sp.title } : {}),
            });
          }
        }
      }
      return out.sort((a, b) => a.start_at.localeCompare(b.start_at));
    },
    (e: unknown) => {
      console.error("[api/planning/leaves] out of office:", e instanceof Error ? e.message : e);
      return [];
    },
  );

  const { data: emps, error: empErr } = await supabaseServer
    .from("koleex_employees")
    .select("id, account_id")
    .in("account_id", accountIds)
    .or(`tenant_id.eq.${auth.tenant_id},tenant_id.is.null`);
  if (empErr) return fail("employees", empErr.message);
  const empToAccount = new Map(
    (emps ?? []).map((e) => [e.id as string, e.account_id as string]),
  );
  const employeeIds = [...empToAccount.keys()];
  if (employeeIds.length === 0) return NextResponse.json({ leaves: [], away: await awayP }, noStore);

  const { data: reqs, error: lvErr } = await supabaseServer
    .from("hr_leave_requests")
    .select("employee_id, start_date, end_date")
    .eq("status", "approved")
    .in("employee_id", employeeIds)
    .lte("start_date", to)
    .gte("end_date", from)
    .limit(500);
  if (lvErr) return fail("leave", lvErr.message);

  const leaves = (reqs ?? []).flatMap((r) => {
    const acct = empToAccount.get(r.employee_id as string);
    return (acct ? accountToResources.get(acct) ?? [] : []).map((resource_id) => ({
      resource_id,
      start_date: r.start_date,
      end_date: r.end_date,
    }));
  });

  return NextResponse.json({ leaves, away: await awayP }, noStore);
}
