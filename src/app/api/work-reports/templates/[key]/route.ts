import "server-only";

/* ---------------------------------------------------------------------------
   /api/work-reports/templates/[key] — one type in the builder (Phase 4E).
   Super admins, or "Report Templates" in Roles (each action its own right).

   A builder type (c-…):
     GET     the type whole: { key, def, words, status, version }
     PATCH   { def, words, version } — the type changes; its version goes up.
             Reports already started keep the version they were started
             with (their snapshot). `version` is the one the editor opened:
             someone else's save in between answers 409 "changed" instead of
             being overwritten. The built-in a copy came from never changes.
             { status: "archived" | "active" } — no new reports / offered
             again; the old reports stay either way.
     DELETE  only while no report uses it (409 "in_use" — archive it).
   A built-in type:
     GET     the starting point of a copy: { key: null, def, words } (every
             word it has, the same section ids).
     PATCH   { hidden: true | false } — no longer offered / offered again.
             The daily, weekly and monthly (the compliance board's) and the
             types only events ask for cannot be hidden.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { requireReportsUser } from "@/lib/server/reports/core";
import { loadCustomTemplate, templateRights } from "@/lib/server/reports/custom-templates";
import { checkTemplate, copyOfBuiltin, copyableBuiltin, hideableBuiltin, isCustomKey } from "@/lib/reports/custom-templates";
import { reportsT } from "@/lib/translations/reports";
import { REPORT_SECTION_WORDS } from "@/lib/translations/report-sections/all";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ key: string }> };
const forbidden = () => NextResponse.json({ error: "forbidden" }, { status: 403 });
const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });
const failed = (what: string, e: unknown) => {
  console.error(`[reports.templates] ${what}:`, e instanceof Error ? e.message : e);
  return NextResponse.json({ error: "Could not save the template." }, { status: 500 });
};

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const { key } = await params;
  const [can, row] = await Promise.all([
    templateRights(auth),
    isCustomKey(key) ? loadCustomTemplate(auth.tenant_id, key).catch(() => undefined) : Promise.resolve(null),
  ]);
  if (!can.view) return forbidden();
  if (isCustomKey(key)) {
    if (row === undefined) return NextResponse.json({ error: "Could not load the template." }, { status: 500 });
    if (!row) return notFound();
    return NextResponse.json({ key: row.key, def: row.def, words: row.words, status: row.status, version: row.version }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const copy = copyableBuiltin(key) ? copyOfBuiltin(key, { ...reportsT, ...REPORT_SECTION_WORDS }) : null;
  if (!copy) return notFound();
  return NextResponse.json({ key: null, def: copy.def, words: copy.words }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const { key } = await params;
  const body = (await req.json().catch(() => null)) as { def?: unknown; words?: unknown; version?: unknown; status?: unknown; hidden?: unknown } | null;
  if (!body) return NextResponse.json({ error: "bad_body" }, { status: 400 });
  if (!(await templateRights(auth)).edit) return forbidden();
  const now = new Date().toISOString();

  /* A built-in: hidden or offered again. */
  if (!isCustomKey(key)) {
    if (typeof body.hidden !== "boolean") return NextResponse.json({ error: "bad_body" }, { status: 400 });
    if (!hideableBuiltin(key)) return NextResponse.json({ error: "not_hideable" }, { status: 400 });
    let q = supabaseServer.from("work_report_hidden_templates").select("id").eq("template_key", key);
    q = auth.tenant_id ? q.eq("tenant_id", auth.tenant_id) : q.is("tenant_id", null);
    const { data: had, error: rErr } = await q.limit(1);
    if (rErr) return failed("hidden read", rErr);
    if (body.hidden && !(had ?? []).length) {
      const { error } = await supabaseServer.from("work_report_hidden_templates").insert({ tenant_id: auth.tenant_id, template_key: key, hidden_by: auth.account_id, hidden_at: now });
      if (error && error.code !== "23505") return failed("hide", error);
    } else if (!body.hidden && (had ?? []).length) {
      let d = supabaseServer.from("work_report_hidden_templates").delete().eq("template_key", key);
      d = auth.tenant_id ? d.eq("tenant_id", auth.tenant_id) : d.is("tenant_id", null);
      const { error } = await d;
      if (error) return failed("show", error);
    }
    return NextResponse.json({ ok: true, hidden: body.hidden });
  }

  let current;
  try { current = await loadCustomTemplate(auth.tenant_id, key); } catch (e) { return failed("read", e); }
  if (!current) return notFound();

  /* Archived or offered again — nothing else changes. */
  if (body.status !== undefined) {
    if (body.status !== "archived" && body.status !== "active") return NextResponse.json({ error: "bad_body" }, { status: 400 });
    const { error } = await supabaseServer.from("work_report_templates").update({ status: body.status, updated_by: auth.account_id, updated_at: now }).eq("key", key);
    if (error) return failed("status", error);
    return NextResponse.json({ ok: true, status: body.status });
  }

  if (body.version !== current.version) return NextResponse.json({ error: "changed", version: current.version }, { status: 409 });
  /* The built-in a copy came from is part of what it IS — never changed here. */
  const raw = { ...(body.def && typeof body.def === "object" ? body.def as Record<string, unknown> : {}), base: current.def.base };
  const { def, words, problems } = checkTemplate(raw, body.words);
  if (problems.length) return NextResponse.json({ error: "invalid", problems }, { status: 400 });
  const next = current.version + 1;
  const { data: saved, error } = await supabaseServer.from("work_report_templates")
    .update({ def, words, version: next, updated_by: auth.account_id, updated_at: now })
    .eq("key", key).eq("version", current.version).select("key").maybeSingle();
  if (error) return failed("edit", error);
  if (!saved) return NextResponse.json({ error: "changed" }, { status: 409 });
  return NextResponse.json({ ok: true, version: next });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const { key } = await params;
  if (!isCustomKey(key)) return NextResponse.json({ error: "not_custom" }, { status: 400 });
  if (!(await templateRights(auth)).delete) return forbidden();
  let current;
  try { current = await loadCustomTemplate(auth.tenant_id, key); } catch (e) { return failed("read", e); }
  if (!current) return notFound();
  /* A type a report was written in stays: it is archived, never deleted. */
  const { data: used, error: uErr } = await supabaseServer.from("work_reports").select("id").eq("template_key", key).limit(1);
  if (uErr) return failed("usage", uErr);
  if ((used ?? []).length) return NextResponse.json({ error: "in_use" }, { status: 409 });
  const { error } = await supabaseServer.from("work_report_templates").delete().eq("key", key);
  if (error) return failed("delete", error);
  return NextResponse.json({ ok: true });
}
