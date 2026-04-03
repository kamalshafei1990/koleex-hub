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

export async function createContact(obj: Record<string, unknown>): Promise<ContactRow | null> {
  const { data, error } = await supabase.from("contacts").insert(obj).select().single();
  if (error) {
    console.error("[Contacts] Create:", error.message);
    return null;
  }
  return data as ContactRow;
}

export async function updateContact(id: string, obj: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from("contacts").update(obj).eq("id", id);
  if (error) {
    console.error("[Contacts] Update:", error.message);
    return false;
  }
  return true;
}

export async function deleteContact(id: string): Promise<boolean> {
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) {
    console.error("[Contacts] Delete:", error.message);
    return false;
  }
  return true;
}
