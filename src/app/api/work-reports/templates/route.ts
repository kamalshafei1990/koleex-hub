import "server-only";

/* ---------------------------------------------------------------------------
   /api/work-reports/templates — the template builder (Phase 4E).
   Super admins, or "Report Templates" in Roles (each action its own right).

   GET   the tenant's builder types (active and archived, named), the
         built-in types it hides, and what THIS person may do:
         { custom: CustomTemplateHead[], hidden: string[], can: TemplateRights }
   POST  { def, words } — a new type (from nothing, or a copy: def.base names
         the built-in it started from). Checked by the same rules the
         builder shows (checkTemplate); refused with the list of what is
         still wrong. → { key }
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { requireReportsUser } from "@/lib/server/reports/core";
import { loadCustomHeads, loadHiddenKeys, newTemplateKey, templateRights } from "@/lib/server/reports/custom-templates";
import { BUILDER_LIMITS, checkTemplate } from "@/lib/reports/custom-templates";

export const dynamic = "force-dynamic";

const forbidden = () => NextResponse.json({ error: "forbidden" }, { status: 403 });

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const [can, custom, hidden] = await Promise.all([
    templateRights(auth),
    loadCustomHeads(auth.tenant_id).catch((e: unknown) => { console.error("[reports.templates] list:", e instanceof Error ? e.message : e); return null; }),
    loadHiddenKeys(auth.tenant_id).catch((e: unknown) => { console.error("[reports.templates] hidden:", e instanceof Error ? e.message : e); return null; }),
  ]);
  if (!can.view) return forbidden();
  if (!custom || !hidden) return NextResponse.json({ error: "Could not load the templates." }, { status: 500 });
  return NextResponse.json({ custom, hidden, can }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  if (!(await templateRights(auth)).create) return forbidden();

  const body = (await req.json().catch(() => null)) as { def?: unknown; words?: unknown } | null;
  if (!body) return NextResponse.json({ error: "bad_body" }, { status: 400 });
  const { def, words, problems } = checkTemplate(body.def, body.words);
  if (problems.length) return NextResponse.json({ error: "invalid", problems }, { status: 400 });

  let cq = supabaseServer.from("work_report_templates").select("id", { count: "exact", head: true });
  if (auth.tenant_id) cq = cq.eq("tenant_id", auth.tenant_id);
  const { count, error: cErr } = await cq;
  if (cErr) return NextResponse.json({ error: "Could not save the template." }, { status: 500 });
  if ((count ?? 0) >= BUILDER_LIMITS.perTenant) return NextResponse.json({ error: "too_many" }, { status: 400 });

  /* A clash of two random keys is next to impossible; a second try settles it. */
  for (let attempt = 0; attempt < 3; attempt++) {
    const key = newTemplateKey();
    const { error } = await supabaseServer.from("work_report_templates").insert({
      tenant_id: auth.tenant_id, key, def, words, status: "active", version: 1,
      created_by: auth.account_id, updated_by: auth.account_id,
    });
    if (!error) return NextResponse.json({ key }, { status: 201 });
    if (error.code !== "23505") {
      console.error("[reports.templates] create:", error.message);
      return NextResponse.json({ error: "Could not save the template." }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "Could not save the template." }, { status: 500 });
}
