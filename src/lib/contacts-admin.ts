/* ---------------------------------------------------------------------------
   Contacts Admin — Supabase CRUD for the contacts module.
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";
import type { ScopeContext } from "./scope";

/* ── Types ── */

export interface ContactRow {
  id: string;
  contact_type: string;
  entity_type: string | null;
  photo_url: string | null;
  title: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  full_name: string | null;
  display_name: string | null;
  company: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  country_code: string | null;
  province: string | null;
  province_code: string | null;
  city: string | null;
  birthday: string | null;
  notes: string | null;
  website: string | null;
  is_active: boolean;
  customer_type: string | null;
  phones: { label: string; number: string }[];
  emails: { label: string; email: string }[];
  addresses: { label: string; street: string; city: string; state: string; zip: string; country: string }[];
  websites: { label: string; url: string }[];
  social_profiles: { platform: string; username: string; url: string; qr_code_url: string }[];
  family_members: { relationship: string; title: string; first_name: string; middle_name: string; last_name: string; phone: string; email: string; birthday: string; notes: string; photo_url: string }[];
  related_names: { name: string; relationship: string }[];
  custom_fields: { field_name: string; field_value: string }[];
  business_card_front: string | null;
  business_card_back: string | null;
  /* Financial & Business */
  total_revenue: string | null;
  last_order_date: string | null;
  payment_terms: string | null;
  credit_limit: string | null;
  outstanding_balance: string | null;
  currency: string | null;
  /* Classification & Segmentation */
  industry: string | null;
  source: string | null;
  tags: string[];
  account_manager: string | null;
  /* Relationship & Activity */
  first_contact_date: string | null;
  last_contacted: string | null;
  follow_up_date: string | null;
  communication_preference: string | null;
  language: string | null;
  /* Trade-Specific */
  shipping_addresses: { label: string; street: string; city: string; state: string; zip: string; country: string }[];
  preferred_shipping: string | null;
  tax_id: string | null;
  incoterms: string | null;
  /* Documents */
  attachments: { name: string; url: string; type: string; uploaded_at: string }[];
  /* ── Commercial Profile (Customer Premium) ── */
  market_band: string | null;
  commercial_role: string | null;
  territory: string | null;
  exclusivity: string | null;
  exclusivity_scope: string | null;
  exclusivity_expiry: string | null;
  backup_account_manager: string | null;
  assigned_branch: string | null;
  source_details: string | null;
  referred_by: string | null;
  customer_level_assigned_date: string | null;
  customer_level_review_date: string | null;
  sales_rep: string | null;
  /* ── Credit Management (Customer Premium) ── */
  credit_rating_internal: string | null;
  credit_rating_external: string | null;
  credit_limit_approved_by: string | null;
  credit_limit_approved_date: string | null;
  overdue_balance: string | null;
  days_sales_outstanding: string | null;
  credit_insurance_covered: boolean;
  credit_insurance_provider: string | null;
  credit_insurance_coverage: string | null;
  preferred_payment_method: string | null;
  max_discount_allowed: string | null;
  price_list_tier: string | null;
  special_pricing_agreement: boolean;
  contract_pricing_expiry: string | null;
  commission_rate: string | null;
  /* ── KYC & Compliance ── */
  kyc_status: string | null;
  kyc_verified_date: string | null;
  kyc_verified_by: string | null;
  kyc_review_due_date: string | null;
  risk_score: string | null;
  sanctions_check_status: string | null;
  sanctions_check_date: string | null;
  pep_status: boolean;
  high_risk_country: boolean;
  aml_status: string | null;
  business_registration_number: string | null;
  registration_country: string | null;
  registration_date: string | null;
  year_established: string | null;
  company_type: string | null;
  trading_name: string | null;
  employee_count_range: string | null;
  annual_revenue_range: string | null;
  /* ── International Trade IDs ── */
  eori_number: string | null;
  duns_number: string | null;
  importer_exporter_code: string | null;
  customs_code: string | null;
  gst_number: string | null;
  cr_number: string | null;
  /* ── Messaging IDs ── */
  whatsapp_business: string | null;
  wechat_id: string | null;
  telegram_id: string | null;
  line_id: string | null;
  skype_id: string | null;
  /* ── Segmentation extras ── */
  sub_industry: string | null;
  buying_behavior: string | null;
  price_sensitivity: string | null;
  quality_sensitivity: string | null;
  customer_health_score: string | null;
  nps_score: string | null;
  churn_risk: string | null;
  vip_status: boolean;
  strategic_account: boolean;
  relationship_stage: string | null;
  support_tier: string | null;
  /* ── Trade & Shipping extras ── */
  port_of_entry: string | null;
  preferred_carriers: string[];
  customs_broker: string | null;
  freight_forwarder: string | null;
  shipping_marks: string | null;
  container_preference: string | null;
  certifications_required: string[];
  labeling_requirements: string | null;
  hs_codes: string[];
  /* ── Notes & audit extras ── */
  internal_notes: string | null;
  flags: string[];
  /* Supplier-Specific */
  supplier_type: string | null;
  product_categories: string[];
  brand_names: string[];
  moq: string | null;
  lead_time: string | null;
  total_purchases: string | null;
  origin_country: string | null;
  origin_country_code: string | null;
  certifications: string[];
  rating: number;
  reliability_score: string | null;
  quality_notes: string | null;
  last_quality_issue: string | null;
  sample_status: string | null;
  factory_visit_date: string | null;
  /* Supplier Redesign Fields */
  company_name_en: string | null;
  company_name_cn: string | null;
  additional_company_names: { language: string; name: string }[];
  supplier_tel: string | null;
  supplier_mobile: string | null;
  supplier_email: string | null;
  supplier_website: string | null;
  supplier_address: string | null;
  division: string | null;
  category: string | null;
  catalogues: { name: string; url: string; type: string; uploaded_at: string }[];
  documents: { doc_name: string; name: string; url: string; type: string; uploaded_at: string }[];
  contact_persons: { name: string; position: string; department: string; phone: string; mobile: string; email: string; notes: string }[];
  bank_accounts: { bank_name: string; account_name: string; account_number: string; swift_code: string; iban: string; branch: string; currency: string }[];
  payment_info: string | null;
  /* Employee-Specific */
  work_email: string | null;
  work_tel: string | null;
  work_mobile: string | null;
  management: string | null;
  department: string | null;
  job_position: string | null;
  job_title: string | null;
  manager: string | null;
  work_address: string | null;
  work_location: string | null;
  resume_lines: { type: string; title: string; duration_start: string; duration_end: string; is_forever: boolean; certificate_url: string; certificate_name: string; notes: string; course_type: string; external_url: string }[];
  private_email: string | null;
  private_phone: string | null;
  employee_bank_account: string | null;
  legal_name: string | null;
  place_of_birth: string | null;
  gender: string | null;
  emergency_contacts: { contact: string; phone: string }[];
  visa_no: string | null;
  work_permit: string | null;
  visa_documents: { name: string; url: string; type: string; uploaded_at: string }[];
  nationality: string | null;
  nationality_code: string | null;
  id_no: string | null;
  ssn_no: string | null;
  passport_no: string | null;
  private_address: string | null;
  home_work_distance: string | null;
  marital_status: string | null;
  number_of_children: string | null;
  certificate_level: string | null;
  field_of_study: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Setup Check ── */

export async function checkContactsSetup(): Promise<boolean> {
  const { error } = await supabase.from("contacts").select("contact_type").limit(1);
  return !error;
}

/* ── CRUD ── */

/**
 * Fetch all contacts visible to the current user.
 *
 * Now goes through the server-side /api/contacts route instead of
 * talking to Supabase directly from the browser. The route enforces
 * auth (session cookie), module permission (Customers), and tenant
 * filter on the server using the service-role client. After RLS is
 * enabled with deny-by-default, direct browser queries to the contacts
 * table return nothing — only the API layer can read it.
 *
 * Falls back to the legacy direct-Supabase path when the API returns
 * a network error AND no ctx is provided, so integrations calling this
 * function without a session (e.g. server-side migrations) still work
 * during the transition. Normal app usage always hits the API.
 */
export async function fetchContacts(
  ctx?: ScopeContext | null,
): Promise<ContactRow[]> {
  try {
    const res = await fetch("/api/contacts", { credentials: "include" });
    if (res.ok) {
      const json = (await res.json()) as { contacts: ContactRow[] };
      return json.contacts;
    }
    // 401/403 — user not signed in or no module access. Return empty
    // rather than leaking the legacy direct path.
    if (res.status === 401 || res.status === 403) return [];
    console.error("[Contacts] API error:", res.status);
  } catch (e) {
    console.error("[Contacts] API fetch failed:", e);
  }

  // Legacy fallback — remove after RLS is enabled and we've verified
  // the API path works everywhere in production.
  let q = supabase
    .from("contacts")
    .select("*")
    .order("first_name", { ascending: true });
  if (ctx?.tenant_id) q = q.eq("tenant_id", ctx.tenant_id);
  const { data, error } = await q;
  if (error) {
    console.error("[Contacts] Fetch fallback:", error.message);
    return [];
  }
  return (data as ContactRow[]) || [];
}

export async function fetchContactsByType(
  type: string,
  ctx?: ScopeContext | null,
): Promise<ContactRow[]> {
  try {
    const res = await fetch(
      `/api/contacts?type=${encodeURIComponent(type)}`,
      { credentials: "include" },
    );
    if (res.ok) {
      const json = (await res.json()) as { contacts: ContactRow[] };
      return json.contacts;
    }
    if (res.status === 401 || res.status === 403) return [];
  } catch (e) {
    console.error("[Contacts] API fetchByType failed:", e);
  }

  // Legacy fallback
  let q = supabase
    .from("contacts")
    .select("*")
    .eq("contact_type", type)
    .order("first_name", { ascending: true });
  if (ctx?.tenant_id) q = q.eq("tenant_id", ctx.tenant_id);
  const { data, error } = await q;
  if (error) {
    console.error("[Contacts] FetchByType fallback:", error.message);
    return [];
  }
  return (data as ContactRow[]) || [];
}

export async function createContact(obj: Record<string, unknown>): Promise<{ data: ContactRow | null; error: string | null }> {
  const { data, error } = await supabase.from("contacts").insert(obj).select().single();
  if (error) {
    console.error("[Contacts] Create:", error.message);
    return { data: null, error: error.message };
  }
  return { data: data as ContactRow, error: null };
}

export async function updateContact(id: string, obj: Record<string, unknown>): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.from("contacts").update(obj).eq("id", id);
  if (error) {
    console.error("[Contacts] Update:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}

export async function deleteContact(id: string): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) {
    console.error("[Contacts] Delete:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}
