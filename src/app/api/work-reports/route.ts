import "server-only";

/* ---------------------------------------------------------------------------
   /api/work-reports — the Reports app's lists and new drafts.

   GET  ?box=inbox|mine|team &q &status &type &page &pageSize &sort
        inbox = sent to me · mine = written by me (latest versions) ·
        team  = my people's sent reports (a super admin: everyone's),
                never confidential ones.
        Server-side search/filter/sort/paging (the shared server-list
        contract); rows are slim — never `sections`.
   POST { template_key, date: "YYYY-MM-DD", title? }
        A new draft, addressed to the template's default readers. A daily,
        weekly or monthly report that already exists for the same period is
        returned instead of a second one.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { applyServerList } from "@/lib/server-list/apply";
import { parseListParams, type ServerListConfig } from "@/lib/server-list/types";
import { REPORT_TEMPLATES, REPORT_LIMITS, normalizeSections, periodFor, reportTemplate } from "@/lib/reports/templates";
import {
  REPORT_LIST_COLS, canStartTemplate, defaultRecipients, listPeople, loadOrgTree, requireReportsUser, superAdminIds,
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
  submitted_at: string | null; updated_at: string;
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

  const body = (await req.json().catch(() => null)) as { template_key?: unknown; date?: unknown; title?: unknown } | null;
  const tpl = typeof body?.template_key === "string" ? reportTemplate(body.template_key) : null;
  if (!tpl) return NextResponse.json({ error: "unknown_template" }, { status: 400 });
  if (!(await canStartTemplate(tpl, auth))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
  const { data: created, error } = await supabaseServer.from("work_reports").insert({
    tenant_id: auth.tenant_id, template_key: tpl.key, author_account_id: auth.account_id, title,
    period_start: period.start, period_end: period.end, period_key: tpl.cadence ? period.key : period.start,
    sections: normalizeSections(tpl, []), status: "draft",
    confidential: tpl.confidential, review_required: tpl.reviewRequired,
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
