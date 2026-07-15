import "server-only";

/* ===========================================================================
   GET  /api/inventory/items         list inventory items
   POST /api/inventory/items         create item (+ optional opening balance)

   INV-H1 — Standalone item creation is locked down.
     · Normal POST requires linked_product_id (a Product must exist first).
     · Pass admin_repair=true to opt into the legacy unlinked path; the
       server stamps metadata.admin_repair=true so the DB guard accepts it.
     · The DB trigger fn_inventory_items_require_product enforces the same
       rule at the storage layer.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { listInventoryItems } from "@/lib/inventory/queries";
import { createInventoryItem, getItemTypeRequiresProduct } from "@/lib/inventory/items";
import type { CreateItemInput } from "@/lib/inventory/types";
import { getUserExperience } from "@/lib/experience";

const MODULE = "Inventory";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const url = new URL(req.url);
  try {
    /* PERF: fetch the item list and the caller's cost-visibility in PARALLEL
       (independent reads) instead of one after the other. */
    const [items, experience] = await Promise.all([
      listInventoryItems({
        tenantId: auth.tenant_id,
        search: url.searchParams.get("q") ?? undefined,
        typeId: url.searchParams.get("type_id") ?? undefined,
        status: (url.searchParams.get("status") as "active" | "inactive" | "archived" | null) ?? undefined,
        limit: Number(url.searchParams.get("limit")) || 200,
      }),
      getUserExperience(auth),
    ]);
    /* Role-based cost masking — strip cost_price / avg_cost / inventory_value
       on the wire for roles that aren't allowed to see them. */
    const masked = experience.can_see_cost_data
      ? items
      : items.map((it) => ({ ...it, cost_price: null, avg_cost: 0, inventory_value: 0 }));
    /* Short browser cache so revisiting the list is instant; SWR refreshes it
       in the background. Cost masking is per-user and the cache is `private`. */
    return NextResponse.json(
      { items: masked, can_see_cost_data: experience.can_see_cost_data },
      { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=120" } },
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

interface CreateItemBody extends Partial<CreateItemInput> {
  /** Opt-in to the admin-repair path: stamp metadata.admin_repair so the
   *  DB guard accepts an item without linked_product_id. Use sparingly. */
  admin_repair?: boolean;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, MODULE, "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as CreateItemBody | null;
  if (!body?.item_name) return NextResponse.json({ error: "item_name required" }, { status: 400 });

  /* INV-H5B guard: branch on the item type's requires_product flag.
     - product_related types (machines, parts, finished products...) still
       need a Product unless the caller opts into admin_repair.
     - internal_use types (office supplies, catalogs, uniforms...) may be
       created standalone with no Product link. */
  if (!body.linked_product_id && !body.admin_repair) {
    if (!body.item_type_id && !body.type_key) {
      return NextResponse.json(
        { error: "Select an item type before creating stock.", code: "INV_H5B_REQUIRE_TYPE" },
        { status: 422 },
      );
    }
    const typeInfo = await getItemTypeRequiresProduct(auth.tenant_id, {
      item_type_id: body.item_type_id ?? undefined,
      type_key: body.type_key ?? undefined,
    });
    if (!typeInfo.ok) {
      return NextResponse.json({ error: typeInfo.error ?? "Unknown item type" }, { status: 422 });
    }
    if (typeInfo.requires_product === true) {
      return NextResponse.json(
        { error: "Create or link a Product before tracking stock.", code: "INV_H1_REQUIRE_PRODUCT" },
        { status: 422 },
      );
    }
  }

  const r = await createInventoryItem({
    ...body,
    tenant_id: auth.tenant_id,
    item_name: body.item_name,
    created_by: auth.account_id,
    /* Pass admin_repair flag down via metadata so the DB trigger accepts
       the insert. */
    metadata: body.admin_repair
      ? { ...(body.metadata ?? {}), admin_repair: true }
      : body.metadata,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
  return NextResponse.json({ item: r.item, opening_movement_id: r.opening_movement_id });
}
