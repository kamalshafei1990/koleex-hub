import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import {
  callerResourceIds,
  checkPlanningRefs,
  planningReadScopeOr,
  PLANNING_ERR,
} from "@/lib/server/planning-access";
import {
  PLANNING_ITEM_TYPES,
  PLANNING_STATUSES,
  isPlanningUuid,
  parsePlanningDate,
  validatePlanningItemInput,
} from "@/lib/planning-validate";

/* GET  /api/planning/items — list planning items.
     Query params:
       start=<ISO>        inclusive window start (items ending after it)
       end=<ISO>          exclusive window end (items starting before it)
       resource_id=X      filter to a single resource
       role_id=X          filter to a single role
       type=shift|...     filter by entity type
       status=draft|...   filter by lifecycle status
       mine=1             only items on the caller's own resource
       open=1             only open shifts (resource_id IS NULL)
       linked_entity_type=X & linked_entity_id=Y → items attached to a
                          Hub entity (customer, project, etc.)
       limit=N            max rows (default + cap 2000)
     Non-super-admins only ever see: items they created, items on their own
     resource, and open shifts (see lib/server/planning-access.ts).
   POST /api/planning/items — create a new item (draft by default). */

const MAX_ROWS = 2000;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;

  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const resourceId = url.searchParams.get("resource_id");
  const roleId = url.searchParams.get("role_id");
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  const mine = url.searchParams.get("mine") === "1";
  const open = url.searchParams.get("open") === "1";
  const linkedType = url.searchParams.get("linked_entity_type");
  const linkedId = url.searchParams.get("linked_entity_id");
  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), MAX_ROWS) : MAX_ROWS;

  /* Reject malformed filters up front instead of letting PostgREST turn
     them into a 500 (or, for .or() pieces, into filter injection). */
  const startIso = start ? parsePlanningDate(start) : null;
  const endIso = end ? parsePlanningDate(end) : null;
  if ((start && !startIso) || (end && !endIso)) {
    return NextResponse.json({ error: PLANNING_ERR[400] }, { status: 400 });
  }
  if ((resourceId && !isPlanningUuid(resourceId)) || (roleId && !isPlanningUuid(roleId)) || (linkedId && !isPlanningUuid(linkedId))) {
    return NextResponse.json({ error: PLANNING_ERR[400] }, { status: 400 });
  }
  if ((type && !(PLANNING_ITEM_TYPES as readonly string[]).includes(type)) || (status && !(PLANNING_STATUSES as readonly string[]).includes(status))) {
    return NextResponse.json({ error: PLANNING_ERR[400] }, { status: 400 });
  }
  if (linkedType && !/^[a-z_]{1,40}$/.test(linkedType)) {
    return NextResponse.json({ error: PLANNING_ERR[400] }, { status: 400 });
  }

  /* The caller's own resource ids feed BOTH the ?mine narrowing and the
     non-SA scope — resolved once (it used to be queried twice). */
  let rids: string[] = [];
  if (mine || !auth.is_super_admin) {
    try {
      rids = await callerResourceIds(auth);
    } catch (e) {
      console.error("[api/planning/items GET] resources:", e instanceof Error ? e.message : e);
      return NextResponse.json({ error: PLANNING_ERR[500] }, { status: 500 });
    }
  }
  if (mine && rids.length === 0) {
    return NextResponse.json({ items: [] }, { headers: { "Cache-Control": "private, no-store" } });
  }

  let q = supabaseServer
    .from("planning_items")
    .select(
      `id, tenant_id, type, title, notes, resource_id, role_id,
       start_at, end_at, allocated_hours, allocated_pct,
       linked_entity_type, linked_entity_id, linked_entity_label,
       is_billable, hourly_rate, status,
       published_at, completed_at, cancelled_at,
       recurrence_rule, recurrence_parent_id,
       created_by_account_id, created_at, updated_at,
       resource:resource_id ( id, name, type, account_id, color, icon ),
       role:role_id ( id, name, color )`,
    )
    .eq("tenant_id", auth.tenant_id);

  if (startIso) q = q.gte("end_at", startIso);
  if (endIso) q = q.lt("start_at", endIso);
  if (resourceId) q = q.eq("resource_id", resourceId);
  if (roleId) q = q.eq("role_id", roleId);
  if (type) q = q.eq("type", type);
  if (status) q = q.eq("status", status);
  if (open) q = q.is("resource_id", null);
  if (linkedType) q = q.eq("linked_entity_type", linkedType);
  if (linkedId) q = q.eq("linked_entity_id", linkedId);
  if (mine) q = q.in("resource_id", rids);

  // Type C scope: non-SA callers see items on THEIR resource, items they
  // created (planners see their own planning), and open (unassigned) shifts.
  if (!auth.is_super_admin) q = q.or(planningReadScopeOr(auth.account_id, rids));

  q = q.order("start_at", { ascending: true }).limit(limit);

  const { data, error } = await q;
  if (error) {
    console.error("[api/planning/items GET]", error.message);
    return NextResponse.json({ error: PLANNING_ERR[500] }, { status: 500 });
  }
  /* no-store: the list changes with every mutation and the client keeps
     its own warm cache — a 30s HTTP cache made the entity strips and the
     post-save refetch show stale rows. */
  return NextResponse.json({ items: data ?? [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Planning", "create");
  if (deny) return deny;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const parsed = validatePlanningItemInput(raw, "create");
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.code, field: parsed.field }, { status: 400 });
  }
  const body = parsed.value;

  const badRef = await checkPlanningRefs(auth.tenant_id, body);
  if (badRef) {
    return NextResponse.json({ error: badRef === "resource_id" ? "invalid_resource" : "invalid_role", field: badRef }, { status: 400 });
  }

  const now = new Date().toISOString();
  const status = body.status ?? "draft";
  const row = {
    tenant_id: auth.tenant_id,
    type: body.type ?? "shift",
    title: body.title ?? "",
    notes: body.notes ?? null,
    resource_id: body.resource_id ?? null,
    role_id: body.role_id ?? null,
    start_at: body.start_at,
    end_at: body.end_at,
    allocated_hours: body.allocated_hours ?? null,
    allocated_pct: body.allocated_pct ?? null,
    linked_entity_type: body.linked_entity_type ?? null,
    linked_entity_id: body.linked_entity_id ?? null,
    linked_entity_label: body.linked_entity_label ?? null,
    is_billable: body.is_billable ?? false,
    hourly_rate: body.hourly_rate ?? null,
    status,
    published_at: status === "published" ? now : null,
    completed_at: status === "completed" ? now : null,
    cancelled_at: status === "cancelled" ? now : null,
    recurrence_rule: body.recurrence_rule ?? null,
    created_by_account_id: auth.account_id,
  };

  const { data, error } = await supabaseServer
    .from("planning_items")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    console.error("[api/planning/items POST]", error.message);
    return NextResponse.json({ error: PLANNING_ERR[500] }, { status: 500 });
  }
  return NextResponse.json({ item: data });
}
