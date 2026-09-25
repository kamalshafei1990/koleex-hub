import "server-only";

/* ---------------------------------------------------------------------------
   /api/work-reports — the Reports app's lists and new drafts.

   GET  ?box=inbox|mine|team &q &status &type &page &pageSize &sort
        inbox = sent to me · mine = written by me (latest versions) ·
        team  = my people's sent reports (a super admin: everyone's),
                never confidential ones.
        Server-side search/filter/sort/paging (the shared server-list
        contract); rows are slim — never `sections`.
   POST { template_key, date: "YYYY-MM-DD", title?, request?, lang? }
        A new draft, addressed to the template's default readers. A daily,
        weekly or monthly report that already exists for the same period is
        returned instead of a second one. With `request` (Phase 3D, one of
        the viewer's OWN open requests) the draft is that request's: its
        period_key is 'req:<id>', it starts with the event's facts worded in
        `lang`, and a second call returns the same report. A request-only
        type (the probation review) starts from its request or not at all.
        Phase 4E: a builder type (c-…) starts from its CURRENT version, and
        the draft keeps a copy of it (template_snapshot) — editing the type
        later never changes this report. An archived builder type, or a
        built-in the tenant hides, starts no new report.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, type ServerAuthContext } from "@/lib/server/auth";
import { applyServerList } from "@/lib/server-list/apply";
import { parseListParams, type ServerListConfig } from "@/lib/server-list/types";
import { REPORT_LIMITS, normalizeSections, periodFor, type ReportTemplateDef } from "@/lib/reports/templates";
import { REPORT_TEMPLATES, reportTemplate } from "@/lib/reports/catalog";
import { isCustomKey, snapshotOf, type TemplateSnapshot } from "@/lib/reports/custom-templates";
import { customAsTemplate, loadCustomTemplate, loadHiddenKeys } from "@/lib/server/reports/custom-templates";
import { prefillSections, requestPeriodKey, type RequestFacts } from "@/lib/reports/events";
import { reportsT } from "@/lib/translations/reports";
import {
  REPORT_LIST_COLS, canStartTemplate, defaultRecipients, isUuid, listPeople, loadOrgTree, requireReportsUser, superAdminIds,
} from "@/lib/server/reports/core";

export const dynamic = "force-dynamic";

const LIST_CFG: ServerListConfig = {
  defaultPageSize: 25,
  maxPageSize: 50,
  sortFields: { submitted: "submitted_at", updated: "updated_at" },
  defaultSort: { field: "submitted", dir: "desc" },
  searchColumns: ["search_text"],
  filters: {
    status: { column: "status", allowed: ["draft", "submitted", "approved", "returned"] },
    type: { column: "template_key", allowed: REPORT_TEMPLATES.map((t) => t.key) },
  },
  maxQueryLength: 80,
};

type ListRow = {
  id: string; template_key: string; author_account_id: string; title: string;
  period_start: string | null; period_end: string | null; period_key: string | null;
  status: string; confidential: boolean; review_required: boolean; version: number; superseded: boolean;
  submitted_at: string | null; updated_at: string; tpl_head?: unknown;
  work_report_recipients?: Array<{ role: string; read_at: string | null; acknowledged_at: string | null }>;
};

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;

  const url = new URL(req.url);
  const box = url.searchParams.get("box") ?? "inbox";
  const lr = parseListParams(url.searchParams, LIST_CFG);
  const me = auth.account_id;
  /* Started together; the list query only waits for the people when a name
     may be in the search box. */
  const peopleP = listPeople(auth.tenant_id);
  const treeP = box === "team" ? loadOrgTree(auth.tenant_id) : null;

  /* A name typed in the search box also finds that person's reports. */
  const extraOr: string[] = [];
  if (lr.q) {
    const q = lr.q.toLowerCase();
    const ids = (await peopleP).filter((p) => p.name.toLowerCase().includes(q) || (p.nameAlt ?? "").toLowerCase().includes(q)).map((p) => p.id);
    if (ids.length) extraOr.push(`author_account_id.in.(${ids.join(",")})`);
  }
  const reqQ = { ...lr, q: lr.q.toLowerCase() };

  let query;
  if (box === "mine") {
    query = supabaseServer.from("work_reports").select(REPORT_LIST_COLS, { count: "exact" })
      .eq("author_account_id", me).eq("superseded", false);
  } else if (box === "team") {
    const tree = await treeP!;
    const mine = tree.descendantsOf(me);
    const everyone = auth.is_super_admin;
    if (!everyone && mine.length === 0) {
      return NextResponse.json({ rows: [], page: 1, pageSize: lr.pageSize, total: 0, hasMore: false, q: lr.q, sort: lr.sort, dir: lr.dir });
    }
    query = supabaseServer.from("work_reports").select(REPORT_LIST_COLS, { count: "exact" })
      .neq("status", "draft").eq("confidential", false).eq("superseded", false).neq("author_account_id", me);
    if (!everyone) query = query.in("author_account_id", mine);
  } else {
    query = supabaseServer.from("work_reports")
      .select(`${REPORT_LIST_COLS}, work_report_recipients!inner(account_id, role, read_at, acknowledged_at)`, { count: "exact" })
      .eq("work_report_recipients.account_id", me).neq("status", "draft");
  }
  if (auth.tenant_id) query = query.eq("tenant_id", auth.tenant_id);
  const [{ data, error, count }, people] = await Promise.all([applyServerList(query, reqQ, LIST_CFG, extraOr), peopleP]);
  const nameOf = new Map(people.map((p) => [p.id, p]));
  if (error) {
    console.error("[api/work-reports GET]", error.message);
    return NextResponse.json({ error: "Could not load reports." }, { status: 500 });
  }
  const rows = ((data ?? []) as ListRow[]).map((r) => {
    const mineRow = r.work_report_recipients?.[0] ?? null;
    const author = nameOf.get(r.author_account_id);
    return {
      id: r.id, templateKey: r.template_key, title: r.title,
      authorId: r.author_account_id, authorName: author?.name ?? "—", authorNameAlt: author?.nameAlt ?? null,
      periodStart: r.period_start, periodEnd: r.period_end, periodKey: r.period_key,
      status: r.status, confidential: r.confidential, reviewRequired: r.review_required, version: r.version,
      submittedAt: r.submitted_at, updatedAt: r.updated_at,
      myRole: mineRow?.role ?? null, readAt: mineRow?.read_at ?? null, acknowledgedAt: mineRow?.acknowledged_at ?? null,
      ...(r.tpl_head ? { tpl: r.tpl_head } : {}),
    };
  });
  return NextResponse.json(
    { rows, page: lr.page, pageSize: lr.pageSize, total: count ?? null, hasMore: rows.length === lr.pageSize, q: lr.q, sort: lr.sort, dir: lr.dir },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as { template_key?: unknown; date?: unknown; title?: unknown; request?: unknown; lang?: unknown } | null;
  /* A builder type (4E): its current version, active only, the tenant's own. */
  let snapshot: TemplateSnapshot | null = null;
  let tpl: ReportTemplateDef | null = null;
  if (isCustomKey(body?.template_key)) {
    const row = await loadCustomTemplate(auth.tenant_id, body.template_key).catch(() => null);
    if (!row || row.status !== "active") return NextResponse.json({ error: "unknown_template" }, { status: 400 });
    tpl = customAsTemplate(row);
    snapshot = snapshotOf(row.def, row.words, row.version);
  } else if (typeof body?.template_key === "string") {
    tpl = reportTemplate(body.template_key);
  }
  if (!tpl) return NextResponse.json({ error: "unknown_template" }, { status: 400 });

  /* From a request (Phase 3D): only the viewer's own, open one, for this type. */
  if (body?.request !== undefined) {
    if (!isUuid(body.request)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    const { data: rq } = await supabaseServer.from("work_report_requests").select("id, template_key, event_day, prefill, status")
      .eq("id", body.request).eq("account_id", auth.account_id).maybeSingle();
    const r = rq as { id: string; template_key: string; event_day: string; prefill: RequestFacts; status: string } | null;
    if (!r || r.status !== "open" || r.template_key !== tpl.key) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const periodKey = requestPeriodKey(r.id);
    let dq = supabaseServer.from("work_reports").select("id").eq("author_account_id", auth.account_id)
      .eq("template_key", tpl.key).eq("period_key", periodKey).eq("superseded", false).order("version", { ascending: false }).limit(1);
    if (auth.tenant_id) dq = dq.eq("tenant_id", auth.tenant_id);
    const { data: existing } = await dq.maybeSingle();
    if (existing) return NextResponse.json({ id: (existing as { id: string }).id, existing: true });
    const lang = body.lang === "zh" || body.lang === "ar" ? body.lang : "en";
    const word = (key: string) => ((reportsT[key]?.[lang] ?? reportsT[key]?.en) as string | undefined) ?? "";
    const facts = prefillSections(r.prefill, word);
    const day = String(r.event_day).slice(0, 10);
    return createDraft(auth, tpl, { start: day, end: day, key: periodKey }, "", Object.entries(facts).map(([id, text]) => ({ id, text })));
  }

  if (tpl.requestOnly) return NextResponse.json({ error: "request_only" }, { status: 403 });
  const [allowed, hidden] = await Promise.all([
    canStartTemplate(tpl, auth),
    tpl.custom ? Promise.resolve([] as string[]) : loadHiddenKeys(auth.tenant_id).catch(() => [] as string[]),
  ]);
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (hidden.includes(tpl.key)) return NextResponse.json({ error: "hidden" }, { status: 403 });
  const date = typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : new Date().toISOString().slice(0, 10);
  const period = periodFor(tpl.cadence, date);

  /* One daily per day, one weekly per week, one monthly per month: the
     existing one (draft or sent) opens instead. */
  if (tpl.cadence) {
    let dq = supabaseServer.from("work_reports").select("id").eq("author_account_id", auth.account_id)
      .eq("template_key", tpl.key).eq("period_key", period.key).eq("superseded", false).order("version", { ascending: false }).limit(1);
    if (auth.tenant_id) dq = dq.eq("tenant_id", auth.tenant_id);
    const { data: existing } = await dq.maybeSingle();
    if (existing) return NextResponse.json({ id: (existing as { id: string }).id, existing: true });
  }

  const title = tpl.customTitle && typeof body?.title === "string" ? body.title.trim().slice(0, REPORT_LIMITS.title) : "";
  return createDraft(auth, tpl, { start: period.start, end: period.end, key: tpl.cadence ? period.key : period.start }, title, [], snapshot);
}

/** A new draft addressed to the template's default readers — a builder
 *  type's with its copy of the type (4E). */
async function createDraft(auth: ServerAuthContext, tpl: ReportTemplateDef, period: { start: string; end: string; key: string }, title: string, sections: unknown, snapshot: TemplateSnapshot | null = null) {
  const { data: created, error } = await supabaseServer.from("work_reports").insert({
    tenant_id: auth.tenant_id, template_key: tpl.key, author_account_id: auth.account_id, title,
    period_start: period.start, period_end: period.end, period_key: period.key,
    sections: normalizeSections(tpl, sections), status: "draft",
    confidential: tpl.confidential, review_required: tpl.reviewRequired,
    template_snapshot: snapshot,
  }).select("id").single();
  if (error || !created) {
    console.error("[api/work-reports POST]", error?.message);
    return NextResponse.json({ error: "Could not create the report." }, { status: 500 });
  }
  const id = (created as { id: string }).id;
  const to = await defaultRecipients(tpl, auth).catch(async () => (await superAdminIds(auth.tenant_id)).filter((x) => x !== auth.account_id));
  if (to.length) {
    const { error: rErr } = await supabaseServer.from("work_report_recipients")
      .insert(to.slice(0, REPORT_LIMITS.recipients).map((account_id) => ({ report_id: id, account_id, role: "to" })));
    if (rErr) console.error("[api/work-reports POST] recipients:", rErr.message);
  }
  return NextResponse.json({ id, existing: false }, { status: 201 });
}
