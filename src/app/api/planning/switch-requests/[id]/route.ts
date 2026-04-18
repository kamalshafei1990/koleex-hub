import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* PATCH /api/planning/switch-requests/:id — approve / reject / cancel.
   body: { status: "approved" | "rejected" | "cancelled" }
   On approve we also re-assign the underlying item to the target's
   resource. */

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;
  const { id } = await params;

  const body = (await req.json()) as {
    status: "approved" | "rejected" | "cancelled";
  };
  if (!body.status) {
    return NextResponse.json({ error: "status required" }, { status: 400 });
  }

  const { data: current, error: fetchErr } = await supabaseServer
    .from("planning_switch_requests")
    .select("id, item_id, requester_id, target_id, status, tenant_id")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (fetchErr || !current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (current.status !== "pending") {
    return NextResponse.json(
      { error: "Request already resolved" },
      { status: 400 },
    );
  }

  // If approving, flip the item's resource to the target's employee resource.
  if (body.status === "approved" && current.target_id) {
    const { data: targetRes } = await supabaseServer
      .from("planning_resources")
      .select("id")
      .eq("tenant_id", auth.tenant_id)
      .eq("account_id", current.target_id)
      .eq("type", "employee")
      .maybeSingle();

    if (targetRes) {
      await supabaseServer
        .from("planning_items")
        .update({ resource_id: targetRes.id })
        .eq("id", current.item_id)
        .eq("tenant_id", auth.tenant_id);
    }
  }

  const { data, error } = await supabaseServer
    .from("planning_switch_requests")
    .update({ status: body.status })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ request: data });
}
