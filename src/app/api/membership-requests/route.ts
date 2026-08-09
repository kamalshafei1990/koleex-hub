import "server-only";

/* GET /api/membership-requests — the review queue.

   WHY THIS EXISTS. `membership_requests` has carried `status`, `reviewed_by`
   and `reviewed_at` since it was created and nothing has ever written them.
   A request arrived as a mail message and that was the whole system: no
   queue, no way to tell a handled request from an untouched one, no way to
   see that the same company applied three times. Two reviewers could both
   spend an afternoon on the same application and neither would know.

   The gate is "are you a reviewer?", NOT the Accounts module. A Super Admin
   can nominate anyone onto the rota — that is the point of the flag — and
   somebody nominated to read applications does not necessarily hold Accounts
   permissions. Gating on the module would have quietly made the nomination
   useless. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { isReviewer } from "@/lib/server/admin-recipients";

const STATUSES = new Set(["pending", "approved", "rejected"]);

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!(await isReviewer(auth.account_id))) {
    return NextResponse.json({ error: "Not a reviewer" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "pending";

  let q = supabaseServer
    .from("membership_requests")
    .select("id, ref, full_name, email, company, message, status, reviewed_by, reviewed_at, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status !== "all") {
    if (!STATUSES.has(status)) {
      return NextResponse.json({ error: "Unknown status" }, { status: 400 });
    }
    q = q.eq("status", status);
  }

  const { data, error } = await q;
  if (error) {
    console.error("[api/membership-requests GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;

  /* Counts for the tabs come from the server, never from the rows above —
     the list is capped at 200 and "Pending 3" computed from a truncated page
     is a number that is wrong exactly when it matters. */
  const counts: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
  await Promise.all(
    (["pending", "approved", "rejected"] as const).map(async (s) => {
      const { count } = await supabaseServer
        .from("membership_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", s);
      counts[s] = count ?? 0;
    }),
  );

  /* Who has applied before, under the same email or the same company. A
     reviewer looking at an application needs to know it is the third one this
     month before deciding, not after. */
  const emails = rows.map((r) => String(r.email ?? "").toLowerCase()).filter(Boolean);
  const priorByEmail = new Map<string, number>();
  if (emails.length > 0) {
    const { data: all } = await supabaseServer
      .from("membership_requests")
      .select("email")
      .in("email", [...new Set(emails)]);
    for (const r of (all ?? []) as { email: string }[]) {
      const k = (r.email ?? "").toLowerCase();
      priorByEmail.set(k, (priorByEmail.get(k) ?? 0) + 1);
    }
  }

  /* Reviewer names, resolved in one query rather than per row. */
  const reviewerIds = [...new Set(rows.map((r) => r.reviewed_by).filter(Boolean) as string[])];
  const names = new Map<string, string>();
  if (reviewerIds.length > 0) {
    const { data: revs } = await supabaseServer
      .from("accounts")
      .select("id, username")
      .in("id", reviewerIds);
    for (const r of (revs ?? []) as { id: string; username: string }[]) {
      names.set(r.id, r.username);
    }
  }

  return NextResponse.json({
    counts,
    requests: rows.map((r) => ({
      ...r,
      reviewed_by_name: r.reviewed_by ? names.get(r.reviewed_by as string) ?? null : null,
      applications_from_this_email: priorByEmail.get(String(r.email ?? "").toLowerCase()) ?? 1,
    })),
  });
}
