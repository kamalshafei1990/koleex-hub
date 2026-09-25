import "server-only";

/* ---------------------------------------------------------------------------
   /api/work-reports/schedules — the drafts the system prepares on schedule
   (Phase 5D, owner's picks 26 Sep 2026). Set like «who must write what»: a
   super admin or HR · edit only.

   GET  { schedules: [{ accountId, templateKey, active, lastPeriod,
          lastReportId }], types: [key…] } — the types that may be
        scheduled: a week's or a month's (the builder's active ones too)
   PUT  { accountId, templateKey, active?: boolean, remove?: true } → the
        same shape as GET. Only the tenant's own people; only a type that
        may be scheduled.

   A schedule gives no right: the cron prepares a draft only for someone
   who may start the type (lib/server/reports/schedules).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth, type ServerAuthContext } from "@/lib/server/auth";
import { isUuid, requireReportsUser } from "@/lib/server/reports/core";
import { canSetUp, ownerIds } from "@/lib/server/reports/obligations";
import { loadSchedules, saveSchedule } from "@/lib/server/reports/schedules";
import { loadCustomHeads } from "@/lib/server/reports/custom-templates";
import { REPORT_TEMPLATES } from "@/lib/reports/catalog";
import { schedulable } from "@/lib/reports/schedules";

export const dynamic = "force-dynamic";
const forbidden = () => NextResponse.json({ error: "forbidden" }, { status: 403 });

async function answer(auth: ServerAuthContext) {
  const [schedules, custom] = await Promise.all([
    loadSchedules(auth.tenant_id),
    loadCustomHeads(auth.tenant_id, { activeOnly: true }).catch(() => []),
  ]);
  const types = [
    ...REPORT_TEMPLATES.filter((t) => schedulable(t)).map((t) => t.key),
    ...custom.filter((c) => c.cadence === "weekly" || c.cadence === "monthly").map((c) => c.key),
  ];
  return NextResponse.json({ schedules, types }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  if (!(await canSetUp(auth))) return forbidden();
  try { return await answer(auth); }
  catch (e) { console.error("[api/work-reports/schedules GET]", e instanceof Error ? e.message : e); return NextResponse.json({ error: "failed" }, { status: 500 }); }
}

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  if (!(await canSetUp(auth))) return forbidden();
  const body = (await req.json().catch(() => null)) as { accountId?: unknown; templateKey?: unknown; active?: unknown; remove?: unknown } | null;
  if (!body || !isUuid(body.accountId) || typeof body.templateKey !== "string" || !body.templateKey || body.templateKey.length > 64) {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  if (body.active !== undefined && typeof body.active !== "boolean") return NextResponse.json({ error: "bad_body" }, { status: 400 });
  /* Only the tenant's own people. */
  if (!(await ownerIds(auth)).has(body.accountId)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const done = await saveSchedule(auth, { accountId: body.accountId, templateKey: body.templateKey, active: body.active as boolean | undefined, remove: body.remove === true });
    if (done === "bad_type") return NextResponse.json({ error: "bad_type" }, { status: 400 });
    return await answer(auth);
  } catch (e) {
    console.error("[api/work-reports/schedules PUT]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
