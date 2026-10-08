import "server-only";

/* /api/projects/[id]/members — the project's member list.

   GET     → { available, members[], can_manage }
             `available` is false until 20260926_projects_additions.sql is
             applied (the panel then explains instead of erroring).
   POST    { account_ids: uuid[], role?: manager|member|viewer }
             add (or re-role) members. New members join the project chat.
   PATCH   { account_id, role }        change one member's role
   DELETE  ?account_id=<uuid>          remove one member

   Reads: anyone who can see the project. Writes: super admin, the
   project's manager / creator, or a member with role manager. The project
   manager (manager_account_id) cannot be removed here — change the
   manager in the project form instead. */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { assertProjectAccess, canManageProject, UUID_RE, type MemberRole } from "@/lib/server/project-access";
import {
  listProjectMembers,
  MEMBER_ROLES,
  removeProjectMember,
  tenantAccountIds,
  upsertProjectMembers,
} from "@/lib/server/project-members";

type RouteCtx = { params: Promise<{ id: string }> };

const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });
const isRole = (v: unknown): v is MemberRole => MEMBER_ROLES.includes(v as MemberRole);

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Projects");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id);
  if (gate instanceof NextResponse) return gate;

  const [res, canManage] = await Promise.all([listProjectMembers(auth.tenant_id, id), canManageProject(auth, gate)]);
  if (res.error) {
    console.error("[api/projects/:id/members GET]", res.error);
    return NextResponse.json({ error: "Failed to load members" }, { status: 500 });
  }
  return NextResponse.json({
    available: res.available,
    members: res.members,
    can_manage: canManage,
    manager_account_id: gate.manager_account_id,
  });
}

export async function POST(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (gate instanceof NextResponse) return gate;
  if (!(await canManageProject(auth, gate))) return forbidden();

  const body = (await req.json().catch(() => null)) as { account_ids?: unknown; role?: unknown } | null;
  const raw = Array.isArray(body?.account_ids) ? body!.account_ids : [];
  if (raw.length === 0 || raw.length > 200 || !raw.every((x) => typeof x === "string" && UUID_RE.test(x))) {
    return NextResponse.json({ error: "Invalid account_ids" }, { status: 400 });
  }
  const role = body?.role === undefined ? "member" : body.role;
  if (!isRole(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  const ids = await tenantAccountIds(auth.tenant_id, raw as string[]);
  if (ids.length !== new Set(raw as string[]).size) {
    return NextResponse.json({ error: "Account is not in this workspace" }, { status: 400 });
  }
  const res = await upsertProjectMembers(auth, id, ids.map((account_id) => ({ account_id, role })));
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, added: res.added });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (gate instanceof NextResponse) return gate;
  if (!(await canManageProject(auth, gate))) return forbidden();

  const body = (await req.json().catch(() => null)) as { account_id?: unknown; role?: unknown } | null;
  const accountId = typeof body?.account_id === "string" && UUID_RE.test(body.account_id) ? body.account_id : "";
  if (!accountId || !isRole(body?.role)) return NextResponse.json({ error: "Invalid member" }, { status: 400 });
  if (accountId === gate.manager_account_id && body.role !== "manager") {
    return NextResponse.json({ error: "The project manager keeps the manager role" }, { status: 400 });
  }
  const ok = await tenantAccountIds(auth.tenant_id, [accountId]);
  if (ok.length !== 1) return NextResponse.json({ error: "Account is not in this workspace" }, { status: 400 });
  const res = await upsertProjectMembers(auth, id, [{ account_id: accountId, role: body.role }]);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "edit");
  if (deny) return deny;
  const { id } = await params;
  const gate = await assertProjectAccess(auth, id, { write: true });
  if (gate instanceof NextResponse) return gate;
  if (!(await canManageProject(auth, gate))) return forbidden();

  const accountId = new URL(req.url).searchParams.get("account_id") ?? "";
  if (!UUID_RE.test(accountId)) return NextResponse.json({ error: "Invalid member" }, { status: 400 });
  if (accountId === gate.manager_account_id) {
    return NextResponse.json({ error: "Change the project manager before removing them", code: "is_manager" }, { status: 400 });
  }
  const res = await removeProjectMember(auth, id, accountId);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true });
}
