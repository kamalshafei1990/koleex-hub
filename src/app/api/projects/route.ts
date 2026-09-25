import "server-only";

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { assertProjectAccess, involvedProjectsOr, memberProjectIds, orLikeTerm, UUID_RE } from "@/lib/server/project-access";
import { isMissingColumn, validateProjectFields, withoutPendingColumns } from "@/lib/server/project-validate";
import { upsertProjectMembers } from "@/lib/server/project-members";

/* GET  /api/projects — list projects (tenant-scoped).
     Query:
       status=active|on_hold|completed|archived|all   default: active
       customer_id=<uuid>   only projects linked to this customer
       search=<text>        ilike over name/code
       templates=1          template gallery only
       involves=<uuid>      SUPER ADMIN lens: projects that account is
                            involved in (manager / creator / task assignee)
     Response:
       projects[]  each with task_counts { open, overdue, done, total }
                   (done/total = top-level non-cancelled, the progress
                   rule in src/lib/project-progress.ts) and `involved`
                   (the CALLER manages / created / holds a task in it)
       counts      { active, on_hold, completed, archived, all } for the
                   filter chips — same scope + search, every status.

     ⚠️ The bare URL `/api/projects` is what Home prefetches on hover
     (src/app/page.tsx APP_DATA_PREFETCH). The app's first request for the
     default view is that exact URL, fetched cache-able, so the short
     max-age below lets it reuse the warm entry.

   POST /api/projects — create + seed 4 default stages, or copy the stage
   pipeline (+ task checklist unless copy_tasks=false) of template_id. */

type Counts = { open: number; overdue: number; done: number; total: number };
const ZERO: Counts = { open: 0, overdue: 0, done: 0, total: 0 };

/** Per-project task counts in ONE query: the project_task_counts RPC
 *  (supabase/migrations/20260925_projects_audit.sql). Until that migration
 *  is applied, falls back to one narrow select aggregated here. */
async function taskCounts(tenantId: string, projectIds: string[]): Promise<Map<string, Counts>> {
  const out = new Map<string, Counts>();
  if (projectIds.length === 0) return out;
  const { data, error } = await supabaseServer.rpc("project_task_counts", {
    p_tenant: tenantId,
    p_project_ids: projectIds,
  });
  if (!error && Array.isArray(data)) {
    for (const r of data as { project_id: string; open_count: number; overdue_count: number; done_top: number; total_top: number }[]) {
      out.set(r.project_id, { open: r.open_count, overdue: r.overdue_count, done: r.done_top, total: r.total_top });
    }
    return out;
  }
  const today = new Date().toISOString().slice(0, 10);
  const { data: rows } = await supabaseServer
    .from("project_tasks")
    .select("project_id, status, parent_task_id, due_date")
    .eq("tenant_id", tenantId)
    .in("project_id", projectIds)
    .limit(20000);
  for (const r of (rows ?? []) as { project_id: string; status: string; parent_task_id: string | null; due_date: string | null }[]) {
    const c = out.get(r.project_id) ?? { ...ZERO };
    if (r.status === "open") {
      c.open += 1;
      if (r.due_date && r.due_date < today) c.overdue += 1;
    }
    if (!r.parent_task_id && r.status !== "cancelled") {
      c.total += 1;
      if (r.status === "done") c.done += 1;
    }
    out.set(r.project_id, c);
  }
  return out;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "active";
  const customerId = url.searchParams.get("customer_id");
  const search = url.searchParams.get("search")?.trim();
  const involvesParam = url.searchParams.get("involves");
  // templates=1 → template gallery only; otherwise templates never mix
  // into the regular project lists.
  const templatesOnly = url.searchParams.get("templates") === "1";
  if (customerId && !UUID_RE.test(customerId)) return NextResponse.json({ projects: [], counts: {} });

  /* Scope: non-SA callers see only projects they're involved in —
     manager, creator, project member, or holding at least one task
     assigned to them.
     Templates stay org-wide (reusable blueprints, not work items).
     A super admin may narrow to another account's involvement (lens). */
  let scopeOr: string | null = null;
  if (!templatesOnly) {
    if (!auth.is_super_admin) scopeOr = await involvedProjectsOr(auth.tenant_id, auth.account_id);
    else if (involvesParam && UUID_RE.test(involvesParam)) scopeOr = await involvedProjectsOr(auth.tenant_id, involvesParam);
  }

  /* Same filters for the list and the status tally. Loosely typed on
     purpose: the builder's generics explode (TS2589) through a helper. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Builder = any;
  const scoped = (q: Builder): Builder => {
    let x = q.eq("tenant_id", auth.tenant_id).eq("is_template", templatesOnly);
    if (scopeOr) x = x.or(scopeOr);
    if (customerId) x = x.eq("customer_id", customerId);
    if (search) {
      const term = orLikeTerm(search);
      x = x.or(`name.ilike.${term},code.ilike.${term}`);
    }
    return x;
  };

  /* archived_at / currency come from 20260926_projects_additions.sql; the
     list retries without them until it is applied. */
  const listQuery = (withPending: boolean): Builder => {
    let q = scoped(
      supabaseServer.from("projects").select(
        `id, tenant_id, name, code, description, color, icon, status,
         is_billable, is_template, is_favorite,
         customer_id, manager_account_id, created_by_account_id,
         planned_start, planned_end, budget_hours, budget_amount, billing_rate, progress_pct,
         ${withPending ? "archived_at, currency," : ""}
         sort_order, created_at, updated_at,
         customer:customer_id ( id, display_name, company_name ),
         manager:manager_account_id ( id, username )`,
      ),
    );
    if (!templatesOnly && status !== "all") q = q.eq("status", status);
    return q
      .order("is_favorite", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
  };

  const [firstRes, statusRes] = await Promise.all([
    listQuery(true),
    templatesOnly ? Promise.resolve({ data: [], error: null }) : scoped(supabaseServer.from("projects").select("status")),
  ]);
  const listRes = firstRes.error && isMissingColumn(firstRes.error) ? await listQuery(false) : firstRes;
  if (listRes.error) {
    console.error("[api/projects GET]", listRes.error.message);
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }
  const projects = (listRes.data ?? []) as unknown as Array<Record<string, unknown> & { id: string; manager_account_id: string | null; created_by_account_id: string | null }>;

  const counts = { active: 0, on_hold: 0, completed: 0, archived: 0, all: 0 };
  for (const r of (statusRes.data ?? []) as { status: keyof typeof counts }[]) {
    if (r.status in counts) counts[r.status] += 1;
    counts.all += 1;
  }

  const ids = projects.map((p) => p.id);
  const [tc, mine] = await Promise.all([
    templatesOnly ? Promise.resolve(new Map<string, Counts>()) : taskCounts(auth.tenant_id, ids),
    /* `involved` for the SA "My view" lens — for everyone else the scope
       already guarantees it. */
    auth.is_super_admin && !templatesOnly && ids.length > 0
      ? Promise.all([
          supabaseServer
            .from("project_tasks")
            .select("project_id")
            .eq("tenant_id", auth.tenant_id)
            .eq("assignee_account_id", auth.account_id)
            .in("project_id", ids),
          memberProjectIds(auth.tenant_id, auth.account_id),
        ]).then(([r, m]) => new Set([...(r.data ?? []).map((x) => (x as { project_id: string }).project_id), ...m]))
      : Promise.resolve(null),
  ]);

  const out = projects.map((p) => ({
    ...p,
    task_counts: tc.get(p.id) ?? ZERO,
    involved: mine
      ? p.manager_account_id === auth.account_id || p.created_by_account_id === auth.account_id || mine.has(p.id)
      : true,
  }));

  return NextResponse.json({ projects: out, counts }, {
    headers: { "Cache-Control": "private, max-age=15" },
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const checked = await validateProjectFields(auth.tenant_id, body, [
    "name", "code", "description", "color", "icon", "status", "customer_id", "manager_account_id",
    "is_billable", "planned_start", "planned_end", "budget_hours", "budget_amount", "billing_rate", "currency", "is_template",
  ]);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  const f = checked.patch;

  /* The source to copy from must be a template in this tenant, or a
     project the caller can see (Duplicate). */
  const templateId = typeof body.template_id === "string" && UUID_RE.test(body.template_id) ? body.template_id : null;
  if (templateId) {
    const { data: src } = await supabaseServer
      .from("projects").select("id, is_template").eq("id", templateId).eq("tenant_id", auth.tenant_id).maybeSingle();
    if (!src) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    if (!src.is_template) {
      const gate = await assertProjectAccess(auth, templateId);
      if (gate instanceof NextResponse) return gate;
    }
  }

  const row: Record<string, unknown> = {
    tenant_id: auth.tenant_id,
    name: f.name,
    code: f.code ?? null,
    description: f.description ?? null,
    color: f.color ?? "#567FB2",
    icon: f.icon ?? null,
    status: f.status ?? "active",
    customer_id: f.customer_id ?? null,
    manager_account_id: "manager_account_id" in f ? f.manager_account_id ?? auth.account_id : auth.account_id,
    is_billable: f.is_billable ?? false,
    planned_start: f.planned_start ?? null,
    planned_end: f.planned_end ?? null,
    budget_hours: f.budget_hours ?? null,
    budget_amount: f.budget_amount ?? null,
    billing_rate: f.billing_rate ?? null,
    is_template: f.is_template ?? false,
    created_by_account_id: auth.account_id,
    ...(f.currency ? { currency: f.currency } : {}),
  };
  let ins = await supabaseServer.from("projects").insert(row).select("*").single();
  if (ins.error && isMissingColumn(ins.error)) {
    ins = await supabaseServer.from("projects").insert(withoutPendingColumns(row)).select("*").single();
  }
  const { data: project, error } = ins;

  if (error || !project) {
    console.error("[api/projects POST]", error?.message);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }

  if (templateId) {
    // Start from template / duplicate: copy the stage pipeline and (unless
    // copy_tasks=false) the task checklist — fresh, unassigned, undated.
    await copyFromTemplate(auth.tenant_id, templateId, project.id, body.copy_tasks !== false);
  } else {
    await seedDefaultStages(auth.tenant_id, project.id);
  }

  /* The manager starts as a member (role manager) so the Members panel and
     the project chat include them from day one. */
  const managerId = (project as { manager_account_id: string | null }).manager_account_id;
  if (managerId && !project.is_template) {
    after(async () => { await upsertProjectMembers(auth, project.id, [{ account_id: managerId, role: "manager" }]); });
  }

  return NextResponse.json({ project });
}

async function seedDefaultStages(tenantId: string, projectId: string): Promise<void> {
  const defaults = [
    { name: "To Do",       color: "#94a3b8", sort: 0, closed: false, default_new: true  },
    { name: "In Progress", color: "#60a5fa", sort: 1, closed: false, default_new: false },
    { name: "Review",      color: "#fbbf24", sort: 2, closed: false, default_new: false },
    { name: "Done",        color: "#34d399", sort: 3, closed: true,  default_new: false },
  ];
  const { error } = await supabaseServer.from("project_stages").insert(
    defaults.map((d) => ({
      tenant_id: tenantId,
      project_id: projectId,
      name: d.name,
      color: d.color,
      sort_order: d.sort,
      is_closed: d.closed,
      is_default_new: d.default_new,
    })),
  );
  if (error) console.error("[api/projects] seed stages:", error.message);
}

/** Copy a source project's stages (+ non-cancelled tasks) into a fresh
 *  project. Task assignees, dates, logged hours and progress are reset;
 *  parent/blocked-by links are remapped onto the new task ids. New ids are
 *  minted up front so stages and tasks each go in ONE bulk insert (the
 *  old version made one round-trip per stage, per task, and per link).
 *  Best-effort: a partial copy still leaves a usable project. */
async function copyFromTemplate(
  tenantId: string,
  templateId: string,
  projectId: string,
  copyTasks: boolean,
): Promise<void> {
  try {
    const { data: stages } = await supabaseServer
      .from("project_stages")
      .select("id, name, color, sort_order, is_closed, is_default_new")
      .eq("tenant_id", tenantId)
      .eq("project_id", templateId)
      .order("sort_order", { ascending: true });

    if (!stages || stages.length === 0) {
      await seedDefaultStages(tenantId, projectId);
    } else {
      const stageMap = new Map<string, string>(stages.map((s) => [s.id as string, crypto.randomUUID()]));
      const { error } = await supabaseServer.from("project_stages").insert(
        stages.map((s) => ({
          id: stageMap.get(s.id as string),
          tenant_id: tenantId,
          project_id: projectId,
          name: s.name,
          color: s.color,
          sort_order: s.sort_order,
          is_closed: s.is_closed,
          is_default_new: s.is_default_new,
        })),
      );
      if (error) {
        console.error("[api/projects] copy stages:", error.message);
        return;
      }
      if (!copyTasks) return;

      const { data: tasks } = await supabaseServer
        .from("project_tasks")
        .select("id, stage_id, parent_task_id, title, description, priority, tag_ids, estimated_hours, blocked_by_task_ids, sort_order")
        .eq("tenant_id", tenantId)
        .eq("project_id", templateId)
        .neq("status", "cancelled")
        .order("sort_order", { ascending: true })
        .limit(500);
      if (!tasks || tasks.length === 0) return;

      const taskMap = new Map<string, string>(tasks.map((t) => [t.id as string, crypto.randomUUID()]));
      /* Copies are reset to "open", so a card from a closed column lands in
         the first open one instead — stage and status must agree. */
      const closedIds = new Set(stages.filter((s) => s.is_closed).map((s) => s.id as string));
      const firstOpen = stages.find((s) => !s.is_closed)?.id as string | undefined;
      const stageFor = (sid: string | null) => {
        if (!sid) return null;
        const src = closedIds.has(sid) && firstOpen ? firstOpen : sid;
        return stageMap.get(src) ?? null;
      };
      /* Parents first — the self-FK is satisfied either way within one
         statement, but this keeps the rows in a natural order. */
      const ordered = [...tasks].sort((a, b) => Number(!!a.parent_task_id) - Number(!!b.parent_task_id));
      const { error: tErr } = await supabaseServer.from("project_tasks").insert(
        ordered.map((t) => ({
          id: taskMap.get(t.id as string),
          tenant_id: tenantId,
          project_id: projectId,
          stage_id: stageFor((t.stage_id as string | null) ?? null),
          parent_task_id: t.parent_task_id ? taskMap.get(t.parent_task_id as string) ?? null : null,
          blocked_by_task_ids: ((t.blocked_by_task_ids as string[] | null) ?? [])
            .map((b) => taskMap.get(b))
            .filter(Boolean) as string[],
          title: t.title,
          description: t.description,
          priority: t.priority,
          tag_ids: t.tag_ids ?? [],
          estimated_hours: t.estimated_hours,
          sort_order: t.sort_order,
          status: "open",
        })),
      );
      if (tErr) console.error("[api/projects] copy tasks:", tErr.message);
    }
  } catch (e) {
    console.error("[api/projects] copyFromTemplate:", e);
  }
}
