import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { callerMayEditPeople } from "@/lib/server/people-access";

/* PATCH /api/people/[id] — update a person row.

   ACCESS POLICY (access-architecture vision, 2026-07-13): employee identity
   data is COMPANY data. Regular users may NOT edit their own person record —
   only callers whose role can edit Employees or Accounts (or the Super
   Admin) may modify people rows, including their own. Self-service in
   Settings is limited to account PREFERENCES (language/theme/pronouns/
   links), which live on accounts.preferences, not here. */

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  /* Identity edits require HR (Employees) or Accounts edit rights — for
     EVERY row, including the caller's own. An employee's information is
     company data maintained by the managers whose position allows it. */
  if (!(await callerMayEditPeople(auth))) {
    return NextResponse.json(
      {
        error:
          "Your information is maintained by HR. Contact your manager to update it.",
      },
      { status: 403 },
    );
  }

  // Tenant check.
  let q = supabaseServer.from("people").select("id").eq("id", id);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data: existing } = await q.maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patch = (await req.json()) as Record<string, unknown>;
  delete patch.id;
  delete patch.tenant_id;

  const { error } = await supabaseServer
    .from("people")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("[api/people/[id] PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
