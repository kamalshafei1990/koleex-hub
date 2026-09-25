import "server-only";

import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { assertProjectAccess, canManageProject, projectAccessLevels, viewReason } from "@/lib/server/project-access";
import { isMissingColumn, validateProjectFields, withoutPendingColumns } from "@/lib/server/project-validate";
import { projectMemberCounts, pruneProjectChatSeats, upsertProjectMembers } from "@/lib/server/project-members";
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

  /* `member_count` feeds the Members button; `my_access` (manage | edit |
     view) lets the board hide what the write gates would refuse, and
     `my_access_reason` (viewer | module) says why it is "view". */
  const [{ data, error }, memberCounts, access] = await Promise.all([
    supabaseServer
      .from("projects")
      .select(
        `*,
         customer:customer_id ( id, display_name, company_name ),
         manager:manager_account_id ( id, username )`,
      )
      .eq("id", id)
      .eq("tenant_id", auth.tenant_id)
      .maybeSingle(),
    projectMemberCounts(auth.tenant_id, [id]),
    requireModuleAction(auth, "Projects", "edit").then(async (denied) => ({
      canEditModule: !denied,
      levels: await projectAccessLevels(auth, [gate], !denied),
    })),
  ]);
  if (error) {
    console.error("[api/projects/:id GET]", error.message);
    return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    project: {
      ...data,
      member_count: memberCounts.get(id) ?? 0,
      my_access: access.levels.get(id) ?? "view",
      my_access_reason: viewReason(access.levels.get(id) ?? "view", access.canEditModule),
    },
  });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const allowed = [
    "name", "code", "description", "color", "icon", "status",
    "is_billable", "is_template", "is_favorite",
    "customer_id", "manager_account_id",
    "planned_start", "planned_end", "budget_hours", "budget_amount", "billing_rate", "currency", "progress_pct",
    "sort_order",
  ];
  const checked = await validateProjectFields(auth.tenant_id, body, allowed);
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  const patch = checked.patch;

  /* Archive / restore — status "archived" is the one switch (the chip, the
     form and the Archive action all set it) and archived_at records when.
     Leaving "archived" clears the stamp. Only people who manage the project
     may archive or restore it. */
  if ("status" in patch) {
    const { data: cur } = await supabaseServer
      .from("projects").select("status").eq("id", id).eq("tenant_id", auth.tenant_id).maybeSingle();
    const prevStatus = (cur as { status: string } | null)?.status ?? null;
    const archiving = patch.status === "archived" && prevStatus !== "archived";
    const restoring = patch.status !== "archived" && prevStatus === "archived";
    if ((archiving || restoring) && !(await canManageProject(auth, gate))) {
      return NextResponse.json({ error: "Only the project's managers can archive or restore it" }, { status: 403 });
    }
    if (archiving) patch.archived_at = new Date().toISOString();
    if (restoring) patch.archived_at = null;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  let res = await supabaseServer
    .from("projects")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  /* Before 20260926_projects_additions.sql: archived_at / currency do not
     exist yet. Save everything else rather than fail the whole edit. */
  if (res.error && isMissingColumn(res.error)) {
    const rest = withoutPendingColumns(patch);
    res = Object.keys(rest).length > 0
      ? await supabaseServer.from("projects").update(rest).eq("id", id).eq("tenant_id", auth.tenant_id).select("*").single()
      : await supabaseServer.from("projects").select("*").eq("id", id).eq("tenant_id", auth.tenant_id).single();
  }
  const { data, error } = res;
  if (error) {
    console.error("[api/projects/:id PATCH]", error.message);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }

  /* A (new) manager is always a member with the manager role. The one
     replaced leaves the project chat if managing was their last way in
     (not creator, assignee, nor a member of any role). */
  const newManager = patch.manager_account_id as string | null | undefined;
  const oldManager = gate.manager_account_id;
  const managerChanged = newManager !== undefined && (newManager ?? null) !== oldManager;
  if (managerChanged) {
    after(async () => {
      if (newManager) await upsertProjectMembers(auth, id, [{ account_id: newManager, role: "manager" }]);
      if (oldManager) await pruneProjectChatSeats(auth.tenant_id, [{ project_id: id, account_id: oldManager }]);
    });
  }
  return NextResponse.json({ project: data });
}

/* Hard delete is SUPER ADMIN ONLY (2026-09-26). Everyone else archives
   (PATCH status "archived"), which is restorable. The client asks for the
   project's name to be typed before it sends this. */
export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "delete");
  if (deny) return deny;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Only a super admin can permanently delete a project — archive it instead", code: "archive_instead" }, { status: 403 });
  }
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
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
