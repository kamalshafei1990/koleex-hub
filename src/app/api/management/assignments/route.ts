import "server-only";

/* Who sits in which position.

   GET    ?department_id=…            active assignments
   POST   { ...fields }               create
   PATCH  { id, ...fields }           update
   PUT    { transfer: { assignmentId, newPositionId, newDepartmentId } }
   DELETE { id }

   All of this used to run in the browser against koleex_assignments, a
   service-role-only table, so the org chart could not read a single seat and
   none of the writes landed. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { historyRow } from "@/lib/management/position-history";

function requireSA(auth: { is_super_admin?: boolean }) {
  return auth.is_super_admin
    ? null
    : NextResponse.json({ error: "Super admin required." }, { status: 403 });
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const departmentId = new URL(req.url).searchParams.get("department_id");
  /* koleex_assignments has NO tenant_id column — it inherits tenancy from the
     department and position it points at, both of which are tenant-scoped. */
  let q = supabaseServer
    .from("koleex_assignments")
    .select("*")
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (departmentId) q = q.eq("department_id", departmentId);

  const { data, error } = await q;
  if (error) {
    console.error("[api/management/assignments GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ assignments: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = requireSA(auth);
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Body required." }, { status: 400 });
  const payload = { ...body, updated_at: new Date().toISOString() };
  delete (payload as { id?: unknown }).id;

  const { data, error } = await supabaseServer
    .from("koleex_assignments").insert(payload).select("*").single();
  if (error) {
    console.error("[api/management/assignments POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ assignment: data });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = requireSA(auth);
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as (Record<string, unknown> & { id?: string }) | null;
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  const payload: Record<string, unknown> = { ...body, updated_at: new Date().toISOString() };
  delete payload.id;
  delete payload.tenant_id;

  const { error } = await supabaseServer
    .from("koleex_assignments").update(payload).eq("id", id);
  if (error) {
    console.error("[api/management/assignments PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/* PUT — transfer someone to another position.

   Two writes that must agree: move the assignment, then record the move in
   the position history — ONE row, from the old position to the new one, so
   the chart can answer both "who left this seat" and "who arrived" (either
   position's history finds it). Done here as one operation; in the browser a
   failure between them left a transfer with half a paper trail. The row is
   the table's own columns (lib/management/position-history): the insert used
   to name columns the table does not have and never landed. */
export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = requireSA(auth);
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as {
    transfer?: { assignmentId?: string; newPositionId?: string; newDepartmentId?: string };
  } | null;
  const t = body?.transfer;
  if (!t?.assignmentId || !t.newPositionId || !t.newDepartmentId) {
    return NextResponse.json(
      { error: "transfer requires assignmentId, newPositionId and newDepartmentId." },
      { status: 400 },
    );
  }

  const { data: current, error: findErr } = await supabaseServer
    .from("koleex_assignments").select("*")
    .eq("id", t.assignmentId).maybeSingle();
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const cur = current as Record<string, unknown>;
  const stamp = new Date().toISOString();

  const { error: upErr } = await supabaseServer
    .from("koleex_assignments")
    .update({ position_id: t.newPositionId, department_id: t.newDepartmentId, updated_at: stamp })
    .eq("id", t.assignmentId);
  if (upErr) {
    console.error("[api/management/assignments transfer]", upErr.message);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { error: histErr } = await supabaseServer.from("koleex_position_history").insert(historyRow({
    action: "transferred",
    personId: String(cur.person_id),
    departmentId: t.newDepartmentId,
    fromPositionId: typeof cur.position_id === "string" ? cur.position_id : null,
    toPositionId: t.newPositionId,
    changedBy: auth.account_id,
    at: stamp,
  }));
  /* The move already happened; a missing audit row must not report the whole
     transfer as failed, but it must be LOUD. */
  if (histErr) console.error("[api/management/assignments transfer history]", histErr.message);

  return NextResponse.json({ ok: true, historyRecorded: !histErr });
}

export async function DELETE(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = requireSA(auth);
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const { error } = await supabaseServer
    .from("koleex_assignments").delete().eq("id", body.id);
  if (error) {
    console.error("[api/management/assignments DELETE]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
