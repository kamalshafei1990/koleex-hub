import "server-only";

/* ===========================================================================
   GET  /api/inventory/item-types     list system + tenant-custom types
   POST /api/inventory/item-types     create a tenant-custom type
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { listItemTypes } from "@/lib/inventory/queries";
import { createItemType } from "@/lib/inventory/items";
import type { ColorToken, IconName } from "@/lib/inventory/types";

const MODULE = "Inventory";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  try {
    const types = await listItemTypes(auth.tenant_id);
    return NextResponse.json({ types });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

interface NewTypeBody {
  type_name: string;
  code_prefix?: string;
  icon?: IconName;
  color?: ColorToken;
  description?: string | null;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, MODULE);
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as NewTypeBody | null;
  if (!body?.type_name) return NextResponse.json({ error: "type_name required" }, { status: 400 });

  const r = await createItemType({
    tenant_id: auth.tenant_id,
    type_name: body.type_name,
    code_prefix: body.code_prefix,
    icon: body.icon,
    color: body.color,
    description: body.description ?? null,
    created_by: auth.account_id,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 422 });
  return NextResponse.json({ type: r.type });
}
