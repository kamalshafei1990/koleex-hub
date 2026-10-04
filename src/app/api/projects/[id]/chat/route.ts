import "server-only";

/* POST /api/projects/[id]/chat — "Open project chat".

   First click creates a Discuss group channel linked to the project
   (discuss_channels.linked_project_id) whose members are the project's
   members + manager + the caller; later clicks reuse it and (re)join the
   caller. Answers { channel_id } — the client navigates to
   /discuss?channel=<id>.

   Gates: Projects access to this project (viewers included — reading the
   chat is reading the project) AND Discuss "create" (starting a channel is
   a Discuss write, the same permission its own createChannel needs). */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { assertProjectAccess } from "@/lib/server/project-access";
import { projectMemberIds } from "@/lib/server/project-members";
import { openProjectChannel } from "@/lib/server/discuss-project-channel";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;
  const denyDiscuss = await requireModuleAction(auth, "Discuss", "create");
  if (denyDiscuss) return denyDiscuss;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id);
  if (gate instanceof NextResponse) return gate;

  const [{ data: project }, members] = await Promise.all([
    supabaseServer.from("projects").select("name, color").eq("id", id).eq("tenant_id", auth.tenant_id).maybeSingle(),
    projectMemberIds(auth.tenant_id, id),
  ]);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const p = project as { name: string; color: string | null };

  const memberIds = [...members];
  if (gate.manager_account_id) memberIds.push(gate.manager_account_id);

  const res = await openProjectChannel({
    tenantId: auth.tenant_id,
    projectId: id,
    projectName: p.name,
    projectColor: p.color,
    callerId: auth.account_id,
    memberIds,
  });
  if (!res.ok) {
    if (res.code === "not_migrated") return NextResponse.json({ error: res.error, code: res.code }, { status: 409 });
    console.error("[api/projects/:id/chat]", res.error);
    return NextResponse.json({ error: "Failed to open project chat" }, { status: 500 });
  }
  return NextResponse.json({ channel_id: res.channelId, created: res.created });
}
