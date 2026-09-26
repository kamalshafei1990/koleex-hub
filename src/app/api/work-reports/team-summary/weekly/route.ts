import "server-only";

/* ---------------------------------------------------------------------------
   /api/work-reports/team-summary/weekly — a manager's OWN weekly team
   summary (6E, owner's picks 26/09/2026): every Monday at 07:00 in their own
   time, the week that ended, written by Koleex AI into a "Weekly team
   summary" draft (the 5D schedule engine prepares it; nothing is sent).

   GET  { available, on } — available: this person may start the type (a
        manager with a team; the company has not hidden it).
   PUT  { on: boolean } — switches THEIR OWN schedule row (the same
        work_report_schedules row the Compliance setup writes), nobody else's.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth, type ServerAuthContext } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { canStartTemplate, requireReportsUser } from "@/lib/server/reports/core";
import { loadHiddenKeys } from "@/lib/server/reports/custom-templates";
import { saveSchedule } from "@/lib/server/reports/schedules";
import { reportTemplate } from "@/lib/reports/catalog";

export const dynamic = "force-dynamic";

const KEY = "team_weekly";
const NO_STORE = { "Cache-Control": "private, no-store" };

async function available(auth: ServerAuthContext): Promise<boolean> {
  const tpl = reportTemplate(KEY);
  if (!tpl) return false;
  const hidden = await loadHiddenKeys(auth.tenant_id).catch(() => [] as string[]);
  return !hidden.includes(KEY) && (await canStartTemplate(tpl, auth));
}

async function isOn(auth: ServerAuthContext): Promise<boolean> {
  let q = supabaseServer.from("work_report_schedules").select("active").eq("account_id", auth.account_id).eq("template_key", KEY);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data } = await q.maybeSingle();
  return !!(data as { active?: boolean } | null)?.active;
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const [ok, on] = await Promise.all([available(auth), isOn(auth)]);
  return NextResponse.json({ available: ok, on: ok && on }, { headers: NO_STORE });
}

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const body = (await req.json().catch(() => null)) as { on?: unknown } | null;
  if (typeof body?.on !== "boolean") return NextResponse.json({ error: "bad_body" }, { status: 400 });
  if (!(await available(auth))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  /* Off with nothing switched on: nothing to write. */
  if (!body.on && !(await isOn(auth))) return NextResponse.json({ available: true, on: false }, { headers: NO_STORE });
  try {
    const res = await saveSchedule(auth, { accountId: auth.account_id, templateKey: KEY, active: body.on });
    if (res !== "ok") return NextResponse.json({ error: "bad_type" }, { status: 400 });
  } catch (e) {
    console.error("[reports.team-weekly] save:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
  return NextResponse.json({ available: true, on: body.on }, { headers: NO_STORE });
}
