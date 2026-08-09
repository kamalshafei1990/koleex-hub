import "server-only";

/* PATCH /api/membership-requests/[id] — record a decision.

   Approving does NOT create an account. That is the owner's rule and it is
   the right one: who gets in, with which role, seeing which prices, is a
   judgement made in Roles & Permissions and Commercial Policy by a person.
   This endpoint records that the judgement was made, by whom and when, so a
   request stops being an unread mail message and becomes a closed one.

   `status`, `reviewed_by` and `reviewed_at` have existed on this table since
   it was created. Nothing has ever written them until now. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { isReviewer } from "@/lib/server/admin-recipients";

const DECISIONS = new Set(["pending", "approved", "rejected"]);
const MAX_NOTE = 1000;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!(await isReviewer(auth.account_id))) {
    return NextResponse.json({ error: "Not a reviewer" }, { status: 403 });
  }

  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const status = typeof body.status === "string" ? body.status : "";
  if (!DECISIONS.has(status)) {
    return NextResponse.json({ error: "Unknown decision" }, { status: 400 });
  }
  const note =
    typeof body.note === "string" ? body.note.trim().slice(0, MAX_NOTE) : "";

  /* A rejection with no reason is a decision nobody can review later, and the
     applicant will ask why. */
  if (status === "rejected" && !note) {
    return NextResponse.json(
      { error: "Please give a reason for refusing this request." },
      { status: 400 },
    );
  }

  const { data: current, error: readErr } = await supabaseServer
    .from("membership_requests")
    .select("id, ref, status, metadata")
    .eq("id", id)
    .maybeSingle();
  if (readErr || !current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  /* Every decision is appended, never overwritten. Somebody re-opening a
     rejected request and approving it is a fact worth keeping. */
  const meta = ((current as { metadata: Record<string, unknown> }).metadata ?? {}) as Record<string, unknown>;
  const history = Array.isArray(meta.decisions) ? (meta.decisions as unknown[]) : [];
  history.push({
    status,
    note: note || null,
    by: auth.account_id,
    at: new Date().toISOString(),
    from: (current as { status: string }).status,
  });

  const { error } = await supabaseServer
    .from("membership_requests")
    .update({
      status,
      reviewed_by: status === "pending" ? null : auth.account_id,
      reviewed_at: status === "pending" ? null : new Date().toISOString(),
      metadata: { ...meta, decisions: history },
    })
    .eq("id", id);
  if (error) {
    console.error("[api/membership-requests PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status });
}
