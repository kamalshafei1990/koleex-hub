/* ---------------------------------------------------------------------------
   Contacts Admin — Supabase CRUD for the contacts module.
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";

/* ── Types ── */

export interface ContactRow {
  id: string;
  contact_type: string;
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
  created_at: string;
  updated_at: string;
}

/* ── Setup Check ── */

export async function checkContactsSetup(): Promise<boolean> {
  const { error } = await supabase.from("contacts").select("contact_type").limit(1);
  return !error;
}

/* ── CRUD ── */

export async function fetchContacts(): Promise<ContactRow[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .order("first_name", { ascending: true });
  if (error) {
    console.error("[Contacts] Fetch:", error.message);
    return [];
  }
  return (data as ContactRow[]) || [];
}

export async function fetchContactsByType(type: string): Promise<ContactRow[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("contact_type", type)
    .order("first_name", { ascending: true });
  if (error) {
    console.error("[Contacts] FetchByType:", error.message);
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
