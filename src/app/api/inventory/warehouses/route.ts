import "server-only";

/* ===========================================================================
   GET  /api/inventory/warehouses          list active warehouses for tenant
   POST /api/inventory/warehouses          create a warehouse
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
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

const ALLOWED_LOCATION_TYPES = [
  "warehouse","supplier_location","port","forwarder","consolidation_point",
  "in_transit","customer_location","exhibition_site","demo_location","virtual_location",
] as const;
type AllowedLocationType = (typeof ALLOWED_LOCATION_TYPES)[number];

interface NewWarehouseBody {
  code: string;
  name: string;
  location?: string | null;
  location_type?: AllowedLocationType | null;
  is_default?: boolean;
  is_virtual?: boolean;
  contact_person?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  notes?: string | null;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as NewWarehouseBody | null;
  if (!body?.code || !body?.name) {
    return NextResponse.json({ error: "code and name required" }, { status: 400 });
  }

  /* Default rule: only "warehouse" type locations can be the tenant's
     default. Virtual locations (port, forwarder, customer, …) are not
     eligible to be the default destination. */
  const locType: AllowedLocationType = (body.location_type as AllowedLocationType) ?? "warehouse";
  if (!ALLOWED_LOCATION_TYPES.includes(locType)) {
    return NextResponse.json({ error: `Unknown location_type '${locType}'` }, { status: 400 });
  }
  const isDefault = (body.is_default ?? false) && locType === "warehouse";
  /* Auto-infer is_virtual when the caller didn't supply it. */
  const isVirtual = body.is_virtual ?? (locType !== "warehouse" && locType !== "supplier_location");

  if (isDefault) {
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
      location_type: locType,
      is_default: isDefault,
      is_virtual: isVirtual,
      is_active: true,
      contact_person: body.contact_person ?? null,
      contact_phone: body.contact_phone ?? null,
      address: body.address ?? null,
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
