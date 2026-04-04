"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, Search, X, Trash2, Edit3, Save, Phone, Mail,
  MapPin, Globe, Calendar, Users, Building2, User, Crown, ChevronDown,
  ChevronRight, Copy, Check, AlertTriangle, Camera, Minus, UserPlus,
  Briefcase, Heart, Share2, FileText, Star, Shield, Gem, Award,
  CreditCard, BadgeCheck, UserCheck, TrendingUp, MapPinned,
  DollarSign, Tag, MessageSquare, Languages, Ship, FileCheck, Paperclip,
  Clock, CalendarPlus, CalendarCheck, Receipt, Wallet, HandCoins,
  Factory, Target, UserCog, Hash, Package, Boxes, Timer, StarIcon,
  ShieldCheck, Truck, Warehouse, ClipboardCheck, Eye,
  Download, BookOpen, Landmark, ExternalLink, ImageIcon, FilePlus,
  GraduationCap, ShieldAlert, Plane, Home, HelpCircle,
} from "lucide-react";
import {
  checkContactsSetup, fetchContacts, createContact, updateContact, deleteContact,
  type ContactRow,
} from "@/lib/contacts-admin";
import { Country, State, City } from "country-state-city";

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type ContactType = "customer" | "supplier" | "company" | "people" | "employee";
type CustomerTier = "end_user" | "silver" | "gold" | "platinum" | "diamond";
type ViewMode = "list" | "detail" | "form";

interface PhoneEntry { label: string; number: string }
interface EmailEntry { label: string; email: string }
interface AddressEntry { label: string; street: string; city: string; state: string; zip: string; country: string }
interface WebsiteEntry { label: string; url: string }
interface SocialProfile { platform: string; username: string; url: string; qr_code_url: string }
interface FamilyMember {
  relationship: string; title: string; first_name: string; middle_name: string;
  last_name: string; phone: string; email: string; birthday: string; notes: string; photo_url: string;
}
interface RelatedName { name: string; relationship: string }
interface CustomField { field_name: string; field_value: string }
interface Attachment { name: string; url: string; type: string; uploaded_at: string }

interface ResumeLineEntry {
  type: "experience" | "education" | "training" | "certification";
  title: string;
  duration_start: string;
  duration_end: string;
  is_forever: boolean;
  certificate_url: string;
  certificate_name: string;
  notes: string;
  course_type: string;
  external_url: string;
}

interface EmergencyContactEntry {
  contact: string;
  phone: string;
}

interface VisaDocEntry {
  name: string;
  url: string;
  type: string;
  uploaded_at: string;
}

interface ContactForm {
  contact_type: ContactType;
  entity_type: "person" | "company" | "";
  photo_url: string;
  title: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  company: string;
  position: string;
  country: string;
  country_code: string;
  province: string;
  province_code: string;
  city: string;
  birthday: string;
  notes: string;
  is_active: boolean;
  customer_type: CustomerTier | "";
  phones: PhoneEntry[];
  emails: EmailEntry[];
  addresses: AddressEntry[];
  websites: WebsiteEntry[];
  social_profiles: SocialProfile[];
  family_members: FamilyMember[];
  related_names: RelatedName[];
  custom_fields: CustomField[];
  business_card_front: string;
  business_card_back: string;
  /* ── Financial & Business ── */
  total_revenue: string;
  last_order_date: string;
  payment_terms: string;
  credit_limit: string;
  outstanding_balance: string;
  currency: string;
  /* ── Classification & Segmentation ── */
  industry: string;
  source: string;
  tags: string[];
  account_manager: string;
  /* ── Relationship & Activity ── */
  first_contact_date: string;
  last_contacted: string;
  follow_up_date: string;
  communication_preference: string;
  language: string;
  /* ── Trade-Specific ── */
  shipping_addresses: AddressEntry[];
  preferred_shipping: string;
  tax_id: string;
  incoterms: string;
  /* ── Documents ── */
  attachments: Attachment[];
  /* ── Supplier-Specific ── */
  supplier_type: string;
  product_categories: string[];
  brand_names: string[];
  moq: string;
  lead_time: string;
  total_purchases: string;
  origin_country: string;
  origin_country_code: string;
  certifications: string[];
  rating: number;
  reliability_score: string;
  quality_notes: string;
  last_quality_issue: string;
  sample_status: string;
  factory_visit_date: string;
  /* ── Supplier Redesign ── */
  company_name_en: string;
  company_name_cn: string;
  additional_company_names: { language: string; name: string }[];
  supplier_tel: string;
  supplier_mobile: string;
  supplier_email: string;
  supplier_website: string;
  supplier_address: string;
  division: string;
  category: string;
  catalogues: { name: string; url: string; type: string; uploaded_at: string }[];
  documents: { doc_name: string; name: string; url: string; type: string; uploaded_at: string }[];
  contact_persons: { name: string; position: string; department: string; phone: string; mobile: string; email: string; notes: string }[];
  bank_accounts: { bank_name: string; account_name: string; account_number: string; swift_code: string; iban: string; branch: string; currency: string }[];
  payment_info: string;
  /* ── Employee-Specific ── */
  work_email: string;
  work_tel: string;
  work_mobile: string;
  management: string;
  department: string;
  job_position: string;
  job_title: string;
  manager: string;
  work_address: string;
  work_location: string;
  resume_lines: ResumeLineEntry[];
  private_email: string;
  private_phone: string;
  employee_bank_account: string;
  legal_name: string;
  place_of_birth: string;
  gender: string;
  emergency_contacts: EmergencyContactEntry[];
  visa_no: string;
  work_permit: string;
  visa_documents: VisaDocEntry[];
  nationality: string;
  nationality_code: string;
  id_no: string;
  ssn_no: string;
  passport_no: string;
  private_address: string;
  home_work_distance: string;
  marital_status: string;
  number_of_children: string;
  certificate_level: string;
  field_of_study: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const CONTACT_TYPES: { value: ContactType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "customer", label: "Customer", icon: <Crown size={16} />, color: "text-amber-400" },
  { value: "supplier", label: "Supplier", icon: <Building2 size={16} />, color: "text-blue-400" },
  { value: "company", label: "Company", icon: <Briefcase size={16} />, color: "text-purple-400" },
  { value: "employee", label: "Employee", icon: <BadgeCheck size={16} />, color: "text-teal-400" },
  { value: "people", label: "People", icon: <User size={16} />, color: "text-green-400" },
];

const CUSTOMER_TIERS: { value: CustomerTier; label: string; color: string; bg: string }[] = [
  { value: "end_user", label: "End User", color: "text-zinc-300", bg: "bg-zinc-700" },
  { value: "silver", label: "Silver", color: "text-slate-300", bg: "bg-slate-600" },
  { value: "gold", label: "Gold", color: "text-amber-300", bg: "bg-amber-700/60" },
  { value: "platinum", label: "Platinum", color: "text-cyan-200", bg: "bg-cyan-800/50" },
  { value: "diamond", label: "Diamond", color: "text-violet-200", bg: "bg-violet-700/50" },
];

const TITLES = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Eng.", "Sheikh", "H.E."];

const PHONE_LABELS = ["mobile", "home", "work", "main", "work fax", "home fax", "pager", "other"];
const EMAIL_LABELS = ["home", "work", "iCloud", "other"];
const ADDRESS_LABELS = ["home", "work", "other"];
const WEBSITE_LABELS = ["homepage", "work", "blog", "other"];
const SOCIAL_PLATFORMS = ["WhatsApp", "WeChat", "LinkedIn", "Instagram", "Facebook", "Twitter/X", "Telegram", "Snapchat", "TikTok", "Skype", "Other"];
const RELATED_PEOPLE_LABELS = ["Parent", "Father", "Mother", "Brother", "Sister", "Child", "Son", "Daughter", "Spouse", "Friend", "Assistant", "Manager", "Other"];

const INDUSTRIES = [
  "Agriculture", "Automotive", "Banking & Finance", "Chemicals", "Construction",
  "Consumer Goods", "E-Commerce", "Education", "Electronics", "Energy & Utilities",
  "F&B", "Fashion & Apparel", "Healthcare", "Hospitality", "IT & Technology",
  "Logistics & Transport", "Manufacturing", "Media & Entertainment", "Mining",
  "Oil & Gas", "Pharmaceuticals", "Real Estate", "Retail", "Telecom", "Other",
];
const LEAD_SOURCES = [
  "Referral", "Website", "Exhibition / Trade Show", "Cold Call", "Social Media",
  "Email Campaign", "LinkedIn", "Partner", "Walk-in", "Advertisement", "Other",
];
const PAYMENT_TERMS_OPTIONS = [
  "Prepaid", "COD", "Net 15", "Net 30", "Net 45", "Net 60", "Net 90",
  "EOM", "2/10 Net 30", "CIA", "CWO", "Upon Receipt", "Custom",
];
const CURRENCIES = [
  "USD", "EUR", "GBP", "CNY", "JPY", "AED", "SAR", "EGP", "INR", "BRL",
  "AUD", "CAD", "CHF", "KRW", "SGD", "MYR", "THB", "IDR", "PHP", "VND",
  "TRY", "RUB", "ZAR", "NGN", "KES", "MXN", "COP", "ARS", "CLP", "PEN",
];
const SHIPPING_METHODS = ["Sea Freight", "Air Freight", "Land / Truck", "Express / Courier", "Rail", "Multimodal", "Other"];
const INCOTERMS_OPTIONS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];
const COMM_PREFERENCES = ["Phone", "Email", "WhatsApp", "WeChat", "Telegram", "SMS", "In-Person", "Video Call"];
const LANGUAGES = [
  "English", "Arabic", "Chinese (Mandarin)", "Chinese (Cantonese)", "Spanish", "French",
  "German", "Portuguese", "Russian", "Japanese", "Korean", "Hindi", "Turkish",
  "Italian", "Dutch", "Thai", "Vietnamese", "Indonesian", "Malay", "Tagalog",
];

const SUPPLIER_TYPES = [
  "Manufacturer", "Distributor", "Wholesaler", "Agent", "Trading Company",
  "Service Provider", "Freelancer", "OEM", "ODM", "Other",
];
const SUPPLIER_SOURCES = [
  "Alibaba", "Made-in-China", "Global Sources", "Exhibition / Trade Show",
  "Referral", "Website", "LinkedIn", "Cold Call", "Partner", "Agent", "Other",
];
const SAMPLE_STATUSES = ["None", "Requested", "Received", "Approved", "Rejected"];
const CERTIFICATIONS_LIST = [
  "ISO 9001", "ISO 14001", "ISO 45001", "CE", "FDA", "BSCI", "SEDEX",
  "SA8000", "GMP", "HACCP", "UL", "RoHS", "REACH", "FSC", "GOTS", "Other",
];

/** Countries where Province/State is commonly used in addresses */
const COUNTRIES_WITH_STATES = new Set([
  "US", "CA", "AU", "IN", "BR", "MX", "CN", "JP", "RU", "AR", "CL",
  "CO", "VE", "PE", "NG", "ZA", "MY", "ID", "PH", "TH", "KR", "MM",
  "PK", "BD", "VN", "DE", "AT", "CH", "IT", "ES", "NL", "BE", "AE",
  "SA", "IR", "IQ", "TR", "UA", "PL", "RO", "CZ", "SE", "NO", "FI",
  "NZ", "KE", "TZ", "ET", "GH",
]);

const EMPTY_FORM: ContactForm = {
  contact_type: "customer",
  entity_type: "",
  photo_url: "",
  title: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  company: "",
  position: "",
  country: "",
  country_code: "",
  province: "",
  province_code: "",
  city: "",
  birthday: "",
  notes: "",
  is_active: true,
  customer_type: "",
  phones: [],
  emails: [],
  addresses: [],
  websites: [],
  social_profiles: [],
  family_members: [],
  related_names: [],
  custom_fields: [],
  business_card_front: "",
  business_card_back: "",
  /* Financial & Business */
  total_revenue: "",
  last_order_date: "",
  payment_terms: "",
  credit_limit: "",
  outstanding_balance: "",
  currency: "",
  /* Classification & Segmentation */
  industry: "",
  source: "",
  tags: [],
  account_manager: "",
  /* Relationship & Activity */
  first_contact_date: "",
  last_contacted: "",
  follow_up_date: "",
  communication_preference: "",
  language: "",
  /* Trade-Specific */
  shipping_addresses: [],
  preferred_shipping: "",
  tax_id: "",
  incoterms: "",
  /* Documents */
  attachments: [],
  /* Supplier-Specific */
  supplier_type: "",
  product_categories: [],
  brand_names: [],
  moq: "",
  lead_time: "",
  total_purchases: "",
  origin_country: "",
  origin_country_code: "",
  certifications: [],
  rating: 0,
  reliability_score: "",
  quality_notes: "",
  last_quality_issue: "",
  sample_status: "",
  factory_visit_date: "",
  /* Supplier Redesign */
  company_name_en: "",
  company_name_cn: "",
  additional_company_names: [],
  supplier_tel: "",
  supplier_mobile: "",
  supplier_email: "",
  supplier_website: "",
  supplier_address: "",
  division: "",
  category: "",
  catalogues: [],
  documents: [],
  contact_persons: [],
  bank_accounts: [],
  payment_info: "",
  /* Employee-Specific */
  work_email: "",
  work_tel: "",
  work_mobile: "",
  management: "",
  department: "",
  job_position: "",
  job_title: "",
  manager: "",
  work_address: "",
  work_location: "",
  resume_lines: [],
  private_email: "",
  private_phone: "",
  employee_bank_account: "",
  legal_name: "",
  place_of_birth: "",
  gender: "",
  emergency_contacts: [],
  visa_no: "",
  work_permit: "",
  visa_documents: [],
  nationality: "",
  nationality_code: "",
  id_no: "",
  ssn_no: "",
  passport_no: "",
  private_address: "",
  home_work_distance: "",
  marital_status: "",
  number_of_children: "",
  certificate_level: "",
  field_of_study: "",
};

const MIGRATION_SQL = `-- Contacts Module Migration for Koleex HUB
-- Run this in Supabase Dashboard > SQL Editor > New Query

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_type text DEFAULT 'people';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS middle_name text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "position" text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS birthday date;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS customer_type text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS province text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS province_code text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phones jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS emails jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS addresses jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS websites jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS social_profiles jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS family_members jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS related_names jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS business_card_front text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS business_card_back text;
-- Financial & Business
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS total_revenue text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_order_date date;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS payment_terms text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS credit_limit text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS outstanding_balance text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';
-- Classification & Segmentation
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS industry text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS account_manager text;
-- Relationship & Activity
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS first_contact_date date;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contacted date;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS follow_up_date date;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS communication_preference text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS language text;
-- Trade-Specific
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS shipping_addresses jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferred_shipping text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tax_id text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS incoterms text;
-- Documents
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
-- Supplier-Specific
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS supplier_type text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS product_categories jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS brand_names jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS moq text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_time text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS total_purchases text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS origin_country text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS origin_country_code text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS certifications jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS rating integer DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS reliability_score text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS quality_notes text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_quality_issue date;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sample_status text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS factory_visit_date date;
-- Supplier Redesign Fields
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_name_en text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_name_cn text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS additional_company_names jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS supplier_tel text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS supplier_mobile text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS supplier_email text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS supplier_website text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS supplier_address text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS division text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS catalogues jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_persons jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS bank_accounts jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS payment_info text;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts (contact_type);
CREATE INDEX IF NOT EXISTS idx_contacts_customer_type ON contacts (customer_type);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts (first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_contacts_active ON contacts (is_active);

-- RLS Policies (allow anon key full access)
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow public select" ON contacts FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Allow public insert" ON contacts FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow public update" ON contacts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow public delete" ON contacts FOR DELETE USING (true);`;

const RLS_FIX_SQL = `-- Fix: Allow anon key to read/write contacts
-- Run this in Supabase Dashboard > SQL Editor > New Query

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contacts' AND policyname='Allow public select') THEN
    CREATE POLICY "Allow public select" ON contacts FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contacts' AND policyname='Allow public insert') THEN
    CREATE POLICY "Allow public insert" ON contacts FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contacts' AND policyname='Allow public update') THEN
    CREATE POLICY "Allow public update" ON contacts FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contacts' AND policyname='Allow public delete') THEN
    CREATE POLICY "Allow public delete" ON contacts FOR DELETE USING (true);
  END IF;
END $$;`;

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

function buildFullName(f: ContactForm): string {
  return [f.title, f.first_name, f.middle_name, f.last_name].filter(Boolean).join(" ").trim();
}

function buildDisplayName(f: ContactForm): string {
  if (f.contact_type === "supplier" && f.company_name_en) return f.company_name_en;
  if (f.first_name || f.last_name) return [f.first_name, f.last_name].filter(Boolean).join(" ");
  if (f.company) return f.company;
  return "Unnamed Contact";
}

function getInitials(contact: ContactRow): string {
  if (contact.contact_type === "supplier") {
    const en = (contact as any).company_name_en || "";
    if (en) return en.slice(0, 2).toUpperCase();
  }
  if ((contact as any).entity_type === "company" && contact.company) {
    return contact.company.slice(0, 2).toUpperCase();
  }
  const fn = contact.first_name || "";
  const ln = contact.last_name || "";
  if (fn && ln) return (fn[0] + ln[0]).toUpperCase();
  if (fn) return fn.slice(0, 2).toUpperCase();
  if (contact.company) return contact.company.slice(0, 2).toUpperCase();
  return "?";
}

function contactDisplayName(c: ContactRow): string {
  if (c.contact_type === "supplier") {
    const en = c.company_name_en || "";
    if (en) return en;
  }
  if (c.contact_type === "company" && c.company) return c.company;
  if (c.entity_type === "company" && c.company) return c.company;
  if (c.first_name || c.last_name) return [c.first_name, c.last_name].filter(Boolean).join(" ");
  if (c.display_name) return c.display_name;
  if (c.company) return c.company;
  return "Unnamed";
}

function contactSortKey(c: ContactRow): string {
  if (c.contact_type === "supplier") {
    const en = c.company_name_en || "";
    if (en) return en.toLowerCase();
  }
  if (c.contact_type === "company" && c.company) return c.company.toLowerCase();
  if (c.entity_type === "company" && c.company) return c.company.toLowerCase();
  return (c.first_name || c.last_name || c.company || c.display_name || "zzz").toLowerCase();
}

function getTypeColor(type: string): string {
  return CONTACT_TYPES.find(t => t.value === type)?.color || "text-zinc-400";
}

function getTierInfo(tier: string | null) {
  return CUSTOMER_TIERS.find(t => t.value === tier);
}

/** Derive flag emoji from a 2-letter ISO country code */
function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return "";
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    ...Array.from(upper).map(c => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

/** Compress an image file to a smaller base64 string for faster saves */
async function compressImage(file: File, maxWidth = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Read any file as a base64 data URL (for PDFs and non-image files) */
async function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(file);
  });
}

/** Convert a base64 data URL to a Blob URL that browsers can open/download */
function dataURLtoBlobURL(dataURL: string): string {
  try {
    const [header, data] = dataURL.split(",");
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
    const binary = atob(data);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    const blob = new Blob([array], { type: mime });
    return URL.createObjectURL(blob);
  } catch {
    return dataURL;
  }
}

/** Open a data URL file in a new browser tab (works in Safari/Chrome/Firefox) */
function openFilePreview(dataURL: string) {
  const blobURL = dataURLtoBlobURL(dataURL);
  window.open(blobURL, "_blank");
}

/** Trigger a download for a data URL file */
function downloadFile(dataURL: string, filename: string) {
  const blobURL = dataURLtoBlobURL(dataURL);
  const a = document.createElement("a");
  a.href = blobURL;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobURL), 1000);
}

function contactToForm(c: ContactRow): ContactForm {
  return {
    contact_type: (c.contact_type as ContactType) || "people",
    entity_type: (c.entity_type as "person" | "company" | "") || "",
    photo_url: c.photo_url || "",
    title: c.title || "",
    first_name: c.first_name || "",
    middle_name: c.middle_name || "",
    last_name: c.last_name || "",
    company: c.company || "",
    position: c.position || "",
    country: c.country || "",
    country_code: c.country_code || "",
    province: c.province || "",
    province_code: c.province_code || "",
    city: c.city || "",
    birthday: c.birthday || "",
    notes: c.notes || "",
    is_active: c.is_active ?? true,
    customer_type: (c.customer_type as CustomerTier) || "",
    phones: Array.isArray(c.phones) ? c.phones : [],
    emails: Array.isArray(c.emails) ? c.emails : [],
    addresses: Array.isArray(c.addresses) ? c.addresses : [],
    websites: Array.isArray(c.websites) ? c.websites : [],
    social_profiles: Array.isArray(c.social_profiles) ? c.social_profiles : [],
    family_members: Array.isArray(c.family_members) ? c.family_members : [],
    related_names: Array.isArray(c.related_names) ? c.related_names : [],
    custom_fields: Array.isArray(c.custom_fields) ? c.custom_fields : [],
    business_card_front: c.business_card_front || "",
    business_card_back: c.business_card_back || "",
    /* Financial & Business */
    total_revenue: c.total_revenue || "",
    last_order_date: c.last_order_date || "",
    payment_terms: c.payment_terms || "",
    credit_limit: c.credit_limit || "",
    outstanding_balance: c.outstanding_balance || "",
    currency: c.currency || "",
    /* Classification & Segmentation */
    industry: c.industry || "",
    source: c.source || "",
    tags: Array.isArray(c.tags) ? c.tags : [],
    account_manager: c.account_manager || "",
    /* Relationship & Activity */
    first_contact_date: c.first_contact_date || "",
    last_contacted: c.last_contacted || "",
    follow_up_date: c.follow_up_date || "",
    communication_preference: c.communication_preference || "",
    language: c.language || "",
    /* Trade-Specific */
    shipping_addresses: Array.isArray(c.shipping_addresses) ? c.shipping_addresses : [],
    preferred_shipping: c.preferred_shipping || "",
    tax_id: c.tax_id || "",
    incoterms: c.incoterms || "",
    /* Documents */
    attachments: Array.isArray(c.attachments) ? c.attachments : [],
    /* Supplier-Specific */
    supplier_type: c.supplier_type || "",
    product_categories: Array.isArray(c.product_categories) ? c.product_categories : [],
    brand_names: Array.isArray(c.brand_names) ? c.brand_names : [],
    moq: c.moq || "",
    lead_time: c.lead_time || "",
    total_purchases: c.total_purchases || "",
    origin_country: c.origin_country || "",
    origin_country_code: c.origin_country_code || "",
    certifications: Array.isArray(c.certifications) ? c.certifications : [],
    rating: c.rating || 0,
    reliability_score: c.reliability_score || "",
    quality_notes: c.quality_notes || "",
    last_quality_issue: c.last_quality_issue || "",
    sample_status: c.sample_status || "",
    factory_visit_date: c.factory_visit_date || "",
    /* Supplier Redesign */
    company_name_en: c.company_name_en || "",
    company_name_cn: c.company_name_cn || "",
    additional_company_names: Array.isArray(c.additional_company_names) ? c.additional_company_names : [],
    supplier_tel: c.supplier_tel || "",
    supplier_mobile: c.supplier_mobile || "",
    supplier_email: c.supplier_email || "",
    supplier_website: c.supplier_website || "",
    supplier_address: c.supplier_address || "",
    division: c.division || "",
    category: c.category || "",
    catalogues: Array.isArray(c.catalogues) ? c.catalogues : [],
    documents: Array.isArray(c.documents) ? c.documents : [],
    contact_persons: Array.isArray(c.contact_persons) ? c.contact_persons : [],
    bank_accounts: Array.isArray(c.bank_accounts) ? c.bank_accounts : [],
    payment_info: c.payment_info || "",
    /* Employee-Specific */
    work_email: c.work_email || "",
    work_tel: c.work_tel || "",
    work_mobile: c.work_mobile || "",
    management: c.management || "",
    department: c.department || "",
    job_position: c.job_position || "",
    job_title: c.job_title || "",
    manager: c.manager || "",
    work_address: c.work_address || "",
    work_location: c.work_location || "",
    resume_lines: Array.isArray(c.resume_lines) ? (c.resume_lines as ResumeLineEntry[]) : [],
    private_email: c.private_email || "",
    private_phone: c.private_phone || "",
    employee_bank_account: c.employee_bank_account || "",
    legal_name: c.legal_name || "",
    place_of_birth: c.place_of_birth || "",
    gender: c.gender || "",
    emergency_contacts: Array.isArray(c.emergency_contacts) ? c.emergency_contacts : [],
    visa_no: c.visa_no || "",
    work_permit: c.work_permit || "",
    visa_documents: Array.isArray(c.visa_documents) ? c.visa_documents : [],
    nationality: c.nationality || "",
    nationality_code: c.nationality_code || "",
    id_no: c.id_no || "",
    ssn_no: c.ssn_no || "",
    passport_no: c.passport_no || "",
    private_address: c.private_address || "",
    home_work_distance: c.home_work_distance || "",
    marital_status: c.marital_status || "",
    number_of_children: c.number_of_children || "",
    certificate_level: c.certificate_level || "",
    field_of_study: c.field_of_study || "",
  };
}

function formToRow(f: ContactForm): Record<string, unknown> {
  const fullName = buildFullName(f);
  const displayName = buildDisplayName(f);
  return {
    contact_type: f.contact_type,
    entity_type: f.entity_type || (f.contact_type === "company" ? "company" : "person"),
    photo_url: f.photo_url || null,
    title: f.title || null,
    first_name: f.first_name || null,
    middle_name: f.middle_name || null,
    last_name: f.last_name || null,
    full_name: fullName || null,
    display_name: displayName,
    company: f.company || f.company_name_en || null,
    position: f.position || null,
    email: f.emails[0]?.email || f.supplier_email || null,
    phone: f.phones[0]?.number || f.supplier_tel || f.supplier_mobile || null,
    country: f.country || null,
    country_code: f.country_code || null,
    province: f.province || null,
    province_code: f.province_code || null,
    city: f.city || null,
    birthday: f.birthday || null,
    notes: f.notes || null,
    website: f.websites[0]?.url || f.supplier_website || null,
    is_active: f.is_active,
    customer_type: f.contact_type === "customer" && f.is_active ? (f.customer_type || null) : null,
    phones: f.phones,
    emails: f.emails,
    addresses: f.addresses,
    websites: f.websites,
    social_profiles: f.social_profiles,
    family_members: f.family_members,
    related_names: f.related_names,
    custom_fields: f.custom_fields,
    business_card_front: f.business_card_front || null,
    business_card_back: f.business_card_back || null,
    /* Financial & Business */
    total_revenue: f.total_revenue || null,
    last_order_date: f.last_order_date || null,
    payment_terms: f.payment_terms || null,
    credit_limit: f.credit_limit || null,
    outstanding_balance: f.outstanding_balance || null,
    currency: f.currency || null,
    /* Classification & Segmentation */
    industry: f.industry || null,
    source: f.source || null,
    tags: f.tags.length > 0 ? f.tags : null,
    account_manager: f.account_manager || null,
    /* Relationship & Activity */
    first_contact_date: f.first_contact_date || null,
    last_contacted: f.last_contacted || null,
    follow_up_date: f.follow_up_date || null,
    communication_preference: f.communication_preference || null,
    language: f.language || null,
    /* Trade-Specific */
    shipping_addresses: f.shipping_addresses.length > 0 ? f.shipping_addresses : null,
    preferred_shipping: f.preferred_shipping || null,
    tax_id: f.tax_id || null,
    incoterms: f.incoterms || null,
    /* Documents */
    attachments: f.attachments.length > 0 ? f.attachments : null,
    /* Supplier-Specific */
    supplier_type: f.supplier_type || null,
    product_categories: f.product_categories.length > 0 ? f.product_categories : null,
    brand_names: f.brand_names.length > 0 ? f.brand_names : null,
    moq: f.moq || null,
    lead_time: f.lead_time || null,
    total_purchases: f.total_purchases || null,
    origin_country: f.origin_country || null,
    origin_country_code: f.origin_country_code || null,
    certifications: f.certifications.length > 0 ? f.certifications : null,
    rating: f.rating || null,
    reliability_score: f.reliability_score || null,
    quality_notes: f.quality_notes || null,
    last_quality_issue: f.last_quality_issue || null,
    sample_status: f.sample_status || null,
    factory_visit_date: f.factory_visit_date || null,
    /* Supplier Redesign */
    company_name_en: f.company_name_en || null,
    company_name_cn: f.company_name_cn || null,
    additional_company_names: f.additional_company_names.length > 0 ? f.additional_company_names : null,
    supplier_tel: f.supplier_tel || null,
    supplier_mobile: f.supplier_mobile || null,
    supplier_email: f.supplier_email || null,
    supplier_website: f.supplier_website || null,
    supplier_address: f.supplier_address || null,
    division: f.division || null,
    category: f.category || null,
    catalogues: f.catalogues.length > 0 ? f.catalogues : null,
    documents: f.documents.length > 0 ? f.documents : null,
    contact_persons: f.contact_persons.length > 0 ? f.contact_persons : null,
    bank_accounts: f.bank_accounts.length > 0 ? f.bank_accounts : null,
    payment_info: f.payment_info || null,
    /* Employee-Specific */
    work_email: f.work_email || null,
    work_tel: f.work_tel || null,
    work_mobile: f.work_mobile || null,
    management: f.management || null,
    department: f.department || null,
    job_position: f.job_position || null,
    job_title: f.job_title || null,
    manager: f.manager || null,
    work_address: f.work_address || null,
    work_location: f.work_location || null,
    resume_lines: f.resume_lines.length > 0 ? f.resume_lines : null,
    private_email: f.private_email || null,
    private_phone: f.private_phone || null,
    employee_bank_account: f.employee_bank_account || null,
    legal_name: f.legal_name || null,
    place_of_birth: f.place_of_birth || null,
    gender: f.gender || null,
    emergency_contacts: f.emergency_contacts.length > 0 ? f.emergency_contacts : null,
    visa_no: f.visa_no || null,
    work_permit: f.work_permit || null,
    visa_documents: f.visa_documents.length > 0 ? f.visa_documents : null,
    nationality: f.nationality || null,
    nationality_code: f.nationality_code || null,
    id_no: f.id_no || null,
    ssn_no: f.ssn_no || null,
    passport_no: f.passport_no || null,
    private_address: f.private_address || null,
    home_work_distance: f.home_work_distance || null,
    marital_status: f.marital_status || null,
    number_of_children: f.number_of_children || null,
    certificate_level: f.certificate_level || null,
    field_of_study: f.field_of_study || null,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODULE-LEVEL REUSABLE COMPONENTS (extracted from render functions for perf)
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Detail view section wrapper ── */
const Section = React.memo(function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-b border-[#222] px-4 md:px-6 py-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-white/30">{icon}</span>
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
});

/* ── Form text input ── */
const Input = React.memo(function Input({ label, value, onChange, type = "text", placeholder, icon }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs text-white/40 mb-1 block">{label}</label>
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20">{icon}</span>}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || label}
          className={`w-full h-10 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20 transition-colors ${icon ? "pl-9 pr-3" : "px-3"}`}
        />
      </div>
    </div>
  );
});

/* ── Form select input ── */
const SelectInput = React.memo(function SelectInput({ label, value, onChange, options, icon }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs text-white/40 mb-1 block">{label}</label>
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none">{icon}</span>}
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`w-full h-10 rounded-lg bg-white/5 border border-[#222] text-sm text-white outline-none focus:border-white/20 transition-colors appearance-none cursor-pointer ${icon ? "pl-9 pr-3" : "px-3"}`}
        >
          <option value="" className="bg-[#111]">Select...</option>
          {options.map(o => <option key={o} value={o} className="bg-[#111]">{o}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
      </div>
    </div>
  );
});

/* ── Add button ── */
const AddButton = React.memo(function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 text-sm text-white/50 hover:text-white py-2 transition-colors">
      <div className="w-6 h-6 rounded-full bg-white/10 border border-white/[0.08] flex items-center justify-center">
        <Plus size={14} className="text-white/60" />
      </div>
      {label}
    </button>
  );
});

/* ── Remove button ── */
const RemoveBtn = React.memo(function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-6 h-6 rounded-full bg-white/10 border border-white/[0.08] flex items-center justify-center shrink-0 hover:bg-white/20 transition-colors">
      <Minus size={14} className="text-white/60" />
    </button>
  );
});

/* ── Inline label select ── */
const LabelSelect = React.memo(function LabelSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-10 px-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs text-white/60 font-medium outline-none cursor-pointer min-w-[80px]"
    >
      {options.map(o => <option key={o} value={o} className="bg-[#111] text-white">{o}</option>)}
    </select>
  );
});

/* ── Form section wrapper ── */
const FormSection = React.memo(function FormSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-b border-[#222] px-4 md:px-6 py-4 md:py-5">
      <div className="flex items-center gap-2 mb-4">
        {icon && <span className="text-white/25">{icon}</span>}
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
});

/* ── Birthday Picker (DD/MM/YYYY) ── */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const BirthdayPicker = React.memo(function BirthdayPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parts = value ? value.split("-") : ["", "", ""];
  const year = parts[0] || "";
  const month = parts[1] || "";
  const day = parts[2] || "";

  const update = (d: string, m: string, y: string) => {
    if (d && m && y) onChange(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
    else if (!d && !m && !y) onChange("");
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="grid grid-cols-3 gap-2">
      <div>
        <label className="text-xs text-white/40 mb-1 block">Day</label>
        <select value={day} onChange={e => update(e.target.value, month, year)} className="w-full h-10 px-2 rounded-lg bg-white/5 border border-[#222] text-sm text-white outline-none cursor-pointer">
          <option value="" className="bg-[#111]">DD</option>
          {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={String(i + 1).padStart(2, "0")} className="bg-[#111]">{i + 1}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-white/40 mb-1 block">Month</label>
        <select value={month} onChange={e => update(day, e.target.value, year)} className="w-full h-10 px-2 rounded-lg bg-white/5 border border-[#222] text-sm text-white outline-none cursor-pointer">
          <option value="" className="bg-[#111]">MM</option>
          {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")} className="bg-[#111]">{m}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-white/40 mb-1 block">Year</label>
        <select value={year} onChange={e => update(day, month, e.target.value)} className="w-full h-10 px-2 rounded-lg bg-white/5 border border-[#222] text-sm text-white outline-none cursor-pointer">
          <option value="" className="bg-[#111]">YYYY</option>
          {Array.from({ length: 100 }, (_, i) => { const y = currentYear - i; return <option key={y} value={String(y)} className="bg-[#111]">{y}</option>; })}
        </select>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   COUNTRY / PROVINCE / CITY CASCADE COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

interface CountryOption {
  name: string;
  isoCode: string;
  flag: string;
}

const ALL_COUNTRIES: CountryOption[] = Country.getAllCountries().map(c => ({
  name: c.name,
  isoCode: c.isoCode,
  flag: countryCodeToFlag(c.isoCode),
}));

/* ── Searchable Country Dropdown ── */
function CountryDropdown({ value, displayValue, onChange }: {
  value: string; // isoCode
  displayValue: string; // country name shown
  onChange: (name: string, isoCode: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return ALL_COUNTRIES;
    const q = query.toLowerCase();
    return ALL_COUNTRIES.filter(c => c.name.toLowerCase().includes(q) || c.isoCode.toLowerCase().includes(q));
  }, [query]);

  const handleSelect = (c: CountryOption) => {
    onChange(c.name, c.isoCode);
    setOpen(false);
    setQuery("");
  };

  const selectedFlag = value ? countryCodeToFlag(value) : "";

  return (
    <div ref={wrapperRef} className="relative">
      <label className="text-xs text-white/40 mb-1 block">Country</label>
      <div
        className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white flex items-center gap-2 cursor-pointer focus-within:border-white/20 transition-colors"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        {selectedFlag && <span className="text-base">{selectedFlag}</span>}
        <input
          ref={inputRef}
          type="text"
          value={open ? query : displayValue}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search country..."
          className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/20"
        />
        <ChevronDown size={14} className={`text-white/30 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-[#222] bg-[#111] shadow-xl">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-white/30">No countries found</div>
          ) : (
            filtered.map(c => (
              <button
                key={c.isoCode}
                onClick={() => handleSelect(c)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-white/5 transition-colors ${
                  c.isoCode === value ? "bg-white/[0.03] text-white" : "text-white/70"
                }`}
              >
                <span className="text-base">{c.flag}</span>
                <span className="truncate">{c.name}</span>
                <span className="text-[10px] text-white/20 ml-auto">{c.isoCode}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Province/State Dropdown ── */
function ProvinceDropdown({ countryCode, value, displayValue, onChange }: {
  countryCode: string;
  value: string; // stateCode
  displayValue: string;
  onChange: (name: string, isoCode: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const states = useMemo(() => {
    if (!countryCode) return [];
    return State.getStatesOfCountry(countryCode);
  }, [countryCode]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return states;
    const q = query.toLowerCase();
    return states.filter(s => s.name.toLowerCase().includes(q) || s.isoCode.toLowerCase().includes(q));
  }, [query, states]);

  if (states.length === 0) return null;

  return (
    <div ref={wrapperRef} className="relative">
      <label className="text-xs text-white/40 mb-1 block">Province / State</label>
      <div
        className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white flex items-center gap-2 cursor-pointer focus-within:border-white/20 transition-colors"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        <input
          ref={inputRef}
          type="text"
          value={open ? query : displayValue}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search province..."
          className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/20"
        />
        <ChevronDown size={14} className={`text-white/30 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-[#222] bg-[#111] shadow-xl">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-white/30">No provinces found</div>
          ) : (
            filtered.map(s => (
              <button
                key={s.isoCode}
                onClick={() => { onChange(s.name, s.isoCode); setOpen(false); setQuery(""); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-white/5 transition-colors ${
                  s.isoCode === value ? "bg-white/[0.03] text-white" : "text-white/70"
                }`}
              >
                <span className="truncate">{s.name}</span>
                <span className="text-[10px] text-white/20 ml-auto">{s.isoCode}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── City Dropdown ── */
function CityDropdown({ countryCode, stateCode, value, onChange }: {
  countryCode: string;
  stateCode: string;
  value: string;
  onChange: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cities = useMemo(() => {
    if (!countryCode) return [];
    if (stateCode) return City.getCitiesOfState(countryCode, stateCode);
    return City.getCitiesOfCountry(countryCode) || [];
  }, [countryCode, stateCode]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return cities;
    const q = query.toLowerCase();
    return cities.filter(c => c.name.toLowerCase().includes(q));
  }, [query, cities]);

  // Fallback to plain text input if no city data available
  if (cities.length === 0) {
    return (
      <Input label="City" value={value} onChange={onChange} placeholder="City" />
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="text-xs text-white/40 mb-1 block">City</label>
      <div
        className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white flex items-center gap-2 cursor-pointer focus-within:border-white/20 transition-colors"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        <input
          ref={inputRef}
          type="text"
          value={open ? query : value}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search city..."
          className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/20"
        />
        <ChevronDown size={14} className={`text-white/30 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-[#222] bg-[#111] shadow-xl">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-white/30">No cities found</div>
          ) : (
            filtered.map((c, idx) => (
              <button
                key={`${c.name}-${idx}`}
                onClick={() => { onChange(c.name); setOpen(false); setQuery(""); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-white/5 transition-colors ${
                  c.name === value ? "bg-white/[0.03] text-white" : "text-white/70"
                }`}
              >
                <span className="truncate">{c.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function Contacts({ filterType }: { filterType?: ContactType } = {}) {
  /* ── State ── */
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [typeTab, setTypeTab] = useState<ContactType | "all">(filterType || "all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<ContactForm>({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showTypeChooser, setShowTypeChooser] = useState(false);
  const [typeChooserStep, setTypeChooserStep] = useState<1 | 2>(1);
  const [expandedFamily, setExpandedFamily] = useState<number | null>(null);
  const [expandedResumeLine, setExpandedResumeLine] = useState<number | null>(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rlsCopied, setRlsCopied] = useState(false);

  /* ── Load ── */
  const loadContacts = useCallback(async () => {
    setLoading(true);
    const ok = await checkContactsSetup();
    if (!ok) { setSetupNeeded(true); setLoading(false); return; }
    const data = await fetchContacts();
    setContacts(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  /* ── Debounced search for performance ── */
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 150);
    return () => clearTimeout(timer);
  }, [search]);

  /* ── Filtered + grouped contacts ── */
  const filtered = useMemo(() => {
    let list = contacts;
    const tab = filterType || typeTab;
    if (tab !== "all") list = list.filter(c => c.contact_type === tab);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      const isShort = q.length <= 2;
      list = list.filter(c => {
        const name = contactDisplayName(c).toLowerCase();
        const firstName = (c.first_name || "").toLowerCase();
        const lastName = (c.last_name || "").toLowerCase();
        const company = (c.company || "").toLowerCase();
        const companyEn = (c.company_name_en || "").toLowerCase();
        const companyCn = (c.company_name_cn || "");
        /* Short query (1-2 chars): match start of name / company only */
        if (isShort) {
          if (name.startsWith(q)) return true;
          if (firstName.startsWith(q)) return true;
          if (lastName.startsWith(q)) return true;
          if (company.startsWith(q)) return true;
          if (companyEn.startsWith(q)) return true;
          if (companyCn.startsWith(q)) return true;
          return false;
        }
        /* Longer query: search across all fields */
        if (name.includes(q)) return true;
        if (company.includes(q)) return true;
        if ((c.email || "").toLowerCase().includes(q)) return true;
        if ((c.phone || "").includes(q)) return true;
        if (firstName.includes(q)) return true;
        if (lastName.includes(q)) return true;
        if (companyEn.includes(q)) return true;
        if (companyCn.includes(q)) return true;
        if ((c.supplier_email || "").toLowerCase().includes(q)) return true;
        if ((c.supplier_tel || "").includes(q)) return true;
        if ((c.supplier_mobile || "").includes(q)) return true;
        if ((c.division || "").toLowerCase().includes(q)) return true;
        if ((c.category || "").toLowerCase().includes(q)) return true;
        if (c.brand_names?.some(b => b.toLowerCase().includes(q))) return true;
        if (c.tags?.some(t => t.toLowerCase().includes(q))) return true;
        if (c.contact_persons?.some(p => (p.name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q) || (p.phone || "").includes(q))) return true;
        return false;
      });
    }
    return list.sort((a, b) => contactSortKey(a).localeCompare(contactSortKey(b)));
  }, [contacts, typeTab, filterType, debouncedSearch]);

  const grouped = useMemo(() => {
    const map: Record<string, ContactRow[]> = {};
    filtered.forEach(c => {
      const letter = contactSortKey(c)[0]?.toUpperCase() || "#";
      if (!map[letter]) map[letter] = [];
      map[letter].push(c);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const selectedContact = useMemo(() => contacts.find(c => c.id === selectedId) || null, [contacts, selectedId]);

  /* ── Module KPI stats (works for any contact type) ── */
  const moduleKpis = useMemo(() => {
    if (!filterType) return null;
    const all = contacts.filter(c => c.contact_type === filterType);
    const active = all.filter(c => c.is_active);
    const countries = new Set(all.map(c => c.country_code).filter(Boolean));
    const vip = all.filter(c => c.customer_type === "diamond" || c.customer_type === "platinum");
    const now = new Date();
    const thisMonth = all.filter(c => {
      if (!c.created_at) return false;
      const d = new Date(c.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    return { total: all.length, active: active.length, countries: countries.size, vip: vip.length, newThisMonth: thisMonth.length };
  }, [contacts, filterType]);

  /* ── Supplier-specific KPI stats ── */
  const supplierKpis = useMemo(() => {
    if (filterType !== "supplier") return null;
    const all = contacts.filter(c => c.contact_type === "supplier");
    const active = all.filter(c => c.is_active);
    const countries = new Set(all.map(c => c.origin_country_code || c.country_code).filter(Boolean));
    const rated = all.filter(c => c.rating > 0);
    const avgRating = rated.length > 0 ? (rated.reduce((sum, c) => sum + c.rating, 0) / rated.length) : 0;
    const withCatalogues = all.filter(c => Array.isArray(c.catalogues) && c.catalogues.length > 0);
    const divisions = new Set(all.map(c => c.division).filter(Boolean));
    const categories = new Set(all.map(c => c.category).filter(Boolean));
    const withContacts = all.filter(c => Array.isArray(c.contact_persons) && c.contact_persons.length > 0);
    const now = new Date();
    const newThisMonth = all.filter(c => {
      if (!c.created_at) return false;
      const d = new Date(c.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    return {
      total: all.length,
      active: active.length,
      countries: countries.size,
      avgRating: Math.round(avgRating * 10) / 10,
      ratedCount: rated.length,
      withCatalogues: withCatalogues.length,
      divisions: divisions.size,
      categories: categories.size,
      withContacts: withContacts.length,
      newThisMonth: newThisMonth.length,
    };
  }, [contacts, filterType]);

  /* ── Handlers ── */
  const handleSelectContact = useCallback((c: ContactRow) => {
    setSelectedId(c.id);
    setView("detail");
    setMobileShowDetail(true);
    setEditingId(null);
  }, []);

  const handleAdd = useCallback((type: ContactType, entityType?: "person" | "company") => {
    setForm({ ...EMPTY_FORM, contact_type: type, entity_type: entityType || "" });
    setEditingId(null);
    setView("form");
    setShowTypeChooser(false);
    setTypeChooserStep(1);
    setMobileShowDetail(true);
    setExpandedFamily(null);
  }, []);

  const handleEdit = useCallback(() => {
    if (!selectedContact) return;
    setForm(contactToForm(selectedContact));
    setEditingId(selectedContact.id);
    setView("form");
    setExpandedFamily(null);
  }, [selectedContact]);

  const handleSave = async () => {
    if (!form.first_name && !form.last_name && !form.company && !form.company_name_en) return;
    setSaving(true);
    setSaveError(null);
    const row = formToRow(form);
    try {
      if (editingId) {
        const { ok, error } = await updateContact(editingId, row);
        if (ok) {
          await loadContacts();
          setView("detail");
        } else {
          setSaveError(error || "Failed to update contact. Check your database RLS policies.");
        }
      } else {
        const { data: created, error } = await createContact(row);
        if (created) {
          await loadContacts();
          setSelectedId(created.id);
          setView("detail");
        } else {
          setSaveError(error || "Failed to create contact. Check your database RLS policies.");
        }
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "An unexpected error occurred.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { ok } = await deleteContact(id);
    if (ok) {
      setContacts(prev => prev.filter(c => c.id !== id));
      if (selectedId === id) { setSelectedId(null); setView("list"); setMobileShowDetail(false); }
      setDeleteConfirm(null);
    }
  };

  const handleCancel = () => {
    if (editingId && selectedContact) {
      setView("detail");
    } else {
      setView("list");
      setMobileShowDetail(false);
    }
    setEditingId(null);
  };

  const handleBack = () => {
    setMobileShowDetail(false);
    setSelectedId(null);
    setView("list");
    setEditingId(null);
  };

  const copySql = () => {
    navigator.clipboard.writeText(MIGRATION_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Form updaters ── */
  const setField = useCallback(<K extends keyof ContactForm>(key: K, val: ContactForm[K]) =>
    setForm(prev => ({ ...prev, [key]: val })), []);

  const addPhone = () => setField("phones", [...form.phones, { label: "mobile", number: "" }]);
  const removePhone = (i: number) => setField("phones", form.phones.filter((_, idx) => idx !== i));
  const updatePhone = (i: number, field: keyof PhoneEntry, val: string) => {
    const arr = [...form.phones]; arr[i] = { ...arr[i], [field]: val }; setField("phones", arr);
  };

  const addEmail = () => setField("emails", [...form.emails, { label: "home", email: "" }]);
  const removeEmail = (i: number) => setField("emails", form.emails.filter((_, idx) => idx !== i));
  const updateEmail = (i: number, field: keyof EmailEntry, val: string) => {
    const arr = [...form.emails]; arr[i] = { ...arr[i], [field]: val }; setField("emails", arr);
  };

  const addAddress = () => setField("addresses", [...form.addresses, { label: "home", street: "", city: "", state: "", zip: "", country: "" }]);
  const removeAddress = (i: number) => setField("addresses", form.addresses.filter((_, idx) => idx !== i));
  const updateAddress = (i: number, field: keyof AddressEntry, val: string) => {
    const arr = [...form.addresses]; arr[i] = { ...arr[i], [field]: val }; setField("addresses", arr);
  };

  const addWebsite = () => setField("websites", [...form.websites, { label: "homepage", url: "" }]);
  const removeWebsite = (i: number) => setField("websites", form.websites.filter((_, idx) => idx !== i));
  const updateWebsite = (i: number, field: keyof WebsiteEntry, val: string) => {
    const arr = [...form.websites]; arr[i] = { ...arr[i], [field]: val }; setField("websites", arr);
  };

  const addSocial = () => setField("social_profiles", [...form.social_profiles, { platform: "WhatsApp", username: "", url: "", qr_code_url: "" }]);
  const removeSocial = (i: number) => setField("social_profiles", form.social_profiles.filter((_, idx) => idx !== i));
  const updateSocial = (i: number, field: keyof SocialProfile, val: string) => {
    const arr = [...form.social_profiles]; arr[i] = { ...arr[i], [field]: val }; setField("social_profiles", arr);
  };

  const addRelated = () => setField("related_names", [...form.related_names, { name: "", relationship: "friend" }]);
  const removeRelated = (i: number) => setField("related_names", form.related_names.filter((_, idx) => idx !== i));
  const updateRelated = (i: number, field: keyof RelatedName, val: string) => {
    const arr = [...form.related_names]; arr[i] = { ...arr[i], [field]: val }; setField("related_names", arr);
  };

  const addFamily = () => setField("family_members", [...form.family_members, {
    relationship: "Spouse", title: "", first_name: "", middle_name: "", last_name: "",
    phone: "", email: "", birthday: "", notes: "", photo_url: "",
  }]);
  const removeFamily = (i: number) => {
    setField("family_members", form.family_members.filter((_, idx) => idx !== i));
    if (expandedFamily === i) setExpandedFamily(null);
  };
  const updateFamily = (i: number, field: keyof FamilyMember, val: string) => {
    const arr = [...form.family_members]; arr[i] = { ...arr[i], [field]: val }; setField("family_members", arr);
  };

  // Resume Line helpers
  const addResumeLine = (type: "experience" | "education" | "training" | "certification") => {
    setField("resume_lines", [...form.resume_lines, {
      type,
      title: "",
      duration_start: "",
      duration_end: "",
      is_forever: false,
      certificate_url: "",
      certificate_name: "",
      notes: "",
      course_type: type === "training" ? "external" : "",
      external_url: "",
    }]);
  };
  const removeResumeLine = (i: number) => setField("resume_lines", form.resume_lines.filter((_, idx) => idx !== i));
  const updateResumeLine = (i: number, field: string, val: any) => {
    const arr = [...form.resume_lines];
    arr[i] = { ...arr[i], [field]: val };
    setField("resume_lines", arr);
  };

  // Emergency Contact helpers
  const addEmergencyContact = () => setField("emergency_contacts", [...form.emergency_contacts, { contact: "", phone: "" }]);
  const removeEmergencyContact = (i: number) => setField("emergency_contacts", form.emergency_contacts.filter((_, idx) => idx !== i));
  const updateEmergencyContact = (i: number, field: string, val: string) => {
    const arr = [...form.emergency_contacts];
    arr[i] = { ...arr[i], [field]: val };
    setField("emergency_contacts", arr);
  };

  // Visa Document helpers
  const addVisaDoc = () => setField("visa_documents", [...form.visa_documents, { name: "", url: "", type: "", uploaded_at: new Date().toISOString() }]);
  const removeVisaDoc = (i: number) => setField("visa_documents", form.visa_documents.filter((_, idx) => idx !== i));

  const addCustomField = () => setField("custom_fields", [...form.custom_fields, { field_name: "", field_value: "" }]);
  const removeCustomField = (i: number) => setField("custom_fields", form.custom_fields.filter((_, idx) => idx !== i));
  const updateCustomField = (i: number, field: keyof CustomField, val: string) => {
    const arr = [...form.custom_fields]; arr[i] = { ...arr[i], [field]: val }; setField("custom_fields", arr);
  };

  /* ── Location cascade handlers ── */
  const handleCountryChange = useCallback((name: string, isoCode: string) => {
    setForm(prev => ({
      ...prev,
      country: name,
      country_code: isoCode,
      province: "",
      province_code: "",
      city: "",
    }));
  }, []);

  const handleProvinceChange = useCallback((name: string, isoCode: string) => {
    setForm(prev => ({
      ...prev,
      province: name,
      province_code: isoCode,
      city: "",
    }));
  }, []);

  const handleCityChange = useCallback((name: string) => {
    setField("city", name);
  }, []);

  /* ═════════════════════════════════════════════════════════════════════════
     SETUP SCREEN
     ═════════════════════════════════════════════════════════════════════════ */

  if (setupNeeded) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-amber-400" size={32} />
            </div>
            <h1 className="text-2xl font-semibold mb-2">Database Setup Required</h1>
            <p className="text-white/50 text-sm">
              The contacts table needs additional columns. Copy the SQL below and run it in your
              <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline ml-1">
                Supabase Dashboard
              </a>
              {" "}&rarr; SQL Editor &rarr; New Query.
            </p>
          </div>

          <div className="relative rounded-xl border border-[#222] bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#222] bg-white/[0.03]">
              <span className="text-xs text-white/40 font-mono">SQL Migration</span>
              <button onClick={copySql} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 transition-colors">
                {copied ? <><Check size={12} className="text-green-400" /> Copied</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
            <pre className="p-4 text-xs text-white/70 font-mono overflow-x-auto max-h-80 overflow-y-auto leading-relaxed">
              {MIGRATION_SQL}
            </pre>
          </div>

          <div className="flex items-center justify-center gap-3 mt-6">
            <Link href="/" className="px-4 py-2 rounded-lg text-sm border border-[#222] bg-white/5 hover:bg-white/10 transition-colors">
              Back to Hub
            </Link>
            <button onClick={() => { setSetupNeeded(false); loadContacts(); }} className="px-4 py-2 rounded-lg text-sm bg-white text-black font-medium hover:bg-white/90 transition-colors">
              I&apos;ve Run the SQL &mdash; Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ═════════════════════════════════════════════════════════════════════════
     LOADING
     ═════════════════════════════════════════════════════════════════════════ */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  /* ═════════════════════════════════════════════════════════════════════════
     RENDER: CONTACT LIST PANEL
     ═════════════════════════════════════════════════════════════════════════ */

  const renderListPanel = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#222]">
        <div className="flex items-center justify-between mb-3">
          <Link href="/" className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Hub</span>
          </Link>
          <h1 className="text-lg font-semibold text-white">
            {filterType ? (filterType === "company" ? "Companies" : filterType === "people" ? "People" : CONTACT_TYPES.find(t => t.value === filterType)?.label + "s") : "Contacts"}
          </h1>
          <button
            onClick={() => {
              if (filterType && filterType !== "customer") {
                handleAdd(filterType);
              } else {
                setShowTypeChooser(true);
              }
            }}
            className="w-8 h-8 rounded-full bg-white text-black hover:bg-white/90 flex items-center justify-center transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Type tabs */}
        {!filterType && (
          <div className="flex gap-1 mt-3 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setTypeTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                typeTab === "all" ? "bg-white/15 text-white" : "text-white/40 hover:text-white/60"
              }`}
            >
              All ({contacts.length})
            </button>
            {CONTACT_TYPES.map(t => {
              const count = contacts.filter(c => c.contact_type === t.value).length;
              return (
                <button
                  key={t.value}
                  onClick={() => setTypeTab(t.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    typeTab === t.value ? "bg-white/15 text-white" : "text-white/40 hover:text-white/60"
                  }`}
                >
                  {t.icon} {t.value === "company" ? "Companies" : t.value === "people" ? "People" : t.label + "s"} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto will-change-scroll">
        {/* Compact KPI strip — mobile only (main dashboard is in right panel on desktop) */}
        {moduleKpis && filterType === "customer" && (
          <div className="md:hidden grid grid-cols-4 gap-2 px-4 py-3 border-b border-[#222]">
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-white">{moduleKpis.total}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-white/30">Total</p>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-emerald-400">{moduleKpis.active}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-emerald-400/40">Active</p>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-violet-400">{moduleKpis.vip}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-violet-400/40">VIP</p>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-blue-400">{moduleKpis.countries}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-blue-400/40">Countries</p>
            </div>
          </div>
        )}
        {/* Compact KPI strip — mobile only (supplier variant) */}
        {supplierKpis && filterType === "supplier" && (
          <div className="md:hidden grid grid-cols-4 gap-2 px-4 py-3 border-b border-[#222]">
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-white">{supplierKpis.total}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-white/30">Total</p>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-emerald-400">{supplierKpis.active}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-emerald-400/40">Active</p>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-amber-400">{supplierKpis.avgRating > 0 ? supplierKpis.avgRating : "—"}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-amber-400/40">Rating</p>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-orange-400">{supplierKpis.countries}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-orange-400/40">Countries</p>
            </div>
          </div>
        )}

        {/* Compact KPI strip — mobile only (employee/company/people) */}
        {moduleKpis && filterType && filterType !== "customer" && filterType !== "supplier" && (
          <div className="md:hidden grid grid-cols-4 gap-2 px-4 py-3 border-b border-[#222]">
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-white">{moduleKpis.total}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-white/30">Total</p>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-emerald-400">{moduleKpis.active}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-emerald-400/40">Active</p>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-blue-400">{moduleKpis.countries}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-blue-400/40">Countries</p>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-amber-400">{moduleKpis.newThisMonth}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-amber-400/40">New</p>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/30 gap-2">
            <Users size={32} />
            <p className="text-sm">No contacts found</p>
          </div>
        ) : (
          grouped.map(([letter, items]) => (
            <div key={letter}>
              <div className="px-4 py-1.5 text-xs font-semibold text-white/30 bg-white/[0.02] sticky top-0 backdrop-blur-sm">
                {letter}
              </div>
              {items.map(c => {
                const isSelected = selectedId === c.id;
                const tierInfo = c.contact_type === "customer" ? getTierInfo(c.customer_type) : null;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelectContact(c)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-white/[0.03] contain-layout ${
                      isSelected ? "bg-white/[0.08]" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`w-10 h-10 ${c.contact_type === "supplier" || c.contact_type === "company" || (c.contact_type === "customer" && c.entity_type === "company") ? "rounded-lg" : "rounded-full"} bg-white/10 flex items-center justify-center text-sm font-semibold text-white/60 shrink-0 overflow-hidden`}>
                      {c.photo_url ? (
                        <img src={c.photo_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      ) : c.contact_type === "supplier" || c.contact_type === "company" || (c.contact_type === "customer" && c.entity_type === "company") ? (
                        <Building2 size={16} className="text-white/30" />
                      ) : (
                        getInitials(c)
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">
                          {contactDisplayName(c)}
                        </span>
                        {tierInfo && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${tierInfo.bg} ${tierInfo.color} font-medium`}>
                            {tierInfo.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-medium ${getTypeColor(c.contact_type)}`}>
                          {c.contact_type?.charAt(0).toUpperCase() + c.contact_type?.slice(1)}
                        </span>
                        {c.company && (
                          <span className="text-xs text-white/30 truncate">&middot; {c.company}</span>
                        )}
                      </div>
                    </div>

                    <ChevronRight size={14} className="text-white/20 shrink-0" />
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );

  /* ═════════════════════════════════════════════════════════════════════════
     RENDER: CONTACT DETAIL PANEL
     ═════════════════════════════════════════════════════════════════════════ */

  const renderDetailPanel = () => {
    if (!selectedContact) {
      /* ── Supplier KPI Dashboard ── */
      if (filterType === "supplier" && supplierKpis) {
        return (
          <div className="h-full overflow-y-auto">
            <div className="w-full px-4 md:px-6 py-6 md:py-8 space-y-4 md:space-y-6">
              {/* Title */}
              <div>
                <h2 className="text-2xl font-bold text-white">Supplier Overview</h2>
                <p className="text-sm text-white/40 mt-1">Key metrics and insights</p>
              </div>

              {/* Main KPI Row - 4 cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {/* Total Suppliers */}
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5 transition-all hover:border-white/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10">
                      <Building2 size={16} className="text-blue-400" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Total</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-white">{supplierKpis.total}</p>
                  <p className="text-xs text-white/30 mt-1">All suppliers</p>
                </div>

                {/* Active */}
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5 transition-all hover:border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10">
                      <UserCheck size={16} className="text-emerald-400" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400/60">Active</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-emerald-400">{supplierKpis.active}</p>
                  <p className="text-xs text-white/30 mt-1">{supplierKpis.total > 0 ? Math.round((supplierKpis.active / supplierKpis.total) * 100) : 0}% of total</p>
                </div>

                {/* Countries */}
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5 transition-all hover:border-orange-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-500/10">
                      <Globe size={16} className="text-orange-400" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-orange-400/60">Countries</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-orange-400">{supplierKpis.countries}</p>
                  <p className="text-xs text-white/30 mt-1">Source countries</p>
                </div>

                {/* Avg Rating */}
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5 transition-all hover:border-amber-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10">
                      <Star size={16} className="text-amber-400" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/60">Avg Rating</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-amber-400">{supplierKpis.avgRating > 0 ? supplierKpis.avgRating : "\u2014"}<span className="text-base text-white/20">/5</span></p>
                  <p className="text-xs text-white/30 mt-1">{supplierKpis.ratedCount} rated</p>
                </div>
              </div>

              {/* Supplier Details Grid - 2x2 */}
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                {/* Catalogues */}
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen size={16} className="text-violet-400" />
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Catalogues</span>
                  </div>
                  <p className="text-3xl font-bold text-violet-400">{supplierKpis.withCatalogues}</p>
                  <p className="text-xs text-white/30 mt-1">Suppliers with catalogues</p>
                </div>

                {/* Contact Persons */}
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={16} className="text-cyan-400" />
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Contacts</span>
                  </div>
                  <p className="text-3xl font-bold text-cyan-400">{supplierKpis.withContacts}</p>
                  <p className="text-xs text-white/30 mt-1">With contact persons</p>
                </div>

                {/* Divisions */}
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Briefcase size={16} className="text-pink-400" />
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Divisions</span>
                  </div>
                  <p className="text-3xl font-bold text-pink-400">{supplierKpis.divisions}</p>
                  <p className="text-xs text-white/30 mt-1">Product divisions</p>
                </div>

                {/* Categories */}
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Package size={16} className="text-teal-400" />
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Categories</span>
                  </div>
                  <p className="text-3xl font-bold text-teal-400">{supplierKpis.categories}</p>
                  <p className="text-xs text-white/30 mt-1">Product categories</p>
                </div>
              </div>

              {/* Status Breakdown */}
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Active</span>
                  </div>
                  <p className="text-3xl font-bold text-emerald-400">{supplierKpis.active}</p>
                </div>
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Inactive</span>
                  </div>
                  <p className="text-3xl font-bold text-red-400">{supplierKpis.total - supplierKpis.active}</p>
                </div>
              </div>

              {/* New This Month */}
              {supplierKpis.newThisMonth > 0 && (
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5 flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/10">
                    <TrendingUp size={20} className="text-green-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-green-400">+{supplierKpis.newThisMonth}</p>
                    <p className="text-xs text-white/40">New suppliers this month</p>
                  </div>
                </div>
              )}

              {/* Hint */}
              <p className="text-xs text-white/20 text-center pt-2">Select a supplier from the list to view details</p>
            </div>
          </div>
        );
      }

      /* ── Customer KPI Dashboard ── */
      if (filterType === "customer" && moduleKpis) {
        const tierCounts = {
          diamond: contacts.filter(c => c.contact_type === filterType && c.customer_type === "diamond").length,
          platinum: contacts.filter(c => c.contact_type === filterType && c.customer_type === "platinum").length,
          gold: contacts.filter(c => c.contact_type === filterType && c.customer_type === "gold").length,
          silver: contacts.filter(c => c.contact_type === filterType && c.customer_type === "silver").length,
          end_user: contacts.filter(c => c.contact_type === filterType && c.customer_type === "end_user").length,
          none: contacts.filter(c => c.contact_type === filterType && !c.customer_type).length,
        };
        const inactive = moduleKpis.total - moduleKpis.active;
        return (
          <div className="h-full overflow-y-auto">
            <div className="w-full px-4 md:px-6 py-6 md:py-8 space-y-4 md:space-y-6">
              {/* Title */}
              <div>
                <h2 className="text-2xl font-bold text-white">Customer Overview</h2>
                <p className="text-sm text-white/40 mt-1">Key metrics and insights</p>
              </div>

              {/* Main KPI Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {/* Total */}
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5 transition-all hover:border-white/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10">
                      <Crown size={16} className="text-amber-400" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Total</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-white">{moduleKpis.total}</p>
                  <p className="text-xs text-white/30 mt-1">All customers</p>
                </div>

                {/* Active */}
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5 transition-all hover:border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10">
                      <UserCheck size={16} className="text-emerald-400" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400/60">Active</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-emerald-400">{moduleKpis.active}</p>
                  <p className="text-xs text-white/30 mt-1">{moduleKpis.total > 0 ? Math.round((moduleKpis.active / moduleKpis.total) * 100) : 0}% of total</p>
                </div>

                {/* VIP */}
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5 transition-all hover:border-violet-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10">
                      <Gem size={16} className="text-violet-400" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-400/60">VIP</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-violet-400">{moduleKpis.vip}</p>
                  <p className="text-xs text-white/30 mt-1">Diamond & Platinum</p>
                </div>

                {/* Countries */}
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5 transition-all hover:border-blue-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10">
                      <MapPinned size={16} className="text-blue-400" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-400/60">Countries</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-blue-400">{moduleKpis.countries}</p>
                  <p className="text-xs text-white/30 mt-1">Global reach</p>
                </div>
              </div>

              {/* Tier Breakdown */}
              <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5">
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Customer Tiers</h3>
                <div className="space-y-3">
                  {[
                    { label: "Diamond", count: tierCounts.diamond, color: "bg-violet-500", textColor: "text-violet-300" },
                    { label: "Platinum", count: tierCounts.platinum, color: "bg-cyan-500", textColor: "text-cyan-300" },
                    { label: "Gold", count: tierCounts.gold, color: "bg-amber-500", textColor: "text-amber-300" },
                    { label: "Silver", count: tierCounts.silver, color: "bg-slate-400", textColor: "text-slate-300" },
                    { label: "End User", count: tierCounts.end_user, color: "bg-zinc-500", textColor: "text-zinc-300" },
                  ].map(tier => (
                    <div key={tier.label} className="flex items-center gap-3">
                      <span className={`text-xs font-medium w-20 ${tier.textColor}`}>{tier.label}</span>
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${tier.color} rounded-full transition-all duration-500`}
                          style={{ width: moduleKpis.total > 0 ? `${(tier.count / moduleKpis.total) * 100}%` : "0%" }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-white/60 w-8 text-right">{tier.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Breakdown */}
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Active</span>
                  </div>
                  <p className="text-3xl font-bold text-emerald-400">{moduleKpis.active}</p>
                </div>
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Inactive</span>
                  </div>
                  <p className="text-3xl font-bold text-red-400">{inactive}</p>
                </div>
              </div>

              {/* New This Month */}
              {moduleKpis.newThisMonth > 0 && (
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5 flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/10">
                    <TrendingUp size={20} className="text-green-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-green-400">+{moduleKpis.newThisMonth}</p>
                    <p className="text-xs text-white/40">New customers this month</p>
                  </div>
                </div>
              )}

              {/* Hint */}
              <p className="text-xs text-white/20 text-center pt-2">Select a customer from the list to view details</p>
            </div>
          </div>
        );
      }

      /* ── Generic KPI Dashboard (Employee / Company / People) ── */
      if (filterType && moduleKpis) {
        const typeLabel = filterType === "company" ? "Company" : filterType === "people" ? "People" : filterType === "employee" ? "Employee" : filterType.charAt(0).toUpperCase() + filterType.slice(1);
        const typeIcon = filterType === "employee" ? <BadgeCheck size={16} className="text-teal-400" /> : filterType === "company" ? <Briefcase size={16} className="text-purple-400" /> : <User size={16} className="text-green-400" />;
        const accentColor = filterType === "employee" ? "teal" : filterType === "company" ? "purple" : "green";
        return (
          <div className="h-full overflow-y-auto">
            <div className="w-full px-4 md:px-6 py-6 md:py-8 space-y-4 md:space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white">{typeLabel} Overview</h2>
                <p className="text-sm text-white/40 mt-1">Key metrics and insights</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5 transition-all hover:border-white/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg bg-${accentColor}-500/10`}>{typeIcon}</div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Total</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-white">{moduleKpis.total}</p>
                  <p className="text-xs text-white/30 mt-1">All {typeLabel.toLowerCase()}s</p>
                </div>
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5 transition-all hover:border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10"><UserCheck size={16} className="text-emerald-400" /></div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400/60">Active</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-emerald-400">{moduleKpis.active}</p>
                  <p className="text-xs text-white/30 mt-1">{moduleKpis.total > 0 ? Math.round((moduleKpis.active / moduleKpis.total) * 100) : 0}% of total</p>
                </div>
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5 transition-all hover:border-blue-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10"><MapPinned size={16} className="text-blue-400" /></div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-400/60">Countries</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-blue-400">{moduleKpis.countries}</p>
                  <p className="text-xs text-white/30 mt-1">Global reach</p>
                </div>
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5 transition-all hover:border-amber-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10"><TrendingUp size={16} className="text-amber-400" /></div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/60">New</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-amber-400">{moduleKpis.newThisMonth}</p>
                  <p className="text-xs text-white/30 mt-1">Added this month</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Active</span>
                  </div>
                  <p className="text-3xl font-bold text-emerald-400">{moduleKpis.active}</p>
                </div>
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Inactive</span>
                  </div>
                  <p className="text-3xl font-bold text-red-400">{moduleKpis.total - moduleKpis.active}</p>
                </div>
              </div>
              {moduleKpis.newThisMonth > 0 && (
                <div className="bg-[#111] border border-[#222] rounded-xl p-3 md:p-5 flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/10">
                    <TrendingUp size={20} className="text-green-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-green-400">+{moduleKpis.newThisMonth}</p>
                    <p className="text-xs text-white/40">New {typeLabel.toLowerCase()}s this month</p>
                  </div>
                </div>
              )}
              <p className="text-xs text-white/20 text-center pt-2">Select a {typeLabel.toLowerCase()} from the list to view details</p>
            </div>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center h-full text-white/20 gap-3">
          <User size={48} />
          <p className="text-sm">Select a contact to view details</p>
        </div>
      );
    }

    const c = selectedContact;
    const tierInfo = c.contact_type === "customer" ? getTierInfo(c.customer_type) : null;
    const phones: PhoneEntry[] = Array.isArray(c.phones) ? c.phones : [];
    const emails: EmailEntry[] = Array.isArray(c.emails) ? c.emails : [];
    const addresses: AddressEntry[] = Array.isArray(c.addresses) ? c.addresses : [];
    const websitesList: WebsiteEntry[] = Array.isArray(c.websites) ? c.websites : [];
    const socials: SocialProfile[] = Array.isArray(c.social_profiles) ? c.social_profiles : [];
    const family: FamilyMember[] = Array.isArray(c.family_members) ? c.family_members : [];
    const related: RelatedName[] = Array.isArray(c.related_names) ? c.related_names : [];
    const customs: CustomField[] = Array.isArray(c.custom_fields) ? c.custom_fields : [];

    const backLabel = filterType ? filterType.charAt(0).toUpperCase() + filterType.slice(1) + " Overview" : "Contacts";

    return (
      <div className="h-full overflow-y-auto">
        {/* Back button */}
        <div className="px-4 py-3 border-b border-[#222]">
          <button onClick={handleBack} className="flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors">
            <ArrowLeft size={16} /> {backLabel}
          </button>
        </div>

        {/* Header card */}
        <div className="px-4 md:px-6 py-6 md:py-8 text-center border-b border-[#222]">
          <div className={`w-24 h-24 ${c.contact_type === "supplier" || c.contact_type === "company" || (c.contact_type === "customer" && c.entity_type === "company") ? "rounded-2xl" : "rounded-full"} bg-white/10 flex items-center justify-center text-2xl font-bold text-white/50 mx-auto mb-4 overflow-hidden`}>
            {c.photo_url ? (
              <img src={c.photo_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            ) : c.contact_type === "supplier" || c.contact_type === "company" || (c.contact_type === "customer" && c.entity_type === "company") ? (
              <Building2 size={32} className="text-white/20" />
            ) : (
              getInitials(c)
            )}
          </div>
          <h2 className="text-xl font-semibold text-white">{contactDisplayName(c)}</h2>
          {c.contact_type === "supplier" && c.company_name_cn && <p className="text-sm text-white/40 mt-0.5">{c.company_name_cn}</p>}
          {c.contact_type !== "supplier" && c.contact_type !== "company" && c.contact_type !== "employee" && !(c.contact_type === "customer" && c.entity_type === "company") && c.position && <p className="text-sm text-white/50 mt-1">{c.position}</p>}
          {c.contact_type === "employee" && (c.job_position || c.department) && (
            <p className="text-sm text-white/40">{[c.job_position, c.department].filter(Boolean).join(" \u00B7 ")}</p>
          )}
          {c.contact_type !== "supplier" && c.contact_type !== "company" && c.contact_type !== "employee" && !(c.contact_type === "customer" && c.entity_type === "company") && c.company && <p className="text-sm text-white/40">{c.company}</p>}

          <div className="flex items-center justify-center gap-2 mt-3">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border border-[#222] ${getTypeColor(c.contact_type)}`}>
              {c.contact_type?.charAt(0).toUpperCase() + c.contact_type?.slice(1)}{c.contact_type === "customer" && c.entity_type === "company" ? " · Business" : c.contact_type === "customer" && c.entity_type === "person" ? " · Individual" : ""}
            </span>
            {tierInfo && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${tierInfo.bg} ${tierInfo.color}`}>
                {tierInfo.label}
              </span>
            )}
            {!c.is_active && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-500/20 text-red-400">
                Inactive
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-2 mt-5">
            <button onClick={handleEdit} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 border border-[#222] hover:bg-white/10 text-sm transition-colors">
              <Edit3 size={14} /> Edit
            </button>
            <button
              onClick={() => setDeleteConfirm(c.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm transition-colors"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>

        {/* Phone numbers (hidden for suppliers) */}
        {c.contact_type !== "supplier" && (phones.length > 0 || c.phone) && (
          <Section title="Phone" icon={<Phone size={14} />}>
            {phones.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <div>
                  <span className="text-xs text-blue-400 font-medium">{p.label}</span>
                  <p className="text-sm text-white">{p.number}</p>
                </div>
              </div>
            ))}
            {phones.length === 0 && c.phone && (
              <p className="text-sm text-white">{c.phone}</p>
            )}
          </Section>
        )}

        {/* Emails (hidden for suppliers) */}
        {c.contact_type !== "supplier" && (emails.length > 0 || c.email) && (
          <Section title="Email" icon={<Mail size={14} />}>
            {emails.map((e, i) => (
              <div key={i} className="py-1.5">
                <span className="text-xs text-blue-400 font-medium">{e.label}</span>
                <p className="text-sm text-white">{e.email}</p>
              </div>
            ))}
            {emails.length === 0 && c.email && (
              <p className="text-sm text-white">{c.email}</p>
            )}
          </Section>
        )}

        {/* Addresses (hidden for suppliers) */}
        {c.contact_type !== "supplier" && addresses.length > 0 && (
          <Section title="Address" icon={<MapPin size={14} />}>
            {addresses.map((a, i) => (
              <div key={i} className="py-1.5">
                <span className="text-xs text-blue-400 font-medium">{a.label}</span>
                <p className="text-sm text-white">
                  {[a.street, a.city, a.state, a.zip, a.country].filter(Boolean).join(", ")}
                </p>
              </div>
            ))}
          </Section>
        )}

        {/* Country / Province / City (hidden for suppliers - shown in Contact Details) */}
        {c.contact_type !== "supplier" && (c.country || c.province || c.city) && (
          <Section title="Location" icon={<MapPin size={14} />}>
            <div className="flex items-center gap-2">
              {c.country_code && <span className="text-base">{countryCodeToFlag(c.country_code)}</span>}
              <p className="text-sm text-white">
                {[c.city, c.province, c.country].filter(Boolean).join(", ")}
              </p>
            </div>
          </Section>
        )}

        {/* Websites (hidden for suppliers) */}
        {c.contact_type !== "supplier" && (websitesList.length > 0 || c.website) && (
          <Section title="Website" icon={<Globe size={14} />}>
            {websitesList.map((w, i) => (
              <div key={i} className="py-1.5">
                <span className="text-xs text-blue-400 font-medium">{w.label}</span>
                <p className="text-sm text-blue-400 hover:underline cursor-pointer">{w.url}</p>
              </div>
            ))}
            {websitesList.length === 0 && c.website && (
              <p className="text-sm text-blue-400">{c.website}</p>
            )}
          </Section>
        )}

        {/* Birthday (hidden for suppliers, company customers, company type, and employees) */}
        {c.contact_type !== "supplier" && c.contact_type !== "company" && c.contact_type !== "employee" && !(c.contact_type === "customer" && c.entity_type === "company") && c.birthday && (
          <Section title="Birthday" icon={<Calendar size={14} />}>
            <p className="text-sm text-white">{new Date(c.birthday).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
          </Section>
        )}

        {/* Social Profiles (hidden for company customers) */}
        {!(c.contact_type === "customer" && c.entity_type === "company") && socials.length > 0 && (
          <Section title="Social Profiles" icon={<Share2 size={14} />}>
            {socials.map((s, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="flex-1">
                  <span className="text-xs text-blue-400 font-medium">{s.platform}</span>
                  <p className="text-sm text-white">{s.username || s.url}</p>
                </div>
                {s.qr_code_url && (
                  <img src={s.qr_code_url} alt="QR" className="w-10 h-10 rounded border border-[#222]" loading="lazy" decoding="async" />
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Related People (hidden for suppliers, company customers, and company type) */}
        {c.contact_type !== "supplier" && c.contact_type !== "company" && !(c.contact_type === "customer" && c.entity_type === "company") && family.length > 0 && (
          <Section title="Related People" icon={<Users size={14} />}>
            {family.map((f, i) => (
              <div key={i} className="py-2 border-b border-white/[0.03] last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white/50 overflow-hidden">
                    {f.photo_url ? <img src={f.photo_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" /> : (f.first_name?.[0] || "?").toUpperCase()}
                  </div>
                  <div>
                    <span className="text-xs text-blue-400 font-medium">{f.relationship}</span>
                    <p className="text-sm text-white">{[f.title, f.first_name, f.middle_name, f.last_name].filter(Boolean).join(" ")}</p>
                  </div>
                </div>
                {(f.phone || f.email) && (
                  <div className="ml-11 mt-1 text-xs text-white/40 space-y-0.5">
                    {f.phone && <p>Phone: {f.phone}</p>}
                    {f.email && <p>Email: {f.email}</p>}
                  </div>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Business Card (customers only) */}
        {c.contact_type === "customer" && (c.business_card_front || c.business_card_back) && (
          <Section title="Business Card" icon={<CreditCard size={14} />}>
            <div className="grid grid-cols-2 gap-3">
              {c.business_card_front && (
                <div>
                  <span className="text-xs text-white/40 mb-1.5 block">Front</span>
                  <img src={c.business_card_front!} alt="Business Card Front" className="w-full rounded-lg border border-[#222]" loading="lazy" decoding="async" />
                </div>
              )}
              {c.business_card_back && (
                <div>
                  <span className="text-xs text-white/40 mb-1.5 block">Back</span>
                  <img src={c.business_card_back!} alt="Business Card Back" className="w-full rounded-lg border border-[#222]" loading="lazy" decoding="async" />
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Company Customer: Company Info ── */}
        {c.contact_type === "customer" && c.entity_type === "company" && (c.company || c.industry || c.tax_id) && (
          <Section title="Company Info" icon={<Building2 size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.company && (
                <div className="col-span-2">
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Company Name</span>
                  <p className="text-sm text-white font-medium">{c.company}</p>
                </div>
              )}
              {c.industry && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Industry</span>
                  <p className="text-sm text-white">{c.industry}</p>
                </div>
              )}
              {c.tax_id && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Tax ID / Reg. No.</span>
                  <p className="text-sm text-white font-mono">{c.tax_id}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Company Customer: Contact Persons ── */}
        {c.contact_type === "customer" && c.entity_type === "company" && Array.isArray(c.contact_persons) && c.contact_persons.length > 0 && (
          <Section title="Contact Persons" icon={<Users size={14} />}>
            <div className="space-y-2">
              {c.contact_persons.map((cp: { name: string; position: string; department: string; phone: string; mobile: string; email: string; notes: string }, i: number) => (
                <div key={i} className="py-2 border-b border-white/[0.03] last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white/50">
                      {(cp.name?.[0] || "?").toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white font-medium">{cp.name}</p>
                      <div className="flex items-center gap-2">
                        {cp.position && <span className="text-xs text-white/40">{cp.position}</span>}
                        {cp.department && <span className="text-xs text-white/30">{cp.position ? " · " : ""}{cp.department}</span>}
                      </div>
                    </div>
                  </div>
                  {(cp.phone || cp.mobile || cp.email) && (
                    <div className="ml-11 mt-1 text-xs text-white/40 space-y-0.5">
                      {cp.phone && <p>Tel: {cp.phone}</p>}
                      {cp.mobile && <p>Mobile: {cp.mobile}</p>}
                      {cp.email && <p>Email: {cp.email}</p>}
                    </div>
                  )}
                  {cp.notes && <p className="ml-11 mt-1 text-xs text-white/30">{cp.notes}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Company Type: Company Info ── */}
        {c.contact_type === "company" && (c.company || c.industry || c.tax_id || c.source || c.language) && (
          <Section title="Company Info" icon={<Building2 size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.company && (
                <div className="col-span-2">
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Company Name</span>
                  <p className="text-sm text-white font-medium">{c.company}</p>
                </div>
              )}
              {c.industry && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Industry</span>
                  <p className="text-sm text-white">{c.industry}</p>
                </div>
              )}
              {c.tax_id && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Tax ID / Registration</span>
                  <p className="text-sm text-white font-mono">{c.tax_id}</p>
                </div>
              )}
              {c.source && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Source</span>
                  <p className="text-sm text-white">{c.source}</p>
                </div>
              )}
              {c.language && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Language</span>
                  <p className="text-sm text-white">{c.language}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Company Type: Contact Persons ── */}
        {c.contact_type === "company" && Array.isArray(c.contact_persons) && c.contact_persons.length > 0 && (
          <Section title="Contact Persons" icon={<Users size={14} />}>
            <div className="space-y-2">
              {c.contact_persons.map((cp: { name: string; position: string; department: string; phone: string; mobile: string; email: string; notes: string }, i: number) => (
                <div key={i} className="py-2 border-b border-white/[0.03] last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white/50">
                      {(cp.name?.[0] || "?").toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white font-medium">{cp.name}</p>
                      <div className="flex items-center gap-2">
                        {cp.position && <span className="text-xs text-white/40">{cp.position}</span>}
                        {cp.department && <span className="text-xs text-white/30">{cp.position ? " · " : ""}{cp.department}</span>}
                      </div>
                    </div>
                  </div>
                  {(cp.phone || cp.mobile || cp.email) && (
                    <div className="ml-11 mt-1 text-xs text-white/40 space-y-0.5">
                      {cp.phone && <p>Tel: {cp.phone}</p>}
                      {cp.mobile && <p>Mobile: {cp.mobile}</p>}
                      {cp.email && <p>Email: {cp.email}</p>}
                    </div>
                  )}
                  {cp.notes && <p className="ml-11 mt-1 text-xs text-white/30">{cp.notes}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Financial & Business (customer only) ── */}
        {c.contact_type === "customer" && (c.total_revenue || c.outstanding_balance || c.credit_limit || c.payment_terms || c.currency || c.last_order_date) && (
          <Section title="Financial & Business" icon={<DollarSign size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.total_revenue && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Total Revenue</span>
                  <p className="text-sm text-emerald-400 font-semibold">{c.currency || "USD"} {Number(c.total_revenue).toLocaleString()}</p>
                </div>
              )}
              {c.outstanding_balance && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Outstanding</span>
                  <p className="text-sm text-amber-400 font-semibold">{c.currency || "USD"} {Number(c.outstanding_balance).toLocaleString()}</p>
                </div>
              )}
              {c.credit_limit && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Credit Limit</span>
                  <p className="text-sm text-white">{c.currency || "USD"} {Number(c.credit_limit).toLocaleString()}</p>
                </div>
              )}
              {c.payment_terms && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Payment Terms</span>
                  <p className="text-sm text-white">{c.payment_terms}</p>
                </div>
              )}
              {c.currency && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Currency</span>
                  <p className="text-sm text-white">{c.currency}</p>
                </div>
              )}
              {c.last_order_date && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Last Order</span>
                  <p className="text-sm text-white">{new Date(c.last_order_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Classification & Segmentation (customer only) ── */}
        {c.contact_type === "customer" && (c.industry || c.source || (Array.isArray(c.tags) && c.tags.length > 0) || c.account_manager) && (
          <Section title="Classification" icon={<Tag size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.industry && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Industry</span>
                  <p className="text-sm text-white">{c.industry}</p>
                </div>
              )}
              {c.source && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Source</span>
                  <p className="text-sm text-white">{c.source}</p>
                </div>
              )}
              {c.account_manager && (
                <div className="col-span-2">
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Account Manager</span>
                  <p className="text-sm text-white">{c.account_manager}</p>
                </div>
              )}
            </div>
            {Array.isArray(c.tags) && c.tags.length > 0 && (
              <div className="mt-3">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block mb-1.5">Tags</span>
                <div className="flex flex-wrap gap-1.5">
                  {c.tags.map((tag: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-white/5 border border-[#222] text-xs text-white/70">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* ── Relationship & Activity ── */}
        {c.contact_type === "customer" && (c.first_contact_date || c.last_contacted || c.follow_up_date || c.communication_preference || c.language) && (
          <Section title="Relationship & Activity" icon={<Clock size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.first_contact_date && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">First Contact</span>
                  <p className="text-sm text-white">{new Date(c.first_contact_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
              )}
              {c.last_contacted && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Last Contacted</span>
                  <p className="text-sm text-white">{new Date(c.last_contacted).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
              )}
              {c.follow_up_date && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Follow-up Date</span>
                  <p className={`text-sm font-medium ${new Date(c.follow_up_date) < new Date() ? "text-red-400" : "text-blue-400"}`}>{new Date(c.follow_up_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
              )}
              {c.communication_preference && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Prefers</span>
                  <p className="text-sm text-white">{c.communication_preference}</p>
                </div>
              )}
              {c.language && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Language</span>
                  <p className="text-sm text-white">{c.language}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Trade-Specific (customer only) ── */}
        {c.contact_type === "customer" && (c.preferred_shipping || c.tax_id || c.incoterms || (Array.isArray(c.shipping_addresses) && c.shipping_addresses.length > 0)) && (
          <Section title="Trade & Shipping" icon={<Ship size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.preferred_shipping && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Shipping Method</span>
                  <p className="text-sm text-white">{c.preferred_shipping}</p>
                </div>
              )}
              {c.incoterms && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Incoterms</span>
                  <p className="text-sm text-white font-mono">{c.incoterms}</p>
                </div>
              )}
              {c.tax_id && (
                <div className="col-span-2">
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Tax ID / Import License</span>
                  <p className="text-sm text-white font-mono">{c.tax_id}</p>
                </div>
              )}
            </div>
            {Array.isArray(c.shipping_addresses) && c.shipping_addresses.length > 0 && (
              <div className="mt-3 space-y-2">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block">Shipping Addresses</span>
                {c.shipping_addresses.map((a: AddressEntry, i: number) => (
                  <div key={i} className="py-1.5">
                    <span className="text-xs text-blue-400 font-medium">{a.label}</span>
                    <p className="text-sm text-white">{[a.street, a.city, a.state, a.zip, a.country].filter(Boolean).join(", ")}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* ── Attachments (hidden for suppliers) ── */}
        {c.contact_type !== "supplier" && Array.isArray(c.attachments) && c.attachments.length > 0 && (
          <Section title="Documents" icon={<Paperclip size={14} />}>
            <div className="space-y-2">
              {c.attachments.map((a: Attachment, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.02] border border-[#222]">
                  <FileCheck size={16} className="text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{a.name}</p>
                    <p className="text-[10px] text-white/30">{a.type} &middot; {a.uploaded_at ? new Date(a.uploaded_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Supplier: 1. Company Name ── */}
        {c.contact_type === "supplier" && (
          <Section title="Company Name" icon={<Building2 size={14} />}>
            <div className="space-y-2">
              {c.company_name_en && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">English</span>
                  <p className="text-sm text-white font-medium">{c.company_name_en}</p>
                </div>
              )}
              {c.company_name_cn && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Chinese</span>
                  <p className="text-sm text-white font-medium">{c.company_name_cn}</p>
                </div>
              )}
            </div>
            {Array.isArray(c.additional_company_names) && c.additional_company_names.length > 0 && (
              <div className="mt-3">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block mb-1.5">Other Names</span>
                <div className="space-y-1">
                  {c.additional_company_names.map((entry: { language: string; name: string }, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] text-blue-400 font-medium min-w-[60px]">{entry.language}</span>
                      <span className="text-sm text-white">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* ── Supplier: 2. Contact Details ── */}
        {c.contact_type === "supplier" && (c.supplier_tel || c.supplier_mobile || c.supplier_email || c.supplier_website || c.supplier_address || c.country) && (
          <Section title="Contact Details" icon={<Phone size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.supplier_tel && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Tel</span>
                  <p className="text-sm text-white">{c.supplier_tel}</p>
                </div>
              )}
              {c.supplier_mobile && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Mobile</span>
                  <p className="text-sm text-white">{c.supplier_mobile}</p>
                </div>
              )}
              {c.supplier_email && (
                <div className="col-span-2">
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Email</span>
                  <p className="text-sm text-blue-400">{c.supplier_email}</p>
                </div>
              )}
              {c.supplier_website && (
                <div className="col-span-2">
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Website</span>
                  <p className="text-sm text-blue-400 hover:underline cursor-pointer" onClick={() => window.open(c.supplier_website!.startsWith("http") ? c.supplier_website! : "https://" + c.supplier_website!, "_blank")}>{c.supplier_website}</p>
                </div>
              )}
              {c.supplier_address && (
                <div className="col-span-2">
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Address</span>
                  <p className="text-sm text-white">{c.supplier_address}</p>
                </div>
              )}
            </div>
            {(c.country || c.province || c.city) && (
              <div className="mt-3 flex items-center gap-2">
                {c.country_code && <span className="text-base">{countryCodeToFlag(c.country_code)}</span>}
                <p className="text-sm text-white">{[c.city, c.province, c.country].filter(Boolean).join(", ")}</p>
              </div>
            )}
          </Section>
        )}

        {/* ── Supplier: 3. Contact Persons ── */}
        {c.contact_type === "supplier" && Array.isArray(c.contact_persons) && c.contact_persons.length > 0 && (
          <Section title="Contact Persons" icon={<Users size={14} />}>
            <div className="space-y-2">
              {c.contact_persons.map((cp: { name: string; position: string; department: string; phone: string; mobile: string; email: string; notes: string }, i: number) => (
                <div key={i} className="py-2 border-b border-white/[0.03] last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white/50">
                      {(cp.name?.[0] || "?").toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white font-medium">{cp.name}</p>
                      <div className="flex items-center gap-2">
                        {cp.position && <span className="text-xs text-white/40">{cp.position}</span>}
                        {cp.department && <span className="text-xs text-white/30">{cp.position ? " · " : ""}{cp.department}</span>}
                      </div>
                    </div>
                  </div>
                  {(cp.phone || cp.mobile || cp.email) && (
                    <div className="ml-11 mt-1 text-xs text-white/40 space-y-0.5">
                      {cp.phone && <p>Tel: {cp.phone}</p>}
                      {cp.mobile && <p>Mobile: {cp.mobile}</p>}
                      {cp.email && <p>Email: {cp.email}</p>}
                    </div>
                  )}
                  {cp.notes && <p className="ml-11 mt-1 text-xs text-white/30">{cp.notes}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Supplier: 4. Company Profile ── */}
        {c.contact_type === "supplier" && (c.supplier_type || c.industry || c.source || c.division || c.category || (Array.isArray(c.brand_names) && c.brand_names.length > 0)) && (
          <Section title="Company Profile" icon={<Briefcase size={14} />}>
            {Array.isArray(c.brand_names) && c.brand_names.length > 0 && (
              <div className="mb-3">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block mb-1.5">Brands</span>
                <div className="flex flex-wrap gap-1.5">
                  {c.brand_names.map((b: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-white/5 border border-[#222] text-xs text-white/70">{b}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.division && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Division</span>
                  <p className="text-sm text-white">{c.division}</p>
                </div>
              )}
              {c.category && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Category</span>
                  <p className="text-sm text-white">{c.category}</p>
                </div>
              )}
              {c.supplier_type && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Supplier Type</span>
                  <p className="text-sm text-white">{c.supplier_type}</p>
                </div>
              )}
              {c.industry && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Industry</span>
                  <p className="text-sm text-white">{c.industry}</p>
                </div>
              )}
              {c.source && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Source</span>
                  <p className="text-sm text-white">{c.source}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Supplier: 5. Payment & Currency ── */}
        {c.contact_type === "supplier" && (c.payment_terms || c.currency || c.payment_info) && (
          <Section title="Payment & Currency" icon={<DollarSign size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.payment_terms && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Payment Terms</span>
                  <p className="text-sm text-white">{c.payment_terms}</p>
                </div>
              )}
              {c.currency && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Currency</span>
                  <p className="text-sm text-white">{c.currency}</p>
                </div>
              )}
            </div>
            {c.payment_info && (
              <div className="mt-3">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block mb-1">Payment Information</span>
                <p className="text-sm text-white/60 whitespace-pre-wrap">{c.payment_info}</p>
              </div>
            )}
          </Section>
        )}

        {/* ── Supplier: 6. Bank Accounts ── */}
        {c.contact_type === "supplier" && Array.isArray(c.bank_accounts) && c.bank_accounts.length > 0 && (
          <Section title="Bank Accounts" icon={<Landmark size={14} />}>
            <div className="space-y-3">
              {c.bank_accounts.map((bank: { bank_name: string; account_name: string; account_number: string; swift_code: string; iban: string; branch: string; currency: string }, i: number) => (
                <div key={i} className="p-3 rounded-lg bg-white/[0.02] border border-[#222]">
                  <div className="flex items-center gap-2 mb-2">
                    <Landmark size={14} className="text-blue-400" />
                    <span className="text-sm text-white font-medium">{bank.bank_name || "Bank " + (i + 1)}</span>
                    {bank.currency && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 font-medium ml-auto">{bank.currency}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 ml-5">
                    {bank.account_name && (
                      <div>
                        <span className="text-[10px] text-white/30">Account Name</span>
                        <p className="text-xs text-white">{bank.account_name}</p>
                      </div>
                    )}
                    {bank.account_number && (
                      <div>
                        <span className="text-[10px] text-white/30">Account Number</span>
                        <p className="text-xs text-white font-mono">{bank.account_number}</p>
                      </div>
                    )}
                    {bank.swift_code && (
                      <div>
                        <span className="text-[10px] text-white/30">SWIFT / BIC</span>
                        <p className="text-xs text-white font-mono">{bank.swift_code}</p>
                      </div>
                    )}
                    {bank.iban && (
                      <div>
                        <span className="text-[10px] text-white/30">IBAN</span>
                        <p className="text-xs text-white font-mono">{bank.iban}</p>
                      </div>
                    )}
                    {bank.branch && (
                      <div>
                        <span className="text-[10px] text-white/30">Branch</span>
                        <p className="text-xs text-white">{bank.branch}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Supplier: 7. Catalogue ── */}
        {c.contact_type === "supplier" && Array.isArray(c.catalogues) && c.catalogues.length > 0 && (
          <Section title="Catalogue" icon={<BookOpen size={14} />}>
            <div className="space-y-2">
              {c.catalogues.map((cat: { name: string; url: string; type: string; uploaded_at: string }, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.02] border border-[#222]">
                  {cat.type === "PDF" ? <FileText size={16} className="text-red-400 shrink-0" /> : <ImageIcon size={16} className="text-blue-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{cat.name}</p>
                    <p className="text-[10px] text-white/30">{cat.type} {cat.uploaded_at ? " \u00B7 " + new Date(cat.uploaded_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : ""}</p>
                  </div>
                  <button onClick={() => openFilePreview(cat.url)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-white/50 hover:text-white transition-colors">
                    <Eye size={10} /> Preview
                  </button>
                  <button onClick={() => downloadFile(cat.url, cat.name)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-white/50 hover:text-white transition-colors">
                    <Download size={10} /> Download
                  </button>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Supplier: 8. Documents ── */}
        {c.contact_type === "supplier" && Array.isArray(c.documents) && c.documents.length > 0 && (
          <Section title="Documents" icon={<Paperclip size={14} />}>
            <div className="space-y-2">
              {c.documents.map((doc: { doc_name: string; name: string; url: string; type: string; uploaded_at: string }, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.02] border border-[#222]">
                  <FileCheck size={16} className="text-blue-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{doc.doc_name || doc.name}</p>
                    <p className="text-[10px] text-white/30">{doc.type} {doc.uploaded_at ? " · " + new Date(doc.uploaded_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : ""}</p>
                  </div>
                  {doc.url && (
                    <>
                      <button onClick={() => openFilePreview(doc.url)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-white/50 hover:text-white transition-colors">
                        <Eye size={10} /> Preview
                      </button>
                      <button onClick={() => downloadFile(doc.url, doc.name)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-white/50 hover:text-white transition-colors">
                        <Download size={10} /> Download
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Supplier: 9. Quality & Performance ── */}
        {c.contact_type === "supplier" && (c.rating || c.reliability_score || c.sample_status || c.quality_notes || c.last_quality_issue || (Array.isArray(c.certifications) && c.certifications.length > 0)) && (
          <Section title="Quality & Performance" icon={<ShieldCheck size={14} />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {c.rating > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Rating</span>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} size={14} className={s <= (c.rating || 0) ? "text-amber-400 fill-amber-400" : "text-white/10"} />
                    ))}
                  </div>
                </div>
              )}
              {c.reliability_score && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Reliability</span>
                  <p className="text-sm text-white">{c.reliability_score}%</p>
                </div>
              )}
              {c.sample_status && c.sample_status !== "None" && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Sample Status</span>
                  <p className={`text-sm font-medium ${c.sample_status === "Approved" ? "text-emerald-400" : c.sample_status === "Rejected" ? "text-red-400" : "text-white"}`}>{c.sample_status}</p>
                </div>
              )}
              {c.last_quality_issue && (
                <div>
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Last Quality Issue</span>
                  <p className="text-sm text-red-400">{new Date(c.last_quality_issue).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
              )}
            </div>
            {Array.isArray(c.certifications) && c.certifications.length > 0 && (
              <div className="mt-3">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block mb-1.5">Certifications</span>
                <div className="flex flex-wrap gap-1.5">
                  {c.certifications.map((cert: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">{cert}</span>
                  ))}
                </div>
              </div>
            )}
            {c.quality_notes && (
              <div className="mt-3">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block mb-1">Quality Notes</span>
                <p className="text-sm text-white/60 whitespace-pre-wrap">{c.quality_notes}</p>
              </div>
            )}
          </Section>
        )}

        {/* ── Supplier: 10. Products (placeholder) ── */}
        {c.contact_type === "supplier" && (
          <Section title="Products" icon={<Package size={14} />}>
            <div className="flex items-center gap-3 py-3">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                <Package size={18} className="text-white/20" />
              </div>
              <p className="text-sm text-white/30">Products linked to this supplier will appear here when created in the Products module.</p>
            </div>
          </Section>
        )}

        {/* ══ EMPLOYEE DETAIL SECTIONS ══ */}
        {c.contact_type === "employee" && (
        <>
          {/* Work Contact */}
          {(c.work_email || c.work_tel || c.work_mobile) && (
            <Section title="Work Contact" icon={<Phone size={14} />}>
              {c.work_email && <div className="py-1"><span className="text-xs text-white/40">Email</span><p className="text-sm text-white">{c.work_email}</p></div>}
              {c.work_tel && <div className="py-1"><span className="text-xs text-white/40">Tel</span><p className="text-sm text-white">{c.work_tel}</p></div>}
              {c.work_mobile && <div className="py-1"><span className="text-xs text-white/40">Mobile</span><p className="text-sm text-white">{c.work_mobile}</p></div>}
            </Section>
          )}
          {/* Work */}
          {(c.department || c.job_position || c.job_title || c.management || c.manager) && (
            <Section title="Work" icon={<Briefcase size={14} />}>
              {c.management && <div className="py-1"><span className="text-xs text-white/40">Management</span><p className="text-sm text-white">{c.management}</p></div>}
              {c.department && <div className="py-1"><span className="text-xs text-white/40">Department</span><p className="text-sm text-white">{c.department}</p></div>}
              {c.job_position && <div className="py-1"><span className="text-xs text-white/40">Position</span><p className="text-sm text-white">{c.job_position}</p></div>}
              {c.job_title && <div className="py-1"><span className="text-xs text-white/40">Title</span><p className="text-sm text-white">{c.job_title}</p></div>}
              {c.manager && <div className="py-1"><span className="text-xs text-white/40">Manager</span><p className="text-sm text-white">{c.manager}</p></div>}
            </Section>
          )}
          {/* Work Location */}
          {(c.work_address || c.work_location) && (
            <Section title="Work Location" icon={<MapPin size={14} />}>
              {c.work_address && <div className="py-1"><span className="text-xs text-white/40">Address</span><p className="text-sm text-white">{c.work_address}</p></div>}
              {c.work_location && <div className="py-1"><span className="text-xs text-white/40">Location</span><p className="text-sm text-white">{c.work_location}</p></div>}
            </Section>
          )}
          {/* Resume */}
          {Array.isArray(c.resume_lines) && c.resume_lines.length > 0 && (
            <Section title="Resume" icon={<FileText size={14} />}>
              {c.resume_lines.map((rl: any, i: number) => (
                <div key={i} className="py-2 border-b border-[#222] last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                      rl.type === "experience" ? "bg-blue-500/10 text-blue-400" :
                      rl.type === "education" ? "bg-green-500/10 text-green-400" :
                      rl.type === "training" ? "bg-amber-500/10 text-amber-400" :
                      "bg-violet-500/10 text-violet-400"
                    }`}>{rl.type}</span>
                    <span className="text-sm text-white font-medium">{rl.title}</span>
                  </div>
                  {(rl.duration_start || rl.duration_end || rl.is_forever) && (
                    <p className="text-xs text-white/40">{rl.duration_start || ""} {"\u2192"} {rl.is_forever ? "Present" : rl.duration_end || ""}</p>
                  )}
                  {rl.course_type && <p className="text-xs text-white/30 mt-0.5">Type: {rl.course_type}</p>}
                  {rl.notes && <p className="text-xs text-white/50 mt-1">{rl.notes}</p>}
                </div>
              ))}
            </Section>
          )}
          {/* Personal Info */}
          {(c.legal_name || c.birthday || c.place_of_birth || c.gender) && (
            <Section title="Personal Information" icon={<User size={14} />}>
              {c.legal_name && <div className="py-1"><span className="text-xs text-white/40">Legal Name</span><p className="text-sm text-white">{c.legal_name}</p></div>}
              {c.birthday && <div className="py-1"><span className="text-xs text-white/40">Birthday</span><p className="text-sm text-white">{new Date(c.birthday).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p></div>}
              {c.place_of_birth && <div className="py-1"><span className="text-xs text-white/40">Place of Birth</span><p className="text-sm text-white">{c.place_of_birth}</p></div>}
              {c.gender && <div className="py-1"><span className="text-xs text-white/40">Gender</span><p className="text-sm text-white capitalize">{c.gender}</p></div>}
            </Section>
          )}
          {/* Emergency Contact */}
          {Array.isArray(c.emergency_contacts) && c.emergency_contacts.length > 0 && (
            <Section title="Emergency Contact" icon={<ShieldAlert size={14} />}>
              {c.emergency_contacts.map((ec: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#222] last:border-0">
                  <span className="text-sm text-white">{ec.contact}</span>
                  <span className="text-sm text-white/50">{ec.phone}</span>
                </div>
              ))}
            </Section>
          )}
          {/* Visa & Work Permit */}
          {(c.visa_no || c.work_permit) && (
            <Section title="Visa & Work Permit" icon={<Plane size={14} />}>
              {c.visa_no && <div className="py-1"><span className="text-xs text-white/40">Visa No.</span><p className="text-sm text-white">{c.visa_no}</p></div>}
              {c.work_permit && <div className="py-1"><span className="text-xs text-white/40">Work Permit</span><p className="text-sm text-white">{c.work_permit}</p></div>}
            </Section>
          )}
          {/* Citizenship */}
          {(c.nationality || c.id_no || c.ssn_no || c.passport_no) && (
            <Section title="Citizenship" icon={<Globe size={14} />}>
              {c.nationality && <div className="py-1"><span className="text-xs text-white/40">Nationality</span><p className="text-sm text-white">{c.nationality}</p></div>}
              {c.id_no && <div className="py-1"><span className="text-xs text-white/40">ID No.</span><p className="text-sm text-white">{c.id_no}</p></div>}
              {c.ssn_no && <div className="py-1"><span className="text-xs text-white/40">SSN No.</span><p className="text-sm text-white">{c.ssn_no}</p></div>}
              {c.passport_no && <div className="py-1"><span className="text-xs text-white/40">Passport No.</span><p className="text-sm text-white">{c.passport_no}</p></div>}
            </Section>
          )}
          {/* Private Location */}
          {(c.private_address || c.home_work_distance) && (
            <Section title="Private Location" icon={<Home size={14} />}>
              {c.private_address && <div className="py-1"><span className="text-xs text-white/40">Address</span><p className="text-sm text-white">{c.private_address}</p></div>}
              {c.home_work_distance && <div className="py-1"><span className="text-xs text-white/40">Distance</span><p className="text-sm text-white">{c.home_work_distance} KM</p></div>}
            </Section>
          )}
          {/* Family */}
          {(c.marital_status || c.number_of_children) && (
            <Section title="Family" icon={<Heart size={14} />}>
              {c.marital_status && <div className="py-1"><span className="text-xs text-white/40">Marital Status</span><p className="text-sm text-white capitalize">{c.marital_status}</p></div>}
              {c.number_of_children && <div className="py-1"><span className="text-xs text-white/40">Children</span><p className="text-sm text-white">{c.number_of_children}</p></div>}
            </Section>
          )}
          {/* Education */}
          {(c.certificate_level || c.field_of_study) && (
            <Section title="Education" icon={<GraduationCap size={14} />}>
              {c.certificate_level && <div className="py-1"><span className="text-xs text-white/40">Certificate Level</span><p className="text-sm text-white capitalize">{c.certificate_level?.replace(/_/g, " ")}</p></div>}
              {c.field_of_study && <div className="py-1"><span className="text-xs text-white/40">Field of Study</span><p className="text-sm text-white">{c.field_of_study}</p></div>}
            </Section>
          )}
        </>
        )}

        {/* Custom Fields */}
        {customs.length > 0 && (
          <Section title="Custom Fields" icon={<FileText size={14} />}>
            {customs.map((cf, i) => (
              <div key={i} className="py-1.5">
                <span className="text-xs text-blue-400 font-medium">{cf.field_name}</span>
                <p className="text-sm text-white">{cf.field_value}</p>
              </div>
            ))}
          </Section>
        )}

        {/* Notes */}
        {c.notes && (
          <Section title="Notes" icon={<FileText size={14} />}>
            <p className="text-sm text-white/70 whitespace-pre-wrap">{c.notes}</p>
          </Section>
        )}

        {/* Delete confirm */}
        {deleteConfirm === c.id && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-[#111] border border-[#222] rounded-2xl p-6 max-w-sm w-full">
              <h3 className="text-lg font-semibold text-white mb-2">Delete Contact</h3>
              <p className="text-sm text-white/50 mb-6">
                Are you sure you want to delete <strong className="text-white">{contactDisplayName(c)}</strong>? This cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg text-sm border border-[#222] hover:bg-white/5 transition-colors">
                  Cancel
                </button>
                <button onClick={() => handleDelete(c.id)} className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ═════════════════════════════════════════════════════════════════════════
     RENDER: FORM PANEL
     ═════════════════════════════════════════════════════════════════════════ */

  const renderFormPanel = () => {
    const isCustomer = form.contact_type === "customer";
    const isCompanyCustomer = form.contact_type === "customer" && form.entity_type === "company";
    const isPersonCustomer = form.contact_type === "customer" && form.entity_type === "person";
    const isCompanyType = form.contact_type === "company";
    const isEmployee = form.contact_type === "employee";

    /* Determine if province dropdown should show — only for countries that commonly use states/provinces */
    const hasStates = !!form.country_code && COUNTRIES_WITH_STATES.has(form.country_code) && State.getStatesOfCountry(form.country_code).length > 0;

    /* City always shows once country is selected; province is optional */
    const showCity = !!form.country_code;

    return (
      <div className="h-full overflow-y-auto">
        {/* Form header */}
        <div className="px-3 md:px-6 py-3 md:py-4 border-b border-[#222] flex items-center justify-between sticky top-0 bg-[#111] z-10">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="text-white/60 hover:text-white transition-colors">
              <ArrowLeft size={18} />
            </button>
            <h2 className="text-lg font-semibold text-white">
              {editingId ? "Edit Contact" : "New Contact"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCancel} className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm border border-[#222] bg-white/5 hover:bg-white/10 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (!form.first_name && !form.last_name && !form.company && !form.company_name_en)}
              className="flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm bg-white text-black font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : <Save size={14} />}
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {/* Save error banner */}
        {saveError && (
          <div className="mx-4 md:mx-6 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-400 font-medium">Save Failed</p>
                <p className="text-xs text-red-400/70 mt-0.5">{saveError}</p>
              </div>
              <button onClick={() => setSaveError(null)} className="text-red-400/50 hover:text-red-400 shrink-0">
                <X size={14} />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2 ml-6">
              <p className="text-xs text-white/40 flex-1">
                This is usually caused by missing RLS policies. Copy the fix SQL and run it in Supabase Dashboard &rarr; SQL Editor.
              </p>
              <button
                onClick={() => { navigator.clipboard.writeText(RLS_FIX_SQL); setRlsCopied(true); setTimeout(() => setRlsCopied(false), 2000); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/15 text-white/70 shrink-0 transition-colors"
              >
                {rlsCopied ? <><Check size={12} className="text-green-400" /> Copied</> : <><Copy size={12} /> Copy Fix SQL</>}
              </button>
            </div>
          </div>
        )}

        {/* Photo / Logo + Type */}
        <div className="px-4 md:px-6 py-5 md:py-6 text-center border-b border-[#222]">
          <div className={`w-24 h-24 md:w-28 md:h-28 ${form.contact_type === "supplier" || isCompanyCustomer || isCompanyType ? "rounded-2xl" : "rounded-full"} bg-gradient-to-b from-white/15 to-white/5 flex items-center justify-center mx-auto mb-3 relative overflow-hidden`}>
            {form.photo_url ? (
              <img src={form.photo_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            ) : form.contact_type === "supplier" || isCompanyCustomer || isCompanyType ? (
              <Building2 size={32} className="text-white/20" />
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-white/20 mb-1" />
                <div className="w-14 h-7 rounded-t-full bg-white/15" />
              </div>
            )}
          </div>
          {form.photo_url ? (
            <div className="flex items-center justify-center gap-3">
              <label className="text-sm text-blue-400 hover:text-blue-300 cursor-pointer font-medium">
                {form.contact_type === "supplier" || isCompanyCustomer || isCompanyType ? "Change Logo" : "Change Photo"}
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) compressImage(file).then(url => setField("photo_url", url));
                }} />
              </label>
              <button onClick={() => setField("photo_url", "")} className="text-sm text-red-400 hover:text-red-300 font-medium">Remove</button>
            </div>
          ) : (
            <label className="inline-block px-5 py-2 rounded-full bg-white/10 hover:bg-white/15 text-sm text-white/70 font-medium cursor-pointer transition-colors">
              {form.contact_type === "supplier" || isCompanyCustomer || isCompanyType ? "Add Logo" : "Add Photo"}
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (file) compressImage(file).then(url => setField("photo_url", url));
              }} />
            </label>
          )}

          {/* Contact Type selector */}
          <div className="flex items-center gap-2 mt-4 overflow-x-auto md:overflow-visible no-scrollbar px-2 pb-1 md:justify-center md:flex-wrap">
            {CONTACT_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setField("contact_type", t.value)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  form.contact_type === t.value
                    ? `border-white/20 bg-white/10 ${t.color}`
                    : "border-[#222] text-white/30 hover:text-white/50"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Entity type toggle for customers */}
          {form.contact_type === "customer" && (
            <div className="flex items-center gap-2 mt-3 justify-center">
              <button
                onClick={() => setField("entity_type", "person")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  form.entity_type === "person" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-[#222] text-white/30 hover:text-white/50"
                }`}
              >
                <User size={14} /> Individual
              </button>
              <button
                onClick={() => setField("entity_type", "company")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  form.entity_type === "company" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-[#222] text-white/30 hover:text-white/50"
                }`}
              >
                <Building2 size={14} /> Business
              </button>
            </div>
          )}
        </div>

        {/* Company Customer: Company Name section */}
        {isCompanyCustomer && (
        <FormSection title="Company Name" icon={<Building2 size={14} />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Company Name</label>
              <div className="relative">
                <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                <input
                  value={form.company}
                  onChange={e => setField("company", e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Industry</label>
              <input
                value={form.industry}
                onChange={e => setField("industry", e.target.value)}
                placeholder="e.g. Technology, Manufacturing, Retail"
                className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Tax ID / Registration No.</label>
              <input
                value={form.tax_id}
                onChange={e => setField("tax_id", e.target.value)}
                placeholder="e.g. VAT / CR number"
                className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
              />
            </div>
          </div>
        </FormSection>
        )}

        {/* Company Customer: Contact Persons */}
        {isCompanyCustomer && (
        <FormSection title="Contact Persons" icon={<Users size={14} />}>
          <div className="space-y-3">
            {form.contact_persons.map((cp, i) => (
              <div key={i} className="rounded-xl bg-white/[0.02] border border-[#222] overflow-hidden">
                <div className="flex items-center gap-2 p-3">
                  <RemoveBtn onClick={() => setField("contact_persons", form.contact_persons.filter((_, idx) => idx !== i))} />
                  <input
                    value={cp.name}
                    onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], name: e.target.value }; setField("contact_persons", arr); }}
                    placeholder="Name"
                    className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
                  />
                  <input
                    value={cp.position}
                    onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], position: e.target.value }; setField("contact_persons", arr); }}
                    placeholder="Position"
                    className="w-32 h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
                  />
                  <button
                    onClick={() => setExpandedFamily(expandedFamily === 2000 + i ? null : 2000 + i)}
                    className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                  >
                    <ChevronDown size={14} className={`transition-transform ${expandedFamily === 2000 + i ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {expandedFamily === 2000 + i && (
                  <div className="px-3 pb-3 pt-1 ml-8 space-y-2 border-t border-white/[0.03]">
                    <input value={cp.department} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], department: e.target.value }; setField("contact_persons", arr); }} placeholder="Department" className="w-full h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none mt-2" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={cp.phone} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], phone: e.target.value }; setField("contact_persons", arr); }} placeholder="Phone" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none" />
                      <input value={cp.mobile} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], mobile: e.target.value }; setField("contact_persons", arr); }} placeholder="Mobile" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none" />
                    </div>
                    <input value={cp.email} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], email: e.target.value }; setField("contact_persons", arr); }} placeholder="Email" className="w-full h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none" />
                    <textarea value={cp.notes} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], notes: e.target.value }; setField("contact_persons", arr); }} placeholder="Notes" rows={2} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none resize-none" />
                  </div>
                )}
              </div>
            ))}
            <AddButton label="add contact person" onClick={() => setField("contact_persons", [...form.contact_persons, { name: "", position: "", department: "", phone: "", mobile: "", email: "", notes: "" }])} />
          </div>
        </FormSection>
        )}

        {/* Company Type: Company Information */}
        {isCompanyType && (
        <>
        <FormSection title="Company Information" icon={<Building2 size={14} />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Company Name</label>
              <div className="relative">
                <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                <input
                  value={form.company}
                  onChange={e => setField("company", e.target.value)}
                  placeholder="e.g. Koleex International Group"
                  className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Industry</label>
                <input
                  value={form.industry}
                  onChange={e => setField("industry", e.target.value)}
                  placeholder="e.g. Technology"
                  className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Source</label>
                <input
                  value={form.source}
                  onChange={e => setField("source", e.target.value)}
                  placeholder="e.g. Referral, Website"
                  className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Tax ID / Registration No.</label>
                <input
                  value={form.tax_id}
                  onChange={e => setField("tax_id", e.target.value)}
                  placeholder="e.g. CR-12345"
                  className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Language</label>
                <input
                  value={form.language}
                  onChange={e => setField("language", e.target.value)}
                  placeholder="e.g. English, Arabic"
                  className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
                />
              </div>
            </div>
          </div>
        </FormSection>

        {/* Company Type: Contact Persons */}
        <FormSection title="Contact Persons" icon={<Users size={14} />}>
          <div className="space-y-3">
            {form.contact_persons.map((cp, i) => (
              <div key={i} className="rounded-xl bg-white/[0.02] border border-[#222] overflow-hidden">
                <div className="flex items-center gap-2 p-3">
                  <RemoveBtn onClick={() => setField("contact_persons", form.contact_persons.filter((_, idx) => idx !== i))} />
                  <input
                    value={cp.name}
                    onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], name: e.target.value }; setField("contact_persons", arr); }}
                    placeholder="Name"
                    className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
                  />
                  <input
                    value={cp.position}
                    onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], position: e.target.value }; setField("contact_persons", arr); }}
                    placeholder="Position"
                    className="w-32 h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
                  />
                  <button
                    onClick={() => setExpandedFamily(expandedFamily === 3000 + i ? null : 3000 + i)}
                    className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                  >
                    <ChevronDown size={14} className={`transition-transform ${expandedFamily === 3000 + i ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {expandedFamily === 3000 + i && (
                  <div className="px-3 pb-3 pt-1 ml-8 space-y-2 border-t border-white/[0.03]">
                    <input value={cp.department} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], department: e.target.value }; setField("contact_persons", arr); }} placeholder="Department" className="w-full h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none mt-2" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={cp.phone} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], phone: e.target.value }; setField("contact_persons", arr); }} placeholder="Phone" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none" />
                      <input value={cp.mobile} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], mobile: e.target.value }; setField("contact_persons", arr); }} placeholder="Mobile" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none" />
                    </div>
                    <input value={cp.email} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], email: e.target.value }; setField("contact_persons", arr); }} placeholder="Email" className="w-full h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none" />
                    <textarea value={cp.notes} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], notes: e.target.value }; setField("contact_persons", arr); }} placeholder="Notes" rows={2} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none resize-none" />
                  </div>
                )}
              </div>
            ))}
            <AddButton label="add contact person" onClick={() => setField("contact_persons", [...form.contact_persons, { name: "", position: "", department: "", phone: "", mobile: "", email: "", notes: "" }])} />
          </div>
        </FormSection>
        </>
        )}

        {/* Basic Info (hidden for suppliers, company customers, and company type) */}
        {form.contact_type !== "supplier" && !isCompanyCustomer && !isCompanyType && (
        <FormSection title="Basic Information" icon={<User size={14} />}>
          <div className="space-y-3">
            <SelectInput label="Title" value={form.title} onChange={v => setField("title", v)} options={TITLES} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="First Name" value={form.first_name} onChange={v => setField("first_name", v)} />
              <Input label="Middle Name" value={form.middle_name} onChange={v => setField("middle_name", v)} />
            </div>
            <Input label="Last Name / Family Name" value={form.last_name} onChange={v => setField("last_name", v)} />
            <Input label="Company" value={form.company} onChange={v => setField("company", v)} icon={<Building2 size={14} />} />
            <Input label="Position" value={form.position} onChange={v => setField("position", v)} icon={<Briefcase size={14} />} />
          </div>
        </FormSection>
        )}

        {/* Phones (hidden for suppliers and employees) */}
        {form.contact_type !== "supplier" && !isEmployee && (
        <FormSection title="Phone Numbers" icon={<Phone size={14} />}>
          {form.phones.map((p, i) => (
            <div key={i} className="flex items-center gap-2 mb-3">
              <RemoveBtn onClick={() => removePhone(i)} />
              <LabelSelect value={p.label} onChange={v => updatePhone(i, "label", v)} options={PHONE_LABELS} />
              <input
                type="tel"
                value={p.number}
                onChange={e => updatePhone(i, "number", e.target.value)}
                placeholder="Phone number"
                className="flex-1 h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
              />
            </div>
          ))}
          <AddButton label="add phone" onClick={addPhone} />
        </FormSection>
        )}

        {/* Emails (hidden for suppliers and employees) */}
        {form.contact_type !== "supplier" && !isEmployee && (
        <FormSection title="Email Addresses" icon={<Mail size={14} />}>
          {form.emails.map((e, i) => (
            <div key={i} className="flex items-center gap-2 mb-3">
              <RemoveBtn onClick={() => removeEmail(i)} />
              <LabelSelect value={e.label} onChange={v => updateEmail(i, "label", v)} options={EMAIL_LABELS} />
              <input
                type="email"
                value={e.email}
                onChange={ev => updateEmail(i, "email", ev.target.value)}
                placeholder="Email address"
                className="flex-1 h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
              />
            </div>
          ))}
          <AddButton label="add email" onClick={addEmail} />
        </FormSection>
        )}

        {/* Addresses (hidden for suppliers and employees) */}
        {form.contact_type !== "supplier" && !isEmployee && (
        <FormSection title="Addresses" icon={<MapPin size={14} />}>
          {form.addresses.map((a, i) => (
            <div key={i} className="mb-4 p-3 rounded-xl bg-white/[0.02] border border-[#222]">
              <div className="flex items-center gap-2 mb-3">
                <RemoveBtn onClick={() => removeAddress(i)} />
                <LabelSelect value={a.label} onChange={v => updateAddress(i, "label", v)} options={ADDRESS_LABELS} />
              </div>
              <div className="space-y-2 ml-8">
                <input value={a.street} onChange={e => updateAddress(i, "street", e.target.value)} placeholder="Street" className="w-full h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={a.city} onChange={e => updateAddress(i, "city", e.target.value)} placeholder="City" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
                  <input value={a.state} onChange={e => updateAddress(i, "state", e.target.value)} placeholder="State" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={a.zip} onChange={e => updateAddress(i, "zip", e.target.value)} placeholder="ZIP Code" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
                  <input value={a.country} onChange={e => updateAddress(i, "country", e.target.value)} placeholder="Country" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
                </div>
              </div>
            </div>
          ))}
          <AddButton label="add address" onClick={addAddress} />
        </FormSection>
        )}

        {/* Location (country/province/city cascade) - hidden for suppliers and employees */}
        {form.contact_type !== "supplier" && !isEmployee && (
        <FormSection title="Location" icon={<MapPinned size={14} />}>
          <div className="space-y-3">
            <CountryDropdown
              value={form.country_code}
              displayValue={form.country}
              onChange={handleCountryChange}
            />
            {form.country_code && hasStates && (
              <ProvinceDropdown
                countryCode={form.country_code}
                value={form.province_code}
                displayValue={form.province}
                onChange={handleProvinceChange}
              />
            )}
            {showCity && (
              <CityDropdown
                countryCode={form.country_code}
                stateCode={form.province_code}
                value={form.city}
                onChange={handleCityChange}
              />
            )}
          </div>
        </FormSection>
        )}

        {/* Websites (hidden for suppliers and employees) */}
        {form.contact_type !== "supplier" && !isEmployee && (
        <FormSection title="Websites" icon={<Globe size={14} />}>
          {form.websites.map((w, i) => (
            <div key={i} className="flex items-center gap-2 mb-3">
              <RemoveBtn onClick={() => removeWebsite(i)} />
              <LabelSelect value={w.label} onChange={v => updateWebsite(i, "label", v)} options={WEBSITE_LABELS} />
              <input
                type="url"
                value={w.url}
                onChange={e => updateWebsite(i, "url", e.target.value)}
                placeholder="https://"
                className="flex-1 h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
              />
            </div>
          ))}
          <AddButton label="add website" onClick={addWebsite} />
        </FormSection>
        )}

        {/* Birthday (hidden for suppliers, company customers, company type, and employees) */}
        {form.contact_type !== "supplier" && !isCompanyCustomer && !isCompanyType && !isEmployee && (
        <FormSection title="Birthday" icon={<Calendar size={14} />}>
          <BirthdayPicker value={form.birthday} onChange={v => setField("birthday", v)} />
        </FormSection>
        )}

        {/* Social Profiles (hidden for suppliers, company customers, and employees) */}
        {form.contact_type !== "supplier" && !isCompanyCustomer && !isEmployee && (
        <FormSection title="Social Profiles" icon={<Share2 size={14} />}>
          {form.social_profiles.map((s, i) => (
            <div key={i} className="mb-4 p-3 rounded-xl bg-white/[0.02] border border-[#222]">
              <div className="flex items-center gap-2 mb-3">
                <RemoveBtn onClick={() => removeSocial(i)} />
                <LabelSelect value={s.platform} onChange={v => updateSocial(i, "platform", v)} options={SOCIAL_PLATFORMS} />
              </div>
              <div className="space-y-2 ml-8">
                <input value={s.username} onChange={e => updateSocial(i, "username", e.target.value)} placeholder="Username / Handle" className="w-full h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
                <input value={s.url} onChange={e => updateSocial(i, "url", e.target.value)} placeholder="Profile URL" className="w-full h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
                <div>
                  <label className="text-xs text-white/40 mb-1 block">QR Code</label>
                  <div className="flex items-center gap-3">
                    {s.qr_code_url && (
                      <img src={s.qr_code_url} alt="QR" className="w-14 h-14 rounded border border-[#222] object-cover" loading="lazy" decoding="async" />
                    )}
                    <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs text-white/60 cursor-pointer hover:bg-white/10 transition-colors">
                      <Camera size={14} />
                      {s.qr_code_url ? "Change" : "Upload QR"}
                      <input type="file" accept="image/*" className="hidden" onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) compressImage(file, 400, 0.8).then(url => updateSocial(i, "qr_code_url", url));
                      }} />
                    </label>
                    {s.qr_code_url && (
                      <button onClick={() => updateSocial(i, "qr_code_url", "")} className="text-xs text-white/30 hover:text-white">Remove</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <AddButton label="add social profile" onClick={addSocial} />
        </FormSection>
        )}

        {/* Related People (hidden for suppliers, company customers, company type, and employees) */}
        {form.contact_type !== "supplier" && !isCompanyCustomer && !isCompanyType && !isEmployee && (
        <FormSection title="Related People" icon={<Users size={14} />}>
          {form.family_members.map((f, i) => (
            <div key={i} className="mb-3 rounded-xl bg-white/[0.02] border border-[#222] overflow-hidden">
              <div className="flex items-center gap-2 p-3">
                <RemoveBtn onClick={() => removeFamily(i)} />
                <LabelSelect value={f.relationship} onChange={v => updateFamily(i, "relationship", v)} options={RELATED_PEOPLE_LABELS} />
                <input
                  value={f.first_name}
                  onChange={e => updateFamily(i, "first_name", e.target.value)}
                  placeholder="Name"
                  className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
                />
                <button
                  onClick={() => setExpandedFamily(expandedFamily === i ? null : i)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                >
                  <ChevronDown size={14} className={`transition-transform ${expandedFamily === i ? "rotate-180" : ""}`} />
                </button>
              </div>
              {expandedFamily === i && (
                <div className="px-3 pb-3 pt-1 ml-8 space-y-2 border-t border-white/[0.03]">
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input value={f.last_name} onChange={e => updateFamily(i, "last_name", e.target.value)} placeholder="Last Name" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none" />
                    <input value={f.phone} onChange={e => updateFamily(i, "phone", e.target.value)} placeholder="Phone" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none" />
                  </div>
                  <input value={f.email} onChange={e => updateFamily(i, "email", e.target.value)} placeholder="Email" className="w-full h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none" />
                  <textarea value={f.notes} onChange={e => updateFamily(i, "notes", e.target.value)} placeholder="Notes" rows={2} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none resize-none" />
                </div>
              )}
            </div>
          ))}
          <AddButton label="add related person" onClick={addFamily} />
        </FormSection>
        )}

        {/* Notes (shared — hidden for suppliers, they have their own at the end) */}
        {form.contact_type !== "supplier" && (
        <FormSection title="Notes" icon={<FileText size={14} />}>
          <textarea
            value={form.notes}
            onChange={e => setField("notes", e.target.value)}
            placeholder="Add notes..."
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20 resize-none"
          />
        </FormSection>
        )}

        {/* Custom Fields (hidden for suppliers) */}
        {form.contact_type !== "supplier" && (
        <FormSection title="Custom Fields" icon={<Hash size={14} />}>
          {form.custom_fields.map((cf, i) => (
            <div key={i} className="flex items-center gap-2 mb-3">
              <RemoveBtn onClick={() => removeCustomField(i)} />
              <input
                value={cf.field_name}
                onChange={e => updateCustomField(i, "field_name", e.target.value)}
                placeholder="Field Name"
                className="w-32 h-10 px-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-medium outline-none"
              />
              <input
                value={cf.field_value}
                onChange={e => updateCustomField(i, "field_value", e.target.value)}
                placeholder="Value"
                className="flex-1 h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
              />
            </div>
          ))}
          <AddButton label="add field" onClick={addCustomField} />
        </FormSection>
        )}

        {/* Business Card (customers only) */}
        {isCustomer && (
          <FormSection title="Business Card" icon={<CreditCard size={14} />}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Front</label>
                <label className="flex flex-col items-center justify-center w-full aspect-[1.6/1] rounded-lg border-2 border-dashed border-[#222] hover:border-white/20 bg-white/[0.02] cursor-pointer transition-colors overflow-hidden">
                  {form.business_card_front ? (
                    <img src={form.business_card_front} alt="Front" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-white/30">
                      <CreditCard size={18} />
                      <span className="text-[11px]">Upload Front</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) compressImage(file).then(url => setField("business_card_front", url));
                  }} />
                </label>
                {form.business_card_front && (
                  <button onClick={() => setField("business_card_front", "")} className="text-xs text-white/30 hover:text-white mt-1.5">Remove</button>
                )}
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Back</label>
                <label className="flex flex-col items-center justify-center w-full aspect-[1.6/1] rounded-lg border-2 border-dashed border-[#222] hover:border-white/20 bg-white/[0.02] cursor-pointer transition-colors overflow-hidden">
                  {form.business_card_back ? (
                    <img src={form.business_card_back} alt="Back" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-white/30">
                      <CreditCard size={18} />
                      <span className="text-[11px]">Upload Back</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) compressImage(file).then(url => setField("business_card_back", url));
                  }} />
                </label>
                {form.business_card_back && (
                  <button onClick={() => setField("business_card_back", "")} className="text-xs text-white/30 hover:text-white mt-1.5">Remove</button>
                )}
              </div>
            </div>
          </FormSection>
        )}

        {/* ── Financial & Business (customer only) ── */}
        {isCustomer && (
          <FormSection title="Financial & Business" icon={<DollarSign size={14} />}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <SelectInput label="Currency" value={form.currency} onChange={v => setField("currency", v)} options={CURRENCIES} icon={<DollarSign size={14} />} />
                <SelectInput label="Payment Terms" value={form.payment_terms} onChange={v => setField("payment_terms", v)} options={PAYMENT_TERMS_OPTIONS} icon={<Receipt size={14} />} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Total Revenue" value={form.total_revenue} onChange={v => setField("total_revenue", v)} placeholder="0.00" icon={<TrendingUp size={14} />} />
                <Input label="Outstanding Balance" value={form.outstanding_balance} onChange={v => setField("outstanding_balance", v)} placeholder="0.00" icon={<Receipt size={14} />} />
              </div>
              <Input label="Credit Limit" value={form.credit_limit} onChange={v => setField("credit_limit", v)} placeholder="0.00" icon={<Wallet size={14} />} />
              <div>
                <label className="text-xs text-white/40 mb-1 block">Last Order Date</label>
                <input
                  type="date"
                  value={form.last_order_date}
                  onChange={e => setField("last_order_date", e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white outline-none focus:border-white/20 [color-scheme:dark]"
                />
              </div>
            </div>
          </FormSection>
        )}

        {/* ── Classification & Segmentation (customer only) ── */}
        {isCustomer && (
          <FormSection title="Classification & Segmentation" icon={<Tag size={14} />}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <SelectInput label="Industry" value={form.industry} onChange={v => setField("industry", v)} options={INDUSTRIES} icon={<Factory size={14} />} />
                <SelectInput label="Source" value={form.source} onChange={v => setField("source", v)} options={LEAD_SOURCES} icon={<Target size={14} />} />
              </div>
              <Input label="Account Manager" value={form.account_manager} onChange={v => setField("account_manager", v)} placeholder="Name" icon={<UserCog size={14} />} />
              <div>
                <label className="text-xs text-white/40 mb-1 block">Tags</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.tags.map((tag, i) => (
                    <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-[#222] text-xs text-white/70">
                      {tag}
                      <button onClick={() => setField("tags", form.tags.filter((_, idx) => idx !== i))} className="text-white/30 hover:text-white">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    id="tag-input"
                    placeholder="Add tag..."
                    className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val && !form.tags.includes(val)) {
                          setField("tags", [...form.tags, val]);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById("tag-input") as HTMLInputElement;
                      const val = input?.value.trim();
                      if (val && !form.tags.includes(val)) {
                        setField("tags", [...form.tags, val]);
                        input.value = "";
                      }
                    }}
                    className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-xs text-white/50 hover:text-white transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </FormSection>
        )}

        {/* ── Relationship & Activity (customer only) ── */}
        {isCustomer && (
          <FormSection title="Relationship & Activity" icon={<Clock size={14} />}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <SelectInput label="Communication" value={form.communication_preference} onChange={v => setField("communication_preference", v)} options={COMM_PREFERENCES} icon={<MessageSquare size={14} />} />
                <SelectInput label="Language" value={form.language} onChange={v => setField("language", v)} options={LANGUAGES} icon={<Languages size={14} />} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">First Contact</label>
                  <input type="date" value={form.first_contact_date} onChange={e => setField("first_contact_date", e.target.value)} className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white outline-none focus:border-white/20 [color-scheme:dark]" />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Last Contacted</label>
                  <input type="date" value={form.last_contacted} onChange={e => setField("last_contacted", e.target.value)} className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white outline-none focus:border-white/20 [color-scheme:dark]" />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Follow-up Date</label>
                <input type="date" value={form.follow_up_date} onChange={e => setField("follow_up_date", e.target.value)} className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white outline-none focus:border-white/20 [color-scheme:dark]" />
              </div>
            </div>
          </FormSection>
        )}

        {/* ── Trade & Shipping (customer only) ── */}
        {isCustomer && (
          <FormSection title="Trade & Shipping" icon={<Ship size={14} />}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <SelectInput label="Shipping Method" value={form.preferred_shipping} onChange={v => setField("preferred_shipping", v)} options={SHIPPING_METHODS} icon={<Ship size={14} />} />
                <SelectInput label="Incoterms" value={form.incoterms} onChange={v => setField("incoterms", v)} options={INCOTERMS_OPTIONS} icon={<FileCheck size={14} />} />
              </div>
              <Input label="Tax ID / Import License" value={form.tax_id} onChange={v => setField("tax_id", v)} placeholder="License or Tax ID number" icon={<Hash size={14} />} />
              {/* Shipping Addresses */}
              <div>
                <label className="text-xs text-white/40 mb-2 block">Shipping Addresses</label>
                {form.shipping_addresses.map((a, i) => (
                  <div key={i} className="mb-3 p-3 rounded-xl bg-white/[0.02] border border-[#222]">
                    <div className="flex items-center gap-2 mb-2">
                      <RemoveBtn onClick={() => setField("shipping_addresses", form.shipping_addresses.filter((_, idx) => idx !== i))} />
                      <LabelSelect value={a.label} onChange={v => { const arr = [...form.shipping_addresses]; arr[i] = { ...arr[i], label: v }; setField("shipping_addresses", arr); }} options={["warehouse", "port", "office", "other"]} />
                    </div>
                    <div className="space-y-2 ml-8">
                      <input value={a.street} onChange={e => { const arr = [...form.shipping_addresses]; arr[i] = { ...arr[i], street: e.target.value }; setField("shipping_addresses", arr); }} placeholder="Street" className="w-full h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
                      <div className="grid grid-cols-2 gap-2">
                        <input value={a.city} onChange={e => { const arr = [...form.shipping_addresses]; arr[i] = { ...arr[i], city: e.target.value }; setField("shipping_addresses", arr); }} placeholder="City" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none" />
                        <input value={a.state} onChange={e => { const arr = [...form.shipping_addresses]; arr[i] = { ...arr[i], state: e.target.value }; setField("shipping_addresses", arr); }} placeholder="State" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={a.zip} onChange={e => { const arr = [...form.shipping_addresses]; arr[i] = { ...arr[i], zip: e.target.value }; setField("shipping_addresses", arr); }} placeholder="ZIP Code" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none" />
                        <input value={a.country} onChange={e => { const arr = [...form.shipping_addresses]; arr[i] = { ...arr[i], country: e.target.value }; setField("shipping_addresses", arr); }} placeholder="Country" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none" />
                      </div>
                    </div>
                  </div>
                ))}
                <AddButton label="add shipping address" onClick={() => setField("shipping_addresses", [...form.shipping_addresses, { label: "warehouse", street: "", city: "", state: "", zip: "", country: "" }])} />
              </div>
            </div>
          </FormSection>
        )}

        {/* ── Documents / Attachments (customer only) ── */}
        {isCustomer && (
          <FormSection title="Documents & Attachments" icon={<Paperclip size={14} />}>
            {form.attachments.map((a, i) => (
              <div key={i} className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-[#222]">
                <RemoveBtn onClick={() => setField("attachments", form.attachments.filter((_, idx) => idx !== i))} />
                <FileCheck size={14} className="text-blue-400 shrink-0" />
                <span className="text-sm text-white truncate flex-1">{a.name}</span>
                <span className="text-[10px] text-white/30">{a.type}</span>
              </div>
            ))}
            <label className="flex items-center gap-2 mt-2 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-dashed border-[#222] hover:border-white/20 cursor-pointer transition-colors">
              <Paperclip size={14} className="text-white/40" />
              <span className="text-xs text-white/40">Upload document (contract, license, ID...)</span>
              <input type="file" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  const isImage = file.type.startsWith("image/");
                  const handler = isImage ? compressImage(file, 1200, 0.8) : readFileAsDataURL(file);
                  handler.then(url => {
                    setField("attachments", [...form.attachments, {
                      name: file.name,
                      url,
                      type: file.type.split("/").pop()?.toUpperCase() || "FILE",
                      uploaded_at: new Date().toISOString(),
                    }]);
                  });
                }
              }} />
            </label>
          </FormSection>
        )}

        {/* ══ SUPPLIER FORM SECTIONS (ordered by priority) ══ */}
        {form.contact_type === "supplier" && (
          <>
            {/* 1. Company Name — Most important, identity of the supplier */}
            <FormSection title="Company Name" icon={<Building2 size={14} />}>
              <div className="space-y-3">
                <Input label="Company Name in English" value={form.company_name_en} onChange={v => setField("company_name_en", v)} placeholder="e.g. Shenzhen ABC Trading Co., Ltd." icon={<Building2 size={14} />} />
                <Input label="Company Name in Chinese" value={form.company_name_cn} onChange={v => setField("company_name_cn", v)} placeholder="e.g. &#28145;&#22323;ABC&#36152;&#26131;&#26377;&#38480;&#20844;&#21496;" icon={<Languages size={14} />} />
                {/* Additional Company Names */}
                <div>
                  <label className="text-xs text-white/40 mb-2 block">Additional Company Names</label>
                  {form.additional_company_names.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <RemoveBtn onClick={() => setField("additional_company_names", form.additional_company_names.filter((_, idx) => idx !== i))} />
                      <input
                        value={entry.language}
                        onChange={e => { const arr = [...form.additional_company_names]; arr[i] = { ...arr[i], language: e.target.value }; setField("additional_company_names", arr); }}
                        placeholder="Language"
                        className="w-28 h-9 px-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-medium outline-none"
                      />
                      <input
                        value={entry.name}
                        onChange={e => { const arr = [...form.additional_company_names]; arr[i] = { ...arr[i], name: e.target.value }; setField("additional_company_names", arr); }}
                        placeholder="Company name in this language"
                        className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
                      />
                    </div>
                  ))}
                  <AddButton label="add company name" onClick={() => setField("additional_company_names", [...form.additional_company_names, { language: "", name: "" }])} />
                </div>
              </div>
            </FormSection>

            {/* 2. Contact Details — How to reach the supplier */}
            <FormSection title="Contact Details" icon={<Phone size={14} />}>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Tel" value={form.supplier_tel} onChange={v => setField("supplier_tel", v)} placeholder="Telephone number" icon={<Phone size={14} />} />
                  <Input label="Mobile" value={form.supplier_mobile} onChange={v => setField("supplier_mobile", v)} placeholder="Mobile number" icon={<Phone size={14} />} />
                </div>
                <Input label="Email" value={form.supplier_email} onChange={v => setField("supplier_email", v)} placeholder="company@example.com" icon={<Mail size={14} />} />
                <Input label="Website" value={form.supplier_website} onChange={v => setField("supplier_website", v)} placeholder="https://www.example.com" icon={<Globe size={14} />} />
                <Input label="Address" value={form.supplier_address} onChange={v => setField("supplier_address", v)} placeholder="Full address" icon={<MapPin size={14} />} />
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Country / Province / City</label>
                  <div className="space-y-2">
                    <CountryDropdown value={form.country_code} displayValue={form.country} onChange={handleCountryChange} />
                    {form.country_code && hasStates && (
                      <ProvinceDropdown countryCode={form.country_code} value={form.province_code} displayValue={form.province} onChange={handleProvinceChange} />
                    )}
                    {showCity && (
                      <CityDropdown countryCode={form.country_code} stateCode={form.province_code} value={form.city} onChange={handleCityChange} />
                    )}
                  </div>
                </div>
              </div>
            </FormSection>

            {/* 3. Contact Persons — Key people to communicate with */}
            <FormSection title="Contact Persons" icon={<Users size={14} />}>
              <div className="space-y-3">
                {form.contact_persons.map((cp, i) => (
                  <div key={i} className="rounded-xl bg-white/[0.02] border border-[#222] overflow-hidden">
                    <div className="flex items-center gap-2 p-3">
                      <RemoveBtn onClick={() => setField("contact_persons", form.contact_persons.filter((_, idx) => idx !== i))} />
                      <input
                        value={cp.name}
                        onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], name: e.target.value }; setField("contact_persons", arr); }}
                        placeholder="Name"
                        className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
                      />
                      <input
                        value={cp.position}
                        onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], position: e.target.value }; setField("contact_persons", arr); }}
                        placeholder="Position"
                        className="w-32 h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
                      />
                      <button
                        onClick={() => setExpandedFamily(expandedFamily === 1000 + i ? null : 1000 + i)}
                        className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                      >
                        <ChevronDown size={14} className={`transition-transform ${expandedFamily === 1000 + i ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                    {expandedFamily === 1000 + i && (
                      <div className="px-3 pb-3 pt-1 ml-8 space-y-2 border-t border-white/[0.03]">
                        <input value={cp.department} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], department: e.target.value }; setField("contact_persons", arr); }} placeholder="Department" className="w-full h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none mt-2" />
                        <div className="grid grid-cols-2 gap-2">
                          <input value={cp.phone} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], phone: e.target.value }; setField("contact_persons", arr); }} placeholder="Phone" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none" />
                          <input value={cp.mobile} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], mobile: e.target.value }; setField("contact_persons", arr); }} placeholder="Mobile" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none" />
                        </div>
                        <input value={cp.email} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], email: e.target.value }; setField("contact_persons", arr); }} placeholder="Email" className="w-full h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none" />
                        <textarea value={cp.notes} onChange={e => { const arr = [...form.contact_persons]; arr[i] = { ...arr[i], notes: e.target.value }; setField("contact_persons", arr); }} placeholder="Notes" rows={2} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none resize-none" />
                      </div>
                    )}
                  </div>
                ))}
                <AddButton label="add contact person" onClick={() => setField("contact_persons", [...form.contact_persons, { name: "", position: "", department: "", phone: "", mobile: "", email: "", notes: "" }])} />
              </div>
            </FormSection>

            {/* 4. Company Profile — Brand, classification, and business identity */}
            <FormSection title="Company Profile" icon={<Briefcase size={14} />}>
              <div className="space-y-3">
                {/* Brand Names */}
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Brand</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {form.brand_names.map((b, i) => (
                      <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-[#222] text-xs text-white/70">
                        {b}
                        <button onClick={() => setField("brand_names", form.brand_names.filter((_, idx) => idx !== i))} className="text-white/30 hover:text-white"><X size={10} /></button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input id="brand-input" placeholder="Add brand..." className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const val = (e.target as HTMLInputElement).value.trim(); if (val && !form.brand_names.includes(val)) { setField("brand_names", [...form.brand_names, val]); (e.target as HTMLInputElement).value = ""; } } }} />
                    <button onClick={() => { const input = document.getElementById("brand-input") as HTMLInputElement; const val = input?.value.trim(); if (val && !form.brand_names.includes(val)) { setField("brand_names", [...form.brand_names, val]); input.value = ""; } }} className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-xs text-white/50 hover:text-white transition-colors">Add</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Division" value={form.division} onChange={v => setField("division", v)} placeholder="e.g. Electronics Division" />
                  <Input label="Category" value={form.category} onChange={v => setField("category", v)} placeholder="Optional" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SelectInput label="Supplier Type" value={form.supplier_type} onChange={v => setField("supplier_type", v)} options={SUPPLIER_TYPES} icon={<Building2 size={14} />} />
                  <SelectInput label="Industry" value={form.industry} onChange={v => setField("industry", v)} options={INDUSTRIES} icon={<Factory size={14} />} />
                </div>
                <SelectInput label="Source" value={form.source} onChange={v => setField("source", v)} options={SUPPLIER_SOURCES} icon={<Target size={14} />} />
              </div>
            </FormSection>

            {/* 5. Payment & Currency */}
            <FormSection title="Payment & Currency" icon={<DollarSign size={14} />}>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <SelectInput label="Payment Terms" value={form.payment_terms} onChange={v => setField("payment_terms", v)} options={PAYMENT_TERMS_OPTIONS} icon={<Receipt size={14} />} />
                  <SelectInput label="Currency" value={form.currency} onChange={v => setField("currency", v)} options={CURRENCIES} icon={<DollarSign size={14} />} />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Payment Information</label>
                  <textarea value={form.payment_info} onChange={e => setField("payment_info", e.target.value)} placeholder="Bank transfer details, payment notes, etc." rows={3} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none resize-none focus:border-white/20" />
                </div>
              </div>
            </FormSection>

            {/* 6. Bank Account Information */}
            <FormSection title="Bank Account Information" icon={<Landmark size={14} />}>
              <div className="space-y-3">
                {form.bank_accounts.map((bank, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-[#222] space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <RemoveBtn onClick={() => setField("bank_accounts", form.bank_accounts.filter((_, idx) => idx !== i))} />
                      <span className="text-xs text-white/50 font-medium">Account {i + 1}</span>
                    </div>
                    <div className="space-y-2 ml-8">
                      <div className="grid grid-cols-2 gap-2">
                        <input value={bank.bank_name} onChange={e => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], bank_name: e.target.value }; setField("bank_accounts", arr); }} placeholder="Bank Name" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
                        <input value={bank.account_name} onChange={e => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], account_name: e.target.value }; setField("bank_accounts", arr); }} placeholder="Account Name" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
                      </div>
                      <input value={bank.account_number} onChange={e => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], account_number: e.target.value }; setField("bank_accounts", arr); }} placeholder="Account Number" className="w-full h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
                      <div className="grid grid-cols-2 gap-2">
                        <input value={bank.swift_code} onChange={e => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], swift_code: e.target.value }; setField("bank_accounts", arr); }} placeholder="SWIFT / BIC Code" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
                        <input value={bank.iban} onChange={e => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], iban: e.target.value }; setField("bank_accounts", arr); }} placeholder="IBAN" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={bank.branch} onChange={e => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], branch: e.target.value }; setField("bank_accounts", arr); }} placeholder="Branch" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
                        <input value={bank.currency} onChange={e => { const arr = [...form.bank_accounts]; arr[i] = { ...arr[i], currency: e.target.value }; setField("bank_accounts", arr); }} placeholder="Currency (e.g. USD)" className="h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
                      </div>
                    </div>
                  </div>
                ))}
                <AddButton label="add bank account" onClick={() => setField("bank_accounts", [...form.bank_accounts, { bank_name: "", account_name: "", account_number: "", swift_code: "", iban: "", branch: "", currency: "" }])} />
              </div>
            </FormSection>

            {/* 7. Catalogue */}
            <FormSection title="Catalogue" icon={<BookOpen size={14} />}>
              <div className="space-y-2">
                {form.catalogues.map((cat, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-[#222]">
                    <RemoveBtn onClick={() => setField("catalogues", form.catalogues.filter((_, idx) => idx !== i))} />
                    {cat.type === "PDF" ? <FileText size={14} className="text-red-400 shrink-0" /> : <ImageIcon size={14} className="text-blue-400 shrink-0" />}
                    <span className="text-sm text-white truncate flex-1">{cat.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 font-medium">{cat.type}</span>
                    {cat.url && (
                      <button onClick={() => openFilePreview(cat.url)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-white/50 hover:text-white transition-colors">
                        {cat.type === "PDF" ? <ExternalLink size={10} /> : <Eye size={10} />} {cat.type === "PDF" ? "Open" : "Preview"}
                      </button>
                    )}
                    {cat.url && (
                      <button onClick={() => downloadFile(cat.url, cat.name)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-white/50 hover:text-white transition-colors">
                        <Download size={10} /> Download
                      </button>
                    )}
                  </div>
                ))}
                <label className="flex items-center gap-2 px-3 py-3 rounded-lg bg-white/[0.03] border border-dashed border-[#222] hover:border-white/20 cursor-pointer transition-colors">
                  <FilePlus size={14} className="text-white/40" />
                  <span className="text-xs text-white/40">Upload catalogue (PDF or image)</span>
                  <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const isPdf = file.type === "application/pdf";
                      const handler = isPdf ? readFileAsDataURL(file) : compressImage(file, 1200, 0.8);
                      handler.then(url => {
                        setField("catalogues", [...form.catalogues, { name: file.name, url, type: isPdf ? "PDF" : file.type.split("/").pop()?.toUpperCase() || "IMAGE", uploaded_at: new Date().toISOString() }]);
                      });
                    }
                  }} />
                </label>
              </div>
            </FormSection>

            {/* 8. Documents */}
            <FormSection title="Documents" icon={<Paperclip size={14} />}>
              <div className="space-y-2">
                {form.documents.map((doc, i) => (
                  <div key={i} className="p-3 rounded-lg bg-white/[0.02] border border-[#222] space-y-2">
                    <div className="flex items-center gap-2">
                      <RemoveBtn onClick={() => setField("documents", form.documents.filter((_, idx) => idx !== i))} />
                      {doc.url ? (
                        <>
                          <FileCheck size={14} className="text-blue-400 shrink-0" />
                          <span className="text-xs text-white/60 font-medium truncate">{doc.doc_name || "Untitled"}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 font-medium ml-auto">{doc.type}</span>
                          <button onClick={() => openFilePreview(doc.url)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-white/50 hover:text-white transition-colors">
                            {doc.type === "PDF" ? <ExternalLink size={10} /> : <Eye size={10} />} {doc.type === "PDF" ? "Open" : "Preview"}
                          </button>
                          <button onClick={() => downloadFile(doc.url, doc.name)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-white/50 hover:text-white transition-colors">
                            <Download size={10} /> Download
                          </button>
                        </>
                      ) : (
                        <>
                          <input
                            value={doc.doc_name}
                            onChange={e => { const arr = [...form.documents]; arr[i] = { ...arr[i], doc_name: e.target.value }; setField("documents", arr); }}
                            placeholder="Document name (e.g. Business License)"
                            className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
                          />
                          <label className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-[#222] text-xs text-white/50 hover:text-white cursor-pointer transition-colors shrink-0">
                            <Paperclip size={12} /> Upload
                            <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const isPdf = file.type === "application/pdf";
                                const handler = isPdf ? readFileAsDataURL(file) : compressImage(file, 1200, 0.8);
                                handler.then(url => {
                                  const arr = [...form.documents];
                                  arr[i] = { ...arr[i], name: file.name, url, type: isPdf ? "PDF" : file.type.split("/").pop()?.toUpperCase() || "FILE", uploaded_at: new Date().toISOString() };
                                  setField("documents", arr);
                                });
                              }
                            }} />
                          </label>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <AddButton label="add document" onClick={() => setField("documents", [...form.documents, { doc_name: "", name: "", url: "", type: "", uploaded_at: "" }])} />
              </div>
            </FormSection>

            {/* 9. Quality & Performance */}
            <FormSection title="Quality & Performance" icon={<ShieldCheck size={14} />}>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">Rating</label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button key={s} onClick={() => setField("rating", form.rating === s ? 0 : s)} className="p-0.5 transition-colors">
                        <Star size={22} className={s <= form.rating ? "text-amber-400 fill-amber-400" : "text-white/15 hover:text-white/30"} />
                      </button>
                    ))}
                    {form.rating > 0 && <span className="text-xs text-white/30 ml-2">{form.rating}/5</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Reliability Score (%)" value={form.reliability_score} onChange={v => setField("reliability_score", v)} placeholder="e.g. 95" icon={<TrendingUp size={14} />} />
                  <SelectInput label="Sample Status" value={form.sample_status} onChange={v => setField("sample_status", v)} options={SAMPLE_STATUSES} icon={<Package size={14} />} />
                </div>
                {/* Certifications */}
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Certifications</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {form.certifications.map((cert, i) => (
                      <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                        {cert}
                        <button onClick={() => setField("certifications", form.certifications.filter((_, idx) => idx !== i))} className="text-emerald-400/50 hover:text-emerald-400"><X size={10} /></button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <select onChange={e => { const val = e.target.value; if (val && !form.certifications.includes(val)) setField("certifications", [...form.certifications, val]); e.target.value = ""; }} className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white outline-none cursor-pointer">
                      <option value="" className="bg-[#111]">Add certification...</option>
                      {CERTIFICATIONS_LIST.filter(c => !form.certifications.includes(c)).map(c => <option key={c} value={c} className="bg-[#111]">{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Last Quality Issue</label>
                  <input type="date" value={form.last_quality_issue} onChange={e => setField("last_quality_issue", e.target.value)} className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white outline-none focus:border-white/20 [color-scheme:dark]" />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Quality Notes</label>
                  <textarea value={form.quality_notes} onChange={e => setField("quality_notes", e.target.value)} placeholder="Quality observations..." rows={3} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none resize-none focus:border-white/20" />
                </div>
              </div>
            </FormSection>

            {/* 10. Products (placeholder) */}
            <FormSection title="Products" icon={<Package size={14} />}>
              <div className="flex items-center gap-3 py-4">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                  <Package size={18} className="text-white/20" />
                </div>
                <p className="text-sm text-white/30">Products linked to this supplier will appear here when created in the Products module.</p>
              </div>
            </FormSection>

            {/* 11. Notes */}
            <FormSection title="Notes" icon={<FileText size={14} />}>
              <textarea
                value={form.notes}
                onChange={e => setField("notes", e.target.value)}
                placeholder="General notes about this supplier..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20 resize-none"
              />
            </FormSection>

            {/* 12. Custom Fields */}
            <FormSection title="Custom Fields" icon={<Hash size={14} />}>
              {form.custom_fields.map((cf, i) => (
                <div key={i} className="flex items-center gap-2 mb-3">
                  <RemoveBtn onClick={() => removeCustomField(i)} />
                  <input
                    value={cf.field_name}
                    onChange={e => updateCustomField(i, "field_name", e.target.value)}
                    placeholder="Field Name"
                    className="w-32 h-10 px-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-medium outline-none"
                  />
                  <input
                    value={cf.field_value}
                    onChange={e => updateCustomField(i, "field_value", e.target.value)}
                    placeholder="Value"
                    className="flex-1 h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
                  />
                </div>
              ))}
              <AddButton label="add field" onClick={addCustomField} />
            </FormSection>
          </>
        )}

        {/* ══ EMPLOYEE FORM SECTIONS ══ */}
        {isEmployee && (
        <>
        {/* 1. Work Contact */}
        <FormSection title="Work Contact" icon={<Phone size={14} />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Work Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                <input value={form.work_email} onChange={e => setField("work_email", e.target.value)} placeholder="employee@company.com" className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Work Tel</label>
                <input value={form.work_tel} onChange={e => setField("work_tel", e.target.value)} placeholder="+1 234 567 890" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Work Mobile</label>
                <input value={form.work_mobile} onChange={e => setField("work_mobile", e.target.value)} placeholder="+1 234 567 890" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
              </div>
            </div>
          </div>
        </FormSection>

        {/* 2. Work */}
        <FormSection title="Work" icon={<Briefcase size={14} />}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Management</label>
                <input value={form.management} onChange={e => setField("management", e.target.value)} placeholder="e.g. Senior Management" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Department</label>
                <input value={form.department} onChange={e => setField("department", e.target.value)} placeholder="e.g. Engineering" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Job Position</label>
                <input value={form.job_position} onChange={e => setField("job_position", e.target.value)} placeholder="e.g. Software Engineer" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Job Title</label>
                <input value={form.job_title} onChange={e => setField("job_title", e.target.value)} placeholder="e.g. Lead Developer" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
              </div>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Manager</label>
              <input value={form.manager} onChange={e => setField("manager", e.target.value)} placeholder="Direct manager name" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
            </div>
          </div>
        </FormSection>

        {/* 3. Work Location */}
        <FormSection title="Work Location" icon={<MapPin size={14} />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Work Address</label>
              <input value={form.work_address} onChange={e => setField("work_address", e.target.value)} placeholder="Office address" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Work Location</label>
              <input value={form.work_location} onChange={e => setField("work_location", e.target.value)} placeholder="e.g. Dubai Office, Remote" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
            </div>
          </div>
        </FormSection>

        {/* 4. Resume */}
        <FormSection title="Resume" icon={<FileText size={14} />}>
          {form.resume_lines.map((rl, i) => (
            <div key={i} className="mb-3 rounded-xl bg-white/[0.02] border border-[#222] overflow-hidden">
              <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={() => setExpandedResumeLine(expandedResumeLine === i ? null : i)}>
                <span onClick={e => e.stopPropagation()}><RemoveBtn onClick={() => removeResumeLine(i)} /></span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                  rl.type === "experience" ? "bg-blue-500/10 text-blue-400" :
                  rl.type === "education" ? "bg-green-500/10 text-green-400" :
                  rl.type === "training" ? "bg-amber-500/10 text-amber-400" :
                  "bg-violet-500/10 text-violet-400"
                }`}>{rl.type}</span>
                <span className="flex-1 text-sm text-white/80 truncate">{rl.title || "Untitled"}</span>
                <ChevronDown size={14} className={`text-white/30 transition-transform ${expandedResumeLine === i ? "rotate-180" : ""}`} />
              </div>
              {expandedResumeLine === i && (
                <div className="px-3 pb-3 space-y-3 border-t border-[#222] pt-3">
                  <input value={rl.title} onChange={e => updateResumeLine(i, "title", e.target.value)} placeholder="Title" className="w-full h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Start Date</label>
                      <input type="date" value={rl.duration_start} onChange={e => updateResumeLine(i, "duration_start", e.target.value)} className="w-full h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white outline-none focus:border-white/20" />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">End Date</label>
                      <input type="date" value={rl.duration_end} onChange={e => updateResumeLine(i, "duration_end", e.target.value)} disabled={rl.is_forever} className="w-full h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white outline-none focus:border-white/20 disabled:opacity-30" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={rl.is_forever} onChange={e => updateResumeLine(i, "is_forever", e.target.checked)} className="w-4 h-4 rounded border-[#333] bg-white/5 accent-white" />
                    <span className="text-xs text-white/50">Currently ongoing / No end date</span>
                  </label>
                  {rl.type === "training" && (
                    <>
                      <div>
                        <label className="text-xs text-white/40 mb-1.5 block">Course Type</label>
                        <div className="flex gap-2">
                          <button onClick={() => updateResumeLine(i, "course_type", "external")} className={`flex-1 h-9 rounded-lg text-xs font-medium border transition-colors ${rl.course_type === "external" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-[#222] text-white/30 hover:text-white/50"}`}>External</button>
                          <button onClick={() => updateResumeLine(i, "course_type", "onsite")} className={`flex-1 h-9 rounded-lg text-xs font-medium border transition-colors ${rl.course_type === "onsite" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-[#222] text-white/30 hover:text-white/50"}`}>Onsite</button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-white/40 mb-1 block">External URL</label>
                        <input value={rl.external_url} onChange={e => updateResumeLine(i, "external_url", e.target.value)} placeholder="https://..." className="w-full h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="text-xs text-white/40 mb-1.5 block">Certificate</label>
                    {rl.certificate_url ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/60 truncate flex-1">{rl.certificate_name || "Certificate"}</span>
                        <button onClick={() => openFilePreview(rl.certificate_url)} className="text-xs text-blue-400 hover:text-blue-300">Open</button>
                        <button onClick={() => { updateResumeLine(i, "certificate_url", ""); updateResumeLine(i, "certificate_name", ""); }} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-dashed border-[#333] hover:border-white/20 text-xs text-white/40 cursor-pointer transition-colors">
                        <FilePlus size={14} />
                        Upload certificate
                        <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.type.startsWith("image/")) {
                              compressImage(file).then(url => { updateResumeLine(i, "certificate_url", url); updateResumeLine(i, "certificate_name", file.name); });
                            } else {
                              readFileAsDataURL(file).then(url => { updateResumeLine(i, "certificate_url", url); updateResumeLine(i, "certificate_name", file.name); });
                            }
                          }
                        }} />
                      </label>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Notes</label>
                    <textarea value={rl.notes} onChange={e => updateResumeLine(i, "notes", e.target.value)} rows={4} placeholder="Additional details, achievements..." className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20 resize-none" />
                  </div>
                </div>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => addResumeLine("experience")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-medium hover:bg-blue-500/15 transition-colors">
              <Plus size={12} /> Experience
            </button>
            <button onClick={() => addResumeLine("education")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400 font-medium hover:bg-green-500/15 transition-colors">
              <Plus size={12} /> Education
            </button>
            <button onClick={() => addResumeLine("training")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 font-medium hover:bg-amber-500/15 transition-colors">
              <Plus size={12} /> Training
            </button>
            <button onClick={() => addResumeLine("certification")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs text-violet-400 font-medium hover:bg-violet-500/15 transition-colors">
              <Plus size={12} /> Internal Certification
            </button>
          </div>
        </FormSection>

        {/* 5. Private Contact */}
        <FormSection title="Private Contact" icon={<Phone size={14} />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Email</label>
              <input value={form.private_email} onChange={e => setField("private_email", e.target.value)} placeholder="Personal email" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Phone</label>
              <input value={form.private_phone} onChange={e => setField("private_phone", e.target.value)} placeholder="Personal phone" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Bank Account</label>
              <input value={form.employee_bank_account} onChange={e => setField("employee_bank_account", e.target.value)} placeholder="Bank account details" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
            </div>
          </div>
        </FormSection>

        {/* 6. Personal Information */}
        <FormSection title="Personal Information" icon={<User size={14} />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Legal Name</label>
              <input value={form.legal_name} onChange={e => setField("legal_name", e.target.value)} placeholder="Full legal name" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Birthday</label>
              <BirthdayPicker value={form.birthday} onChange={v => setField("birthday", v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Place of Birth</label>
                <input value={form.place_of_birth} onChange={e => setField("place_of_birth", e.target.value)} placeholder="City, Country" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Gender</label>
                <select value={form.gender} onChange={e => setField("gender", e.target.value)} className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white outline-none focus:border-white/20 appearance-none">
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>
        </FormSection>

        {/* 7. Emergency Contact */}
        <FormSection title="Emergency Contact" icon={<ShieldAlert size={14} />}>
          {form.emergency_contacts.map((ec, i) => (
            <div key={i} className="flex items-center gap-2 mb-3">
              <RemoveBtn onClick={() => removeEmergencyContact(i)} />
              <input value={ec.contact} onChange={e => updateEmergencyContact(i, "contact", e.target.value)} placeholder="Contact name" className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
              <input value={ec.phone} onChange={e => updateEmergencyContact(i, "phone", e.target.value)} placeholder="Phone" className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
            </div>
          ))}
          <AddButton label="add emergency contact" onClick={addEmergencyContact} />
        </FormSection>

        {/* 8. Visa & Work Permit */}
        <FormSection title="Visa & Work Permit" icon={<Plane size={14} />}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Visa No.</label>
                <input value={form.visa_no} onChange={e => setField("visa_no", e.target.value)} placeholder="Visa number" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Work Permit</label>
                <input value={form.work_permit} onChange={e => setField("work_permit", e.target.value)} placeholder="Work permit number" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
              </div>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Documents</label>
              {form.visa_documents.map((vd, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-white/60 truncate flex-1">{vd.name || "Document"}</span>
                  <button onClick={() => openFilePreview(vd.url)} className="text-xs text-blue-400 hover:text-blue-300">Open</button>
                  <button onClick={() => downloadFile(vd.url, vd.name)} className="text-xs text-white/40 hover:text-white">Download</button>
                  <button onClick={() => removeVisaDoc(i)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                </div>
              ))}
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-dashed border-[#333] hover:border-white/20 text-xs text-white/40 cursor-pointer transition-colors">
                <FilePlus size={14} />
                Upload document
                <input type="file" accept=".pdf,image/*,.doc,.docx" className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = (file.type.startsWith("image/") ? compressImage(file) : readFileAsDataURL(file));
                    reader.then(url => {
                      setField("visa_documents", [...form.visa_documents, { name: file.name, url, type: file.type, uploaded_at: new Date().toISOString() }]);
                    });
                  }
                }} />
              </label>
            </div>
          </div>
        </FormSection>

        {/* 9. Citizenship */}
        <FormSection title="Citizenship" icon={<Globe size={14} />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Nationality (Country)</label>
              <CountryDropdown value={form.nationality_code} displayValue={form.nationality} onChange={(name, code) => { setField("nationality", name); setField("nationality_code", code); }} />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block flex items-center gap-1">
                ID No.
                <span className="relative group">
                  <HelpCircle size={12} className="text-white/20 cursor-help" />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-[#222] text-[10px] text-white/70 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">National Identity Card Number</span>
                </span>
              </label>
              <input value={form.id_no} onChange={e => setField("id_no", e.target.value)} placeholder="National ID number" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block flex items-center gap-1">
                SSN No.
                <span className="relative group">
                  <HelpCircle size={12} className="text-white/20 cursor-help" />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-[#222] text-[10px] text-white/70 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Social Security Number</span>
                </span>
              </label>
              <input value={form.ssn_no} onChange={e => setField("ssn_no", e.target.value)} placeholder="Social security number" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Passport No.</label>
              <input value={form.passport_no} onChange={e => setField("passport_no", e.target.value)} placeholder="Passport number" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
            </div>
          </div>
        </FormSection>

        {/* 10. Private Location */}
        <FormSection title="Private Location" icon={<Home size={14} />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Private Address</label>
              <input value={form.private_address} onChange={e => setField("private_address", e.target.value)} placeholder="Home address" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Home-Work Distance</label>
              <div className="relative">
                <input value={form.home_work_distance} onChange={e => setField("home_work_distance", e.target.value)} placeholder="0" className="w-full h-10 px-3 pr-12 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30">KM</span>
              </div>
            </div>
          </div>
        </FormSection>

        {/* 11. Family */}
        <FormSection title="Family" icon={<Heart size={14} />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Marital Status</label>
              <select value={form.marital_status} onChange={e => setField("marital_status", e.target.value)} className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white outline-none focus:border-white/20 appearance-none">
                <option value="">Select...</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Number of Children</label>
              <input type="number" min="0" value={form.number_of_children} onChange={e => setField("number_of_children", e.target.value)} placeholder="0" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
            </div>
          </div>
        </FormSection>

        {/* 12. Education */}
        <FormSection title="Education" icon={<GraduationCap size={14} />}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Certificate Level</label>
              <select value={form.certificate_level} onChange={e => setField("certificate_level", e.target.value)} className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white outline-none focus:border-white/20 appearance-none">
                <option value="">Select...</option>
                <option value="high_school">High School</option>
                <option value="diploma">Diploma</option>
                <option value="bachelor">Bachelor&apos;s Degree</option>
                <option value="master">Master&apos;s Degree</option>
                <option value="doctorate">Doctorate / PhD</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Field of Study</label>
              <input value={form.field_of_study} onChange={e => setField("field_of_study", e.target.value)} placeholder="e.g. Computer Science" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20" />
            </div>
          </div>
        </FormSection>
        </>
        )}

        {/* Customer Type (only for customer contacts) */}
        {isCustomer && (
          <FormSection title="Customer Type" icon={<Crown size={14} />}>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setField("is_active", e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 accent-blue-500"
                />
                <span className="text-sm text-white">Active Customer</span>
              </label>

              {form.is_active && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CUSTOMER_TIERS.map(tier => (
                    <button
                      key={tier.value}
                      onClick={() => setField("customer_type", form.customer_type === tier.value ? "" : tier.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        form.customer_type === tier.value
                          ? `${tier.bg} ${tier.color} border-white/20 ring-1 ring-white/10`
                          : "border-[#222] text-white/30 hover:text-white/50 hover:border-[#333]"
                      }`}
                    >
                      {tier.value === "end_user" && <User size={14} />}
                      {tier.value === "silver" && <Shield size={14} />}
                      {tier.value === "gold" && <Star size={14} />}
                      {tier.value === "platinum" && <Award size={14} />}
                      {tier.value === "diamond" && <Gem size={14} />}
                      {tier.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </FormSection>
        )}

        {/* Spacer at bottom */}
        <div className="h-20" />
      </div>
    );
  };

  /* ═════════════════════════════════════════════════════════════════════════
     TYPE CHOOSER MODAL
     ═════════════════════════════════════════════════════════════════════════ */

  const renderTypeChooser = () => (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => { setShowTypeChooser(false); setTypeChooserStep(1); }}>
      <div className="bg-[#111] border border-[#222] rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        {typeChooserStep === 1 ? (
          <>
            <h3 className="text-lg font-semibold text-white mb-1">New Contact</h3>
            <p className="text-sm text-white/40 mb-5">Choose the contact type</p>
            <div className="grid grid-cols-2 gap-3">
              {CONTACT_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => {
                    if (t.value === "customer") {
                      setTypeChooserStep(2);
                    } else {
                      handleAdd(t.value);
                    }
                  }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-[#222] hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.05] transition-all ${t.color}`}
                >
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center [&>svg]:w-[22px] [&>svg]:h-[22px]">
                    {t.icon}
                  </div>
                  <span className="text-sm font-medium">{t.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => { setShowTypeChooser(false); setTypeChooserStep(1); }} className="w-full mt-4 py-2.5 rounded-lg text-sm text-white/50 hover:text-white border border-[#222] hover:bg-white/5 transition-colors">
              Cancel
            </button>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-white mb-1">What type of customer?</h3>
            <p className="text-sm text-white/40 mb-5">Select the customer entity type</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleAdd("customer", "person")}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[#222] hover:border-amber-500/30 bg-white/[0.02] hover:bg-amber-500/[0.05] transition-all text-amber-400"
              >
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <User size={22} />
                </div>
                <span className="text-sm font-medium">Individual</span>
                <span className="text-[11px] text-white/30 text-center leading-tight">A person you do business with</span>
              </button>
              <button
                onClick={() => handleAdd("customer", "company")}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[#222] hover:border-amber-500/30 bg-white/[0.02] hover:bg-amber-500/[0.05] transition-all text-amber-400"
              >
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Building2 size={22} />
                </div>
                <span className="text-sm font-medium">Business</span>
                <span className="text-[11px] text-white/30 text-center leading-tight">A company or organization</span>
              </button>
            </div>
            <button onClick={() => setTypeChooserStep(1)} className="w-full mt-4 py-2.5 rounded-lg text-sm text-white/50 hover:text-white border border-[#222] hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
              <ArrowLeft size={14} /> Back
            </button>
          </>
        )}
      </div>
    </div>
  );

  /* ═════════════════════════════════════════════════════════════════════════
     MAIN LAYOUT
     ═════════════════════════════════════════════════════════════════════════ */

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-[#0A0A0A] text-white flex overflow-hidden">
      {/* Left panel -- contact list */}
      <div className={`${mobileShowDetail ? "hidden md:flex" : "flex"} flex-col w-full md:w-[340px] lg:w-[380px] md:border-r border-[#222] shrink-0 h-full bg-[#111] min-w-0`}>
        {renderListPanel()}
      </div>

      {/* Right panel -- detail / form */}
      <div className={`${mobileShowDetail ? "flex" : "hidden md:flex"} flex-col flex-1 min-w-0 h-full bg-[#0A0A0A]`}>
        {view === "form" ? renderFormPanel() : renderDetailPanel()}
      </div>

      {/* Type chooser modal */}
      {showTypeChooser && renderTypeChooser()}
    </div>
  );
}
