/* ---------------------------------------------------------------------------
   Contacts Admin — the browser's client for /api/contacts.

   NO DATABASE ACCESS HERE. The `contacts` table is service-role-only, so the
   legacy fallbacks that sat under each API call — insert, update, delete and a
   full list — could never have returned a row; they existed only to log a
   second error after the first one. The setup probe was the exception, and it
   was worse than useless: it always failed, so an empty directory told the
   user the table was not set up.
   --------------------------------------------------------------------------- */

import type { ScopeContext } from "./scope";

/* ── Types ── */

export interface ContactRow {
  id: string;
  /** Identity consolidation P2: optional link to the shared people record.
   *  When set, name/contact can read through people; NULL = standalone
   *  legacy contact (default, unchanged behaviour). */
  person_id?: string | null;
  contact_type: string;
  entity_type: string | null;
  photo_url: string | null;
  logo_url: string | null;
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
  /* Supplier sidebar mini-intelligence (already on the contacts row) */
  strategic_status?: string | null;
  readiness_milestone?: number | null;
  phones: { label: string; number: string }[];
  emails: { label: string; email: string }[];
  addresses: { label: string; street: string; city: string; state: string; zip: string; country: string }[];
  websites: { label: string; url: string }[];
  social_profiles: { platform: string; username: string; url: string; qr_code_url: string }[];
  messaging_channels?: { platform: string; value: string }[];
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
  wechat_qr: string | null;
  whatsapp_qr: string | null;
  telegram_qr: string | null;
  line_qr: string | null;
  skype_qr: string | null;
  qq_id: string | null;
  qq_qr: string | null;
  dingtalk_id: string | null;
  dingtalk_qr: string | null;
  messenger_id: string | null;
  messenger_qr: string | null;
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
  wechat_official_account: string | null;
  wechat_official_account_qr: string | null;
  wechat_sales_group_available: boolean | null;
  wecom_support_available: boolean | null;
  supplier_address: string | null;
  supplier_postal_code: string | null;
  division: string | null;
  category: string | null;
  catalogues: { name: string; url: string; type: string; uploaded_at: string }[];
  documents: { doc_name: string; name: string; url: string; type: string; uploaded_at: string }[];
  contact_persons: { name: string; name_cn?: string; position: string; department: string; phone: string; mobile: string; email: string; notes: string; whatsapp?: string; wechat_id?: string; wechat_qr?: string }[];
  bank_accounts: { bank_name: string; account_name: string; account_number: string; swift_code: string; iban: string; branch: string; currency: string; info_image?: string }[];
  payment_info: string | null;
  wechat_pay_id: string | null;
  wechat_pay_qr: string | null;
  alipay_id: string | null;
  alipay_qr: string | null;
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
  business_license_image: string | null;
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

/** Is the contacts table reachable? Only the "table is not set up" screen
 *  depends on this. It used to select a row from `contacts` in the BROWSER —
 *  a table that is service-role-only, so the probe always failed and the
 *  directory told the user it was not set up whenever it was merely empty. */
export async function checkContactsSetup(): Promise<boolean> {
  try {
    const res = await fetch("/api/contacts?probe=1", { credentials: "include" });
    if (!res.ok) return false;
    const json = (await res.json()) as { ok?: boolean };
    return json.ok === true;
  } catch {
    /* Offline or a blocked request is not "the table does not exist" — say
       yes, so a network blip never shows a setup error over real data. */
    return true;
  }
}

/* ── CRUD ── */

/**
 * Every contact visible to the current user.
 *
 * The route enforces auth (session cookie), module permission and the tenant
 * filter with the service-role client. There is no ScopeContext parameter any
 * more: the server reads the session, and a scope the browser assembled for
 * itself was never consulted.
 */
export async function fetchContacts(): Promise<ContactRow[]> {
  try {
    const res = await fetch("/api/contacts", { credentials: "include" });
    if (res.ok) {
      const json = (await res.json()) as { contacts: ContactRow[] };
      return json.contacts;
    }
    // 401/403 — user not signed in or no module access. Return empty
    // rather than leaking the legacy direct path.
    if (res.status !== 401 && res.status !== 403) {
      console.error("[Contacts] API error:", res.status);
    }
    return [];
  } catch (e) {
    console.error("[Contacts] API fetch failed:", e);
    return [];
  }
}

/**
 * Lazy-load the avatar images (logo_url / photo_url) the directory list drops to
 * stay under the response-size limit. Fetched in small batches and returned as a
 * map keyed by contact id, so the caller can merge them into the rendered rows.
 */
/* Measured on prod: /contacts fired the SAME avatar batch twice, 7ms apart —
   two callers hydrating the same rows with no coalescing between them, so the
   second request was 100% waste. Keyed by the exact batch, an in-flight
   request is shared instead of duplicated. Short-lived by design: the entry
   is dropped the moment it settles, so this never serves a stale avatar. */
const avatarInflight = new Map<string, Promise<{ id: string; logo_url: string | null; photo_url: string | null }[]>>();

function fetchAvatarBatch(batch: string[]) {
  const key = batch.join(",");
  const existing = avatarInflight.get(key);
  if (existing) return existing;
  const p = (async () => {
    const res = await fetch(`/api/contacts/avatars?ids=${encodeURIComponent(key)}`, { credentials: "include" });
    if (!res.ok) return [];
    const json = (await res.json()) as { avatars?: { id: string; logo_url: string | null; photo_url: string | null }[] };
    return json.avatars ?? [];
  })().finally(() => { avatarInflight.delete(key); });
  avatarInflight.set(key, p);
  return p;
}

export async function fetchContactAvatars(
  ids: string[],
): Promise<Record<string, { logo_url: string | null; photo_url: string | null }>> {
  const out: Record<string, { logo_url: string | null; photo_url: string | null }> = {};
  const unique = [...new Set(ids.filter(Boolean))];
  /* 30 → 120: on /customers the 30-id batches turned one avatar hydration
     into 8 sequential requests (SYS-2). 120 uuids ≈ 4.5 KB of query string —
     comfortably inside URL limits — so a full list is 1-2 requests. */
  const CHUNK = 120;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const batch = unique.slice(i, i + CHUNK);
    try {
      for (const a of await fetchAvatarBatch(batch)) {
        out[a.id] = { logo_url: a.logo_url ?? null, photo_url: a.photo_url ?? null };
      }
    } catch { /* a failed batch just leaves those avatars as placeholders */ }
  }
  return out;
}

export async function fetchContactsByType(
  type: string,
  ctx?: ScopeContext | null,
  opts?: { fresh?: boolean },
): Promise<ContactRow[]> {
  try {
    /* The API response carries `Cache-Control: max-age=30, stale-while-revalidate`
       for fast navigation. Background revalidation (focus / interval) passes
       `fresh` so it bypasses that HTTP cache and always reads the true count —
       otherwise the browser would keep answering from the stale cached body. */
    const res = await fetch(
      `/api/contacts?type=${encodeURIComponent(type)}`,
      { credentials: "include", ...(opts?.fresh ? { cache: "no-store" as RequestCache } : {}) },
    );
    if (res.ok) {
      const json = (await res.json()) as { contacts: ContactRow[] };
      return json.contacts;
    }
    // 401/403 or any other non-2xx → empty. There is deliberately NO legacy
    // Supabase-client fallback: the `contacts` table is service-role-only, so a
    // browser-client read always fails RLS — it could only ever add a second
    // error to the console. The caller (loadContacts) keeps the cached view.
    return [];
  } catch (e) {
    /* Network / HMR blip. Background revalidation (fresh) swallows it silently —
       the caller keeps the current list, and logging here would spam the console
       (Next.js Dev Tools counts every console.error as an "issue"). A cold load
       warns once for observability; it's rare and the caller degrades gracefully. */
    if (!opts?.fresh) console.warn("[Contacts] list fetch failed — keeping prior view:", e instanceof Error ? e.message : e);
    return [];
  }
}

export async function createContact(obj: Record<string, unknown>): Promise<{ data: ContactRow | null; error: string | null }> {
  try {
    const res = await fetch("/api/contacts", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obj),
    });
    if (res.ok) {
      const json = (await res.json()) as { contact: ContactRow | null };
      return { data: json.contact, error: null };
    }
    if (res.status === 401 || res.status === 403) {
      return { data: null, error: "Not authorized" };
    }
    const err = await res.json().catch(() => ({ error: "Failed" }));
    return { data: null, error: (err as { error?: string }).error ?? "Failed" };
  } catch (e) {
    console.error("[Contacts] createContact failed:", e);
    return { data: null, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function updateContact(id: string, obj: Record<string, unknown>): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch("/api/contacts/" + id, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obj),
    });
    if (res.ok) return { ok: true, error: null };
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      return { ok: false, error: "Not authorized" };
    }
    const err = await res.json().catch(() => ({ error: "Failed" }));
    return { ok: false, error: (err as { error?: string }).error ?? "Failed" };
  } catch (e) {
    console.error("[Contacts] updateContact failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function deleteContact(id: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch("/api/contacts/" + id, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) return { ok: true, error: null };
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      return { ok: false, error: "Not authorized" };
    }
    const err = await res.json().catch(() => ({ error: "Failed" }));
    return { ok: false, error: (err as { error?: string }).error ?? "Failed" };
  } catch (e) {
    console.error("[Contacts] deleteContact failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
