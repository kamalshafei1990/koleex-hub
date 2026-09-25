import "server-only";

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { assertProjectAccess } from "@/lib/server/project-access";
import { validateProjectFields } from "@/lib/server/project-validate";
import { collectProjectAttachmentPaths, removeTaskAttachmentFiles } from "@/lib/server/project-files";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id);
  if (gate instanceof NextResponse) return gate;

  const { data, error } = await supabaseServer
    .from("projects")
    .select(
      `*,
       customer:customer_id ( id, display_name, company_name ),
       manager:manager_account_id ( id, username )`,
    )
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (error) {
    console.error("[api/projects/:id GET]", error.message);
    return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project: data });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id);
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const allowed = [
    "name", "code", "description", "color", "icon", "status",
    "is_billable", "is_template", "is_favorite",
    "customer_id", "manager_account_id",
    "planned_start", "planned_end", "budget_hours", "budget_amount", "billing_rate", "progress_pct",
    "sort_order",
  ];
  const checked = await validateProjectFields(auth.tenant_id, body, allowed);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });

  const { data, error } = await supabaseServer
    .from("projects")
    .update(checked.patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) {
    console.error("[api/projects/:id PATCH]", error.message);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
  return NextResponse.json({ project: data });
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "delete");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id);
  if (gate instanceof NextResponse) return gate;

  /* Attachment rows cascade with the tasks; their bucket objects do not.
     Collect the paths first, remove them after the response. */
  const paths = await collectProjectAttachmentPaths(auth.tenant_id, id);

  // Hard delete cascades stages + tasks via FK ON DELETE CASCADE.
  const { error } = await supabaseServer
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    console.error("[api/projects/:id DELETE]", error.message);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
  after(() => removeTaskAttachmentFiles(paths));
  return NextResponse.json({ ok: true });
}
