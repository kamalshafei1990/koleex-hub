import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/contacts — List contacts visible to the current user.

   Query params:
     type      (optional) — filter by contact_type (customer / supplier / ...)

   Response:
     200 { contacts: ContactRow[] }
     401 { error: "Not signed in" }
     403 { error: "No access to Customers" }

   Security:
     – Requires an active session cookie (requireAuth)
     – Requires Customers module view permission (requireModuleAccess)
     – Always filtered by the caller's tenant_id so cross-tenant data
       never leaks, even for Super Admin viewing a customer-tenant
       (their tenant_id follows the TenantPicker override)
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const deny = await requireModuleAccess(auth, "Customers");
  if (deny) return deny;

  const url = new URL(req.url);
  const typeFilter = url.searchParams.get("type");

  let q = supabaseServer
    .from("contacts")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .order("first_name", { ascending: true });

  if (typeFilter) q = q.eq("contact_type", typeFilter);

  const { data, error } = await q;
  if (error) {
    console.error("[api/contacts] fetch:", error.message);
    return NextResponse.json(
      { error: "Failed to load contacts" },
      { status: 500 },
    );
  }

  return NextResponse.json({ contacts: data ?? [] }, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" },
  });
}

/* POST /api/contacts — Create a new contact (tenant_id enforced from session). */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Customers");
  if (deny) return deny;

  const body = (await req.json()) as Record<string, unknown>;
  const row = { ...body, tenant_id: auth.tenant_id };

  const { data, error } = await supabaseServer
    .from("contacts")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    console.error("[api/contacts POST]", error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ contact: data });
}
