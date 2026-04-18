import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET  /api/projects — list projects (tenant-scoped).
     Query:
       status=active|on_hold|completed|archived|all
       customer_id=<uuid>   only projects linked to this customer
       mine=1               only where I'm manager OR assignee on any task
       search=<text>        ilike over name/code
   POST /api/projects — create + seed 4 default stages. */

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "active";
  const customerId = url.searchParams.get("customer_id");
  const search = url.searchParams.get("search")?.trim();

  let q = supabaseServer
    .from("projects")
    .select(
      `id, tenant_id, name, code, description, color, icon, status,
       is_billable, is_template, is_favorite,
       customer_id, manager_account_id,
       planned_start, planned_end, budget_hours, progress_pct,
       sort_order, created_at, updated_at,
       customer:customer_id ( id, display_name, company_name ),
       manager:manager_account_id ( id, username )`,
    )
    .eq("tenant_id", auth.tenant_id);

  if (status !== "all") q = q.eq("status", status);
  if (customerId) q = q.eq("customer_id", customerId);
  if (search) {
    const term = `%${search}%`;
    q = q.or(`name.ilike.${term},code.ilike.${term}`);
  }
  q = q
    .order("is_favorite", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) {
    console.error("[api/projects GET]", error.message);
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }
  return NextResponse.json({ projects: data ?? [] }, {
    headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=60" },
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;

  const body = (await req.json()) as {
    name: string;
    code?: string | null;
    description?: string | null;
    color?: string | null;
    icon?: string | null;
    customer_id?: string | null;
    manager_account_id?: string | null;
    is_billable?: boolean;
    planned_start?: string | null;
    planned_end?: string | null;
    budget_hours?: number | null;
  };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const { data: project, error } = await supabaseServer
    .from("projects")
    .insert({
      tenant_id: auth.tenant_id,
      name: body.name.trim(),
      code: body.code?.trim() || null,
      description: body.description ?? null,
      color: body.color ?? "#818cf8",
      icon: body.icon ?? null,
      customer_id: body.customer_id ?? null,
      manager_account_id: body.manager_account_id ?? auth.account_id,
      is_billable: body.is_billable ?? false,
      planned_start: body.planned_start ?? null,
      planned_end: body.planned_end ?? null,
      budget_hours: body.budget_hours ?? null,
      created_by_account_id: auth.account_id,
    })
    .select("*")
    .single();

  if (error || !project) {
    console.error("[api/projects POST]", error?.message);
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  // Seed 4 sensible default kanban stages.
  const defaults = [
    { name: "To Do",       color: "#94a3b8", sort: 0, closed: false, default_new: true  },
    { name: "In Progress", color: "#60a5fa", sort: 1, closed: false, default_new: false },
    { name: "Review",      color: "#fbbf24", sort: 2, closed: false, default_new: false },
    { name: "Done",        color: "#34d399", sort: 3, closed: true,  default_new: false },
  ];
  await supabaseServer.from("project_stages").insert(
    defaults.map((d) => ({
      tenant_id: auth.tenant_id,
      project_id: project.id,
      name: d.name,
      color: d.color,
      sort_order: d.sort,
      is_closed: d.closed,
      is_default_new: d.default_new,
    })),
  );

  return NextResponse.json({ project });
}
