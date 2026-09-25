import "server-only";

/* ---------------------------------------------------------------------------
   /api/work-reports/[id]

   GET    The report, its recipients (with read / acknowledged), its thread
          and what THIS viewer may do with it. Opening it as a recipient marks
          it read and clears the reader's own notification. The author's
          draft also carries the suggestions from their earlier reports
          (yesterday's plan, the week's dailies…) and their own work in the
          apps around the period (appFeed) and its numbers blocks as the
          server computes them now (blockData, Phase 4B), so the composer
          paints complete — no second request, nothing shifting in later. Photos
          and files come as ids only; their bytes are fetched through
          /api/files/report/<id>, which applies this same read rule.
          A report of a builder type (4E) also brings its type as it was
          started with — the sections and their words (`template`).
   PATCH  The author edits a DRAFT: { title?, date?, dateTo?, sections?, to?,
          cc?, confidential? } — dateTo only for a trip or a visit (4D). A sent report is never edited — a new version is
          (POST …/revise).
   DELETE The author deletes a DRAFT (its stored files go too, unless an
          earlier version still shows them).
   A report the viewer may not read answers 404, never 403, so a stranger
   cannot learn that it exists.
   --------------------------------------------------------------------------- */

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { REPORT_LIMITS, normalizeSections, periodFor, rangeEnd, reportLinks, type ReportSectionValue } from "@/lib/reports/templates";
import { readSnapshot, templateOf, templateWords } from "@/lib/reports/custom-templates";
import { syncReportLinks } from "@/lib/server/reports/links";
import { isUuid, listPeople, loadForViewer, requireReportsUser } from "@/lib/server/reports/core";
import { clearMyReportNotifications } from "@/lib/server/reports/notify";
import { loadCarry } from "@/lib/server/reports/carry";
import { loadAppFeed } from "@/lib/server/reports/app-feed";
import { loadReportData } from "@/lib/server/reports/report-data";
import { loadAttachmentRows, removeUnreferenced, toClientAttachment, type AttachmentRow } from "@/lib/server/reports/attachments";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };
const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  /* ONE wave: the thread and the newer version are read beside the report
     and thrown away unread if this viewer may not see it — nothing leaves
     before the access check below. */
  const [loaded, people, commentsRes, newerRes, attachmentsRes] = await Promise.all([
    loadForViewer(id, auth),
    listPeople(auth.tenant_id),
    supabaseServer.from("work_report_comments").select("id, account_id, body, kind, created_at").eq("report_id", id).order("created_at", { ascending: true }).limit(500),
    supabaseServer.from("work_reports").select("id").eq("previous_id", id).order("version", { ascending: false }).limit(1).maybeSingle(),
    loadAttachmentRows(id),
  ]);
  if (!loaded) return notFound();
  const { row, recipients, access } = loaded;
  const me = auth.account_id;
  const mine = recipients.find((r) => r.account_id === me) ?? null;

  /* Opening it as a recipient marks it read and clears the bell — after the
     response, so the reader never waits on the bookkeeping. */
  if (mine && !mine.read_at && row.status !== "draft") {
    const now = new Date().toISOString();
    mine.read_at = now;
    after(async () => {
      await supabaseServer.from("work_report_recipients").update({ read_at: now }).eq("report_id", row.id).eq("account_id", me).is("read_at", null);
      await clearMyReportNotifications(row.id, me);
    });
  }
  const nameOf = new Map(people.map((p) => [p.id, p]));
  const person = (id: string) => ({ id, name: nameOf.get(id)?.name ?? "—", nameAlt: nameOf.get(id)?.nameAlt ?? null, avatar: nameOf.get(id)?.avatar ?? null });
  const isAuthor = access === "author";
  const isTo = mine?.role === "to";
  const open = row.status === "submitted";
  /* One more wave, and only for the author's own draft — the only screen
     that shows them. */
  const [carry, appFeed, blockData] = isAuthor && row.status === "draft"
    ? await Promise.all([loadCarry(row, auth), loadAppFeed(row, auth), loadReportData(row, auth)])
    : [undefined, undefined, undefined];
  /* A builder type (4E): the version this report was started with. */
  const snap = row.template_snapshot ? readSnapshot(row.template_snapshot) : null;
  const custom = snap ? templateOf(row) : null;

  return NextResponse.json({
    report: {
      id: row.id, templateKey: row.template_key, title: row.title, author: person(row.author_account_id),
      periodStart: row.period_start, periodEnd: row.period_end, periodKey: row.period_key,
      sections: row.sections, status: row.status, confidential: row.confidential, reviewRequired: row.review_required,
      version: row.version, previousId: row.previous_id, superseded: row.superseded,
      newerId: row.superseded ? ((newerRes.data as { id?: string } | null)?.id ?? null) : null,
      submittedAt: row.submitted_at, decidedAt: row.decided_at, decidedBy: row.decided_by ? person(row.decided_by) : null,
      createdAt: row.created_at, updatedAt: row.updated_at,
    },
    recipients: recipients.map((r) => ({ ...person(r.account_id), role: r.role, readAt: r.read_at, acknowledgedAt: r.acknowledged_at })),
    comments: ((commentsRes.data ?? []) as Array<{ id: string; account_id: string; body: string; kind: string; created_at: string }>)
      .map((c) => ({ id: c.id, author: person(c.account_id), body: c.body, kind: c.kind, createdAt: c.created_at })),
    access,
    can: {
      edit: isAuthor && row.status === "draft",
      remove: isAuthor && row.status === "draft",
      revise: isAuthor && row.status !== "draft" && !row.superseded,
      decide: !isAuthor && isTo && row.review_required && open && !row.superseded,
      acknowledge: !isAuthor && !!mine && !mine.acknowledged_at && row.status !== "draft",
      comment: row.status !== "draft",
    },
    people: row.status === "draft" && isAuthor ? people.filter((p) => p.id !== me) : undefined,
    carry,
    appFeed,
    blockData,
    attachments: ((attachmentsRes.data ?? []) as AttachmentRow[]).map(toClientAttachment),
    template: custom && snap ? { def: custom, words: templateWords(row.template_key, snap.words) } : undefined,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const { id } = await params;
  const loaded = await loadForViewer(id, auth);
  if (!loaded || loaded.access !== "author") return notFound();
  const { row } = loaded;
  if (row.status !== "draft") return NextResponse.json({ error: "not_draft" }, { status: 409 });
  const tpl = templateOf(row);
  if (!tpl) return NextResponse.json({ error: "unknown_template" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as {
    title?: unknown; date?: unknown; dateTo?: unknown; sections?: unknown; to?: unknown; cc?: unknown; confidential?: unknown;
  } | null;
  if (!body) return NextResponse.json({ error: "bad_body" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string" && tpl.customTitle) patch.title = body.title.trim().slice(0, REPORT_LIMITS.title);
  if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    const p = periodFor(tpl.cadence, body.date);
    patch.period_start = p.start; patch.period_end = p.end; patch.period_key = tpl.cadence ? p.key : p.start;
  }
  /* A trip or a visit (4D) spans the days its author picks — never before
     its first day, at most REPORT_LIMITS.rangeDays long. */
  if (tpl.range && typeof body.dateTo === "string") {
    const start = (patch.period_start as string | undefined) ?? row.period_start;
    if (start) patch.period_end = rangeEnd(start, body.dateTo);
  }
  if (body.sections !== undefined) patch.sections = normalizeSections(tpl, body.sections);
  /* A confidential type stays confidential; any other may be raised. */
  if (typeof body.confidential === "boolean") patch.confidential = tpl.confidential ? true : body.confidential;

  /* The composer sends To / Copy with every autosave; the rows are only
     rewritten when the list actually changed. */
  if (Array.isArray(body.to) || Array.isArray(body.cc)) {
    const ids = (v: unknown) => Array.from(new Set((Array.isArray(v) ? v : []).filter(isUuid))) as string[];
    let to = ids(body.to);
    let cc = ids(body.cc).filter((x) => !to.includes(x));
    const current = loaded.recipients;
    const same = current.length === to.length + cc.length
      && current.every((c) => (c.role === "to" ? to : cc).includes(c.account_id));
    if (!same) {
      const valid = new Set((await listPeople(auth.tenant_id)).map((p) => p.id));
      valid.delete(auth.account_id);
      to = to.filter((x) => valid.has(x));
      cc = cc.filter((x) => valid.has(x));
      if (to.length + cc.length > REPORT_LIMITS.recipients) return NextResponse.json({ error: "too_many_recipients" }, { status: 400 });
      const { error: dErr } = await supabaseServer.from("work_report_recipients").delete().eq("report_id", row.id);
      if (dErr) return NextResponse.json({ error: "Could not save recipients." }, { status: 500 });
      const rows = [...to.map((a) => ({ report_id: row.id, account_id: a, role: "to" })), ...cc.map((a) => ({ report_id: row.id, account_id: a, role: "cc" }))];
      if (rows.length) {
        const { error: iErr } = await supabaseServer.from("work_report_recipients").insert(rows);
        if (iErr) return NextResponse.json({ error: "Could not save recipients." }, { status: 500 });
      }
    }
  }

  const { error } = await supabaseServer.from("work_reports").update(patch).eq("id", row.id).eq("status", "draft");
  if (error) {
    console.error("[api/work-reports PATCH]", error.message);
    return NextResponse.json({ error: "Could not save the draft." }, { status: 500 });
  }
  /* The records it is about (Phase 4A) — rewritten only when they changed. */
  if (patch.sections) await syncReportLinks(row.id, auth.tenant_id, reportLinks(row.sections), reportLinks(patch.sections as ReportSectionValue[]));
  return NextResponse.json({ ok: true, savedAt: patch.updated_at });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const { id } = await params;
  const loaded = await loadForViewer(id, auth);
  if (!loaded || loaded.access !== "author") return notFound();
  if (loaded.row.status !== "draft") return NextResponse.json({ error: "not_draft" }, { status: 409 });
  /* Its files' paths first — the rows go with the report (cascade). */
  const { data: files } = await supabaseServer.from("work_report_attachments").select("storage_path, thumb_path").eq("report_id", loaded.row.id);
  const { error } = await supabaseServer.from("work_reports").delete().eq("id", loaded.row.id).eq("status", "draft");
  if (error) {
    console.error("[api/work-reports DELETE]", error.message);
    return NextResponse.json({ error: "Could not delete the draft." }, { status: 500 });
  }
  const paths = ((files ?? []) as { storage_path: string; thumb_path: string | null }[]).flatMap((f) => [f.storage_path, f.thumb_path]);
  if (paths.length) after(() => removeUnreferenced(paths));
  return NextResponse.json({ ok: true });
}
