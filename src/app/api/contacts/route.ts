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
import { stageTimer } from "@/lib/server/perf";
import { sanitizeContactRows } from "@/lib/server/sensitive-columns";
import { persistContactImages } from "@/lib/server/persist-contact-images";

/* Map contact_type → ERP module name. Unknown / missing types fall
   back to "Customers" which is the broadest directory view. */
function moduleForType(type: string | null | undefined): string {
  if (type === "supplier") return "Suppliers";
  if (type === "employee") return "Employees";
  return "Customers";
}

/* PERF (critical): the LIST query must NOT pull the heavy blob columns from
   Postgres. Some contact rows are ~80 KB each - wechat_qr (~73 KB), business
   card scans (~60 KB), contact_persons JSON (~40 KB) - so `select("*")` on the
   directory made the DB read + serialize ~20 MB per request, taking 20+ seconds
   and saturating the shared instance (which slowed the WHOLE app). Stripping
   those fields in Node afterwards (below) fixed the response size but NOT the DB
   cost. This explicit projection = every column the directory/search needs,
   EXCLUDING the 26 heavy columns (kept in sync with HEAVY_FIELDS below). The
   detail/edit view still fetches the full record via GET /api/contacts/[id]. */
const LIST_COLUMNS =
  "id, entity_type, full_name, company_name, display_name, photo_url, logo_url, phone, mobile, email, website, wechat_id, country, city, address_1, address_2, notes, is_active, created_at, updated_at, contact_type, title, first_name, middle_name, last_name, company, position, birthday, customer_type, phones, emails, addresses, websites, social_profiles, related_names, custom_fields, province, country_code, province_code, total_revenue, last_order_date, payment_terms, credit_limit, outstanding_balance, currency, industry, source, tags, account_manager, first_contact_date, last_contacted, follow_up_date, communication_preference, language, shipping_addresses, preferred_shipping, tax_id, incoterms, supplier_type, product_categories, brand_names, moq, lead_time, total_purchases, origin_country, origin_country_code, certifications, rating, reliability_score, quality_notes, last_quality_issue, sample_status, factory_visit_date, company_name_en, company_name_cn, additional_company_names, supplier_tel, supplier_mobile, supplier_email, supplier_website, supplier_address, division, category, payment_info, work_email, work_tel, work_mobile, management, department, job_position, job_title, manager, work_address, work_location, private_email, private_phone, employee_bank_account, legal_name, place_of_birth, gender, visa_no, work_permit, nationality, nationality_code, id_no, ssn_no, passport_no, private_address, home_work_distance, marital_status, number_of_children, certificate_level, field_of_study, market_band, commercial_role, territory, exclusivity, exclusivity_scope, exclusivity_expiry, backup_account_manager, assigned_branch, source_details, referred_by, customer_level_assigned_date, customer_level_review_date, sales_rep, credit_rating_internal, credit_rating_external, credit_limit_approved_by, credit_limit_approved_date, overdue_balance, days_sales_outstanding, credit_insurance_covered, credit_insurance_provider, credit_insurance_coverage, preferred_payment_method, max_discount_allowed, price_list_tier, special_pricing_agreement, contract_pricing_expiry, commission_rate, kyc_status, kyc_verified_date, kyc_verified_by, kyc_review_due_date, risk_score, sanctions_check_status, sanctions_check_date, pep_status, high_risk_country, aml_status, business_registration_number, registration_country, registration_date, year_established, company_type, trading_name, employee_count_range, annual_revenue_range, eori_number, duns_number, importer_exporter_code, customs_code, gst_number, cr_number, whatsapp_business, telegram_id, line_id, skype_id, sub_industry, buying_behavior, price_sensitivity, quality_sensitivity, customer_health_score, nps_score, churn_risk, vip_status, strategic_account, relationship_stage, support_tier, port_of_entry, preferred_carriers, customs_broker, freight_forwarder, shipping_marks, container_preference, certifications_required, labeling_requirements, hs_codes, internal_notes, flags, tenant_id, strategic_status, strategic_status_since, strategic_status_reason, blacklist_reason, supports_oem_branding, supports_packaging_customization, supports_spare_parts, supports_samples, sample_turnaround_days, wecom_support_available, wechat_sales_group_available, wechat_official_account, readiness_milestone, supplier_postal_code, qq_id, dingtalk_id, messenger_id, wechat_pay_id, alipay_id, messaging_channels, supplier_profile_url, supplier_address_cn, ecatalog_url, business_timezone, business_hours_start, business_hours_end, backup_supplier_name, wechat_group_name, wechat_group_members, categories, person_id";

export async function GET(req: Request) {
  const _t = stageTimer("contacts.list");
  const auth = await requireAuth();
  if (auth instanceof NextResponse) { _t.done({ status: 401 }); return auth; }

  const url = new URL(req.url);
  const typeFilter = url.searchParams.get("type");

  const deny = await requireModuleAccess(auth, moduleForType(typeFilter));
  if (deny) { _t.done({ status: 403 }); return deny; }
  _t.mark("auth");

  let q = supabaseServer
    .from("contacts")
    /* `as "*"` keeps supabase-js typing identical to the previous select("*")
       (data stays ContactRow[]) while at runtime only the light columns are
       fetched - so nothing downstream needs retyping and `next build` is safe. */
    .select(LIST_COLUMNS as "*")
    .eq("tenant_id", auth.tenant_id)
    .order("first_name", { ascending: true });

  if (typeFilter) q = q.eq("contact_type", typeFilter);

  const { data, error } = await q;
  _t.mark("db");
  if (error) {
    console.error("[api/contacts] fetch:", error.message);
    _t.done({ status: 500 });
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
    "wechat_qr", "wechat_official_account_qr", "whatsapp_qr", "telegram_qr", "line_qr", "skype_qr", "qq_qr",
    "dingtalk_qr", "messenger_qr", "wechat_pay_qr", "alipay_qr", "website_qr", "ecatalog_qr",
    "quality_issues",
  ];
  /* logo_url / photo_url frequently hold a base64 data: URL (a cropped logo is
     ~80 KB each). With ~100 rows that alone is several MB and pushes the list
     response past Vercel's 4.5 MB function limit → the whole fetch fails and the
     directory shows nothing. Drop ONLY the heavy base64 avatars here; short
     (storage-URL) logos stay inline. The client lazy-loads the dropped ones in
     small batches via GET /api/contacts/avatars. */
  const isHeavyDataUrl = (v: unknown) =>
    typeof v === "string" && v.startsWith("data:") && v.length > 4000;
  const slim = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    for (const k of HEAVY_FIELDS) r[k] = null;
    if (isHeavyDataUrl(r.logo_url)) r.logo_url = null;
    if (isHeavyDataUrl(r.photo_url)) r.photo_url = null;
    return r;
  });

  /* Column-level policy: credit limits, payment terms, margins-adjacent
     commercial data need can_view_private — module access alone lets a
     user browse the directory, not the credit relationship. */
  const visible = sanitizeContactRows(auth, slim);

  const { header } = _t.done({ status: 200, type: typeFilter ?? "all", rows: visible.length });
  return NextResponse.json({ contacts: visible }, {
    headers: {
      "Cache-Control": "private, max-age=30, stale-while-revalidate=300",
      "Server-Timing": header,
    },
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

  /* Root-cause guard: move any inline base64 avatar into Storage so the row
     stores a short URL, never multi-KB base64 (keeps the directory list lean). */
  await persistContactImages(auth.tenant_id, row);

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
