import "server-only";

/* ===========================================================================
   GET  /api/finance/setup/assets       — list active assets
   POST /api/finance/setup/assets       — create asset
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { resolveBaseCurrency } from "@/lib/finance/currency";

const ALLOWED_METHODS = ["straight_line", "declining_balance", "none"] as const;
type Method = (typeof ALLOWED_METHODS)[number];

interface AssetBody {
  name: string;
  category?: string | null;
  purchase_value: number;
  purchase_date?: string | null;
  depreciation_method?: Method;
  useful_life_years?: number | null;
  currency?: string;
  notes?: string | null;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("finance_assets")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .neq("status", "archived")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assets: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Finance", "create");
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as AssetBody | null;
  if (!body?.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  const value = Number(body.purchase_value);
  if (!Number.isFinite(value) || value < 0) {
    return NextResponse.json({ error: "purchase_value must be a non-negative number" }, { status: 400 });
  }
  const method: Method = (ALLOWED_METHODS as readonly string[]).includes(body.depreciation_method ?? "")
    ? (body.depreciation_method as Method)
    : "straight_line";

  const baseCurrency = await resolveBaseCurrency(auth.tenant_id);
  const { data, error } = await supabaseServer
    .from("finance_assets")
    .insert({
      tenant_id: auth.tenant_id,
      name: body.name.trim(),
      category: body.category?.trim() || null,
      purchase_value: value,
      purchase_date: body.purchase_date || null,
      depreciation_method: method,
      useful_life_years: body.useful_life_years != null ? Number(body.useful_life_years) : null,
      currency: body.currency?.trim().toUpperCase() || baseCurrency,
      notes: body.notes?.trim() || null,
      created_by: auth.account_id,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asset: data });
}
