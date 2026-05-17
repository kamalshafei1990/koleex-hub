import "server-only";

/* ===========================================================================
   GET  /api/inventory/warehouses          list active warehouses for tenant
   POST /api/inventory/warehouses          create a warehouse
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { listWarehouses } from "@/lib/inventory/queries";
import { ensureDefaultWarehouse } from "@/lib/inventory/posting";

const MODULE = "Inventory";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  /* Make sure the tenant has at least one warehouse so the UI never
     shows an empty picker. */
  await ensureDefaultWarehouse(auth.tenant_id);
  const list = await listWarehouses(auth.tenant_id);
  return NextResponse.json({ warehouses: list });
}

interface NewWarehouseBody {
  code: string;
  name: string;
  location?: string | null;
  is_default?: boolean;
  notes?: string | null;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as NewWarehouseBody | null;
  if (!body?.code || !body?.name) {
    return NextResponse.json({ error: "code and name required" }, { status: 400 });
  }

  /* If is_default is being toggled on, clear the flag from any other
     warehouse first. The partial unique index would otherwise reject. */
  if (body.is_default === true) {
    await supabaseServer
      .from("inventory_warehouses")
      .update({ is_default: false })
      .eq("tenant_id", auth.tenant_id)
      .eq("is_default", true);
  }

  const { data, error } = await supabaseServer
    .from("inventory_warehouses")
    .insert({
      tenant_id: auth.tenant_id,
      code: body.code,
      name: body.name,
      location: body.location ?? null,
      is_default: body.is_default ?? false,
      is_active: true,
      notes: body.notes ?? null,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Warehouse code already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ warehouse: data });
}
