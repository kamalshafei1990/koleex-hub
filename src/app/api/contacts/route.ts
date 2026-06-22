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
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";

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

  /* PERF: the contacts table stores images/documents as base64 inline, so a
     full select of every row is tens of MB. The directory list only needs the
     avatar (photo_url/logo_url) + text fields for rows and search. Strip the
     heavy blob columns from the LIST payload; the detail/edit views fetch the
     full record on demand via GET /api/contacts/[id]. */
  const HEAVY_FIELDS = [
    "business_card_front", "business_card_back", "business_license_image",
    "documents", "catalogues", "attachments", "visa_documents",
    "contact_persons", "bank_accounts", "resume_lines", "emergency_contacts", "family_members",
    "wechat_qr", "whatsapp_qr", "telegram_qr", "line_qr", "skype_qr", "qq_qr",
    "dingtalk_qr", "messenger_qr", "wechat_pay_qr", "alipay_qr", "website_qr", "ecatalog_qr",
    "quality_issues",
  ];
  const slim = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    for (const k of HEAVY_FIELDS) if (k in r) r[k] = null;
    return r;
  });

  return NextResponse.json({ contacts: slim }, {
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

  const deny = await requireModuleAction(auth, moduleForType(submittedType), "create");
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
    /* Mirror any catalogues uploaded during creation into the Catalogs app. */
    try {
      const { syncContactCatalogues } = await import("@/lib/suppliers/catalogue-sync");
      await syncContactCatalogues(auth.tenant_id, data as never);
    } catch (e) { console.error("[api/contacts POST] catalogue sync", e); }

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

    /* Section-level attribution for the fields supplied at creation. */
    try {
      const { deptsFromFields, recordSectionEdits } = await import("@/lib/suppliers/section-audit");
      const depts = deptsFromFields(Object.keys(body));
      if (depts.length) {
        await recordSectionEdits({
          tenantId: auth.tenant_id,
          supplierId: (data as { id: string }).id,
          depts,
          accountId: auth.account_id ?? null,
          accountName: auth.username || auth.login_email || "System",
        });
      }
    } catch { /* best-effort */ }
  }

  return NextResponse.json({ contact: data });
}
