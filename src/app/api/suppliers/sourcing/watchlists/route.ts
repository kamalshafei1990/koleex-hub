import "server-only";

/* ---------------------------------------------------------------------------
   GET  /api/suppliers/sourcing/watchlists  — list saved views / watchlists
   POST /api/suppliers/sourcing/watchlists  — create a saved view / watchlist

   Tenant-scoped, procurement+ only, visibility-tier filtered. Creating a
   watchlist emits a single timeline event (watchlist_created).
   --------------------------------------------------------------------------- */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { resolveCallerTier, visibleTiers } from "@/lib/suppliers/intelligence";
import { logSupplierEvent, actorName } from "@/lib/suppliers/timeline";

const VIS = ["public", "internal", "procurement", "finance", "management"];

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;

  const tier = resolveCallerTier(auth);
  if (tier === "public" || tier === "internal") {
    return NextResponse.json({ error: "Insufficient tier" }, { status: 403 });
  }
  const tiers = visibleTiers(tier);

  const { data, error } = await supabaseServer
    .from("sourcing_watchlists")
    .select("id, name, kind, description, filters, supplier_ids, visibility_tier, created_by, created_at, updated_at")
    .eq("tenant_id", auth.tenant_id)
    .in("visibility_tier", tiers as string[])
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ watchlists: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;

  const tier = resolveCallerTier(auth);
  if (tier === "public" || tier === "internal") {
    return NextResponse.json({ error: "Insufficient tier" }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty */ }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const kind = body.kind === "view" ? "view" : "watchlist";
  const visibility_tier = typeof body.visibility_tier === "string" && VIS.includes(body.visibility_tier) ? body.visibility_tier : "procurement";
  const filters = body.filters && typeof body.filters === "object" ? body.filters : {};
  const supplier_ids = Array.isArray(body.supplier_ids)
    ? body.supplier_ids.filter((x): x is string => typeof x === "string").slice(0, 500)
    : [];
  const description = typeof body.description === "string" ? body.description.slice(0, 1000) : null;

  const { data, error } = await supabaseServer
    .from("sourcing_watchlists")
    .insert({ tenant_id: auth.tenant_id, name: name.slice(0, 200), kind, description, filters, supplier_ids, visibility_tier, created_by: auth.account_id ?? null })
    .select("id, name, kind, description, filters, supplier_ids, visibility_tier, created_by, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Timeline is supplier-scoped (supplier_id NOT NULL). Only emit when the
  // watchlist actually follows at least one supplier — anchor on the first.
  // Keeps the trail meaningful and spam-free for empty/filter-only views.
  if (supplier_ids[0]) {
    await logSupplierEvent({
      tenant_id: auth.tenant_id,
      supplier_id: supplier_ids[0],
      event_type: "watchlist_created",
      event_category: "procurement",
      title: `${kind === "view" ? "Saved view" : "Watchlist"} created: ${name}`,
      description: supplier_ids.length > 1 ? `${supplier_ids.length} suppliers followed.` : "1 supplier followed.",
      visibility_tier: visibility_tier,
      actor_id: auth.account_id ?? null,
      actor_name: actorName(auth),
      source_module: "sourcing",
      metadata: { watchlist_id: data?.id, kind, supplier_ids },
    });
  }

  return NextResponse.json({ watchlist: data }, { status: 201 });
}
