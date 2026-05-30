import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/contacts — List contacts visible to the current user.

   Query params:
     type      (optional) — filter by contact_type (customer / supplier / ...)

   Response:
     200 { contacts: ContactRow[] }
     401 { error: "Not signed in" }
     403 { error: "No access to <Module>" }

   Security:
     – Requires an active session cookie (requireAuth)
     – Requires the MODULE that matches the contact_type being
       requested — Suppliers for supplier, Customers for everything
       else (customer / company / people). This prevents a Customer
       role (which has Customers view stripped and only keeps Quotations)
       from hitting /api/contacts?type=supplier and walking the supplier
       directory.
     – Always filtered by the caller's tenant_id so cross-tenant data
       never leaks, even for Super Admin viewing a customer-tenant
       (their tenant_id follows the TenantPicker override)
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* Map contact_type → ERP module name. Unknown / missing types fall
   back to "Customers" which is the broadest directory view. */
function moduleForType(type: string | null | undefined): string {
  if (type === "supplier") return "Suppliers";
  if (type === "employee") return "Employees";
  return "Customers";
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const typeFilter = url.searchParams.get("type");

  const deny = await requireModuleAccess(auth, moduleForType(typeFilter));
  if (deny) return deny;

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

/* POST /api/contacts — Create a new contact (tenant_id enforced from session).
   Permission check is keyed to the submitted contact_type so a user
   with only Customers can't create a supplier via this endpoint. */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as Record<string, unknown>;
  const submittedType = typeof body.contact_type === "string" ? body.contact_type : null;

  const deny = await requireModuleAccess(auth, moduleForType(submittedType));
  if (deny) return deny;

  /* ── Canonical name derivation (data boundary) ──
     Create surfaces disagree on which name field they send: the simple
     /create/supplier form sends company_name + display_name, while the
     admin modal sends only company_name_en / company_name_cn. Downstream
     views resolve display_name > full_name > company_name, so a
     modal-created supplier rendered BLANK. Guarantee every row carries a
     usable display_name (and backfill company_name from the _en/_cn
     variant) so no contact/supplier can render nameless regardless of the
     form that created it. Never overwrites a value the caller provided. */
  const pick = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const companyName =
    pick(body.company_name) ?? pick(body.company_name_en) ?? pick(body.company_name_cn);
  const personName =
    [pick(body.first_name), pick(body.last_name)].filter(Boolean).join(" ") || null;
  const displayName =
    pick(body.display_name) ?? companyName ?? pick(body.full_name) ?? personName;

  const row: Record<string, unknown> = { ...body, tenant_id: auth.tenant_id };
  if (displayName) row.display_name = displayName;
  if (companyName && !pick(body.company_name)) row.company_name = companyName;

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

  // Seed the supplier operational timeline at birth (unified history layer).
  if (data && (data as { contact_type?: string }).contact_type === "supplier") {
    try {
      const { logSupplierEvent } = await import("@/lib/suppliers/timeline");
      await logSupplierEvent({
        tenant_id: auth.tenant_id,
        supplier_id: (data as { id: string }).id,
        event_type: "supplier_created", event_category: "relationship",
        title: "Supplier created",
        actor_id: auth.account_id ?? null,
        actor_name: auth.username || auth.login_email || "System",
        source_module: "suppliers", visibility_tier: "internal",
      });
    } catch { /* best-effort */ }
  }

  return NextResponse.json({ contact: data });
}
