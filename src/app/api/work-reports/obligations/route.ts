import "server-only";

/* ---------------------------------------------------------------------------
   /api/work-reports/obligations — who must write which report (Phase 3A).
   Super admin or HR·edit only.

   GET  every person who can owe a report, the owner's default for them
        (everyone daily + weekly, monthly for managers, super admins exempt)
        and their exceptions; plus when tracking starts.
   PUT  { trackingFrom?: "YYYY-MM-DD" | null,
          exceptions?: [{ accountId, key: "daily"|"weekly"|"monthly",
                          required: true | false | null }] }
        null = back to the default (the exception row is deleted). Only the
        tenant's own people can carry an exception.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { isUuid, requireReportsUser } from "@/lib/server/reports/core";
import { canSetUp, loadSetup, ownerIds } from "@/lib/server/reports/obligations";
import { OBLIGATION_KEYS, type ObligationKey } from "@/lib/reports/obligations";

export const dynamic = "force-dynamic";

const forbidden = () => NextResponse.json({ error: "forbidden" }, { status: 403 });

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  if (!(await canSetUp(auth))) return forbidden();
  return NextResponse.json(await loadSetup(auth), { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  if (!(await canSetUp(auth))) return forbidden();
  const body = (await req.json().catch(() => null)) as { trackingFrom?: unknown; exceptions?: unknown } | null;
  if (!body) return NextResponse.json({ error: "bad_body" }, { status: 400 });

  if (body.trackingFrom !== undefined) {
    if (!auth.tenant_id) return NextResponse.json({ error: "no_tenant" }, { status: 400 });
    const v = body.trackingFrom;
    if (v !== null && (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v))) return NextResponse.json({ error: "bad_date" }, { status: 400 });
    const { error } = await supabaseServer.from("work_report_settings")
      .upsert({ tenant_id: auth.tenant_id, tracking_from: v, updated_by: auth.account_id, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" });
    if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }

  if (body.exceptions !== undefined) {
    if (!Array.isArray(body.exceptions) || body.exceptions.length > 500) return NextResponse.json({ error: "bad_body" }, { status: 400 });
    const allowed = await ownerIds(auth);
    for (const raw of body.exceptions as Array<{ accountId?: unknown; key?: unknown; required?: unknown }>) {
      const key = raw?.key as ObligationKey;
      if (!isUuid(raw?.accountId) || !allowed.has(raw.accountId) || !OBLIGATION_KEYS.includes(key)) return NextResponse.json({ error: "bad_person" }, { status: 400 });
      if (raw.required !== null && typeof raw.required !== "boolean") return NextResponse.json({ error: "bad_body" }, { status: 400 });
    }
    for (const raw of body.exceptions as Array<{ accountId: string; key: ObligationKey; required: boolean | null }>) {
      const res = raw.required === null
        ? await supabaseServer.from("work_report_obligations").delete().eq("account_id", raw.accountId).eq("template_key", raw.key)
        : await supabaseServer.from("work_report_obligations").upsert({
          tenant_id: auth.tenant_id, account_id: raw.accountId, template_key: raw.key, required: raw.required,
          updated_by: auth.account_id, updated_at: new Date().toISOString(),
        }, { onConflict: "account_id,template_key" });
      if (res.error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
    }
  }
  return NextResponse.json(await loadSetup(auth), { headers: { "Cache-Control": "private, no-store" } });
}
