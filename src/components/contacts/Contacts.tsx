"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, Search, X, Trash2, Edit3, Save, Phone, Mail,
  MapPin, Globe, Calendar, Users, Building2, User, Crown, ChevronDown,
  ChevronRight, Copy, Check, AlertTriangle, Camera, Minus, UserPlus,
  Briefcase, Heart, Share2, FileText, Star, Shield, Gem, Award,
  CreditCard, BadgeCheck, UserCheck, TrendingUp, MapPinned,
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

interface ContactForm {
  contact_type: ContactType;
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
  if (f.first_name || f.last_name) return [f.first_name, f.last_name].filter(Boolean).join(" ");
  if (f.company) return f.company;
  return "Unnamed Contact";
}

function getInitials(contact: ContactRow): string {
  const fn = contact.first_name || "";
  const ln = contact.last_name || "";
  if (fn && ln) return (fn[0] + ln[0]).toUpperCase();
  if (fn) return fn.slice(0, 2).toUpperCase();
  if (contact.company) return contact.company.slice(0, 2).toUpperCase();
  return "?";
}

function contactDisplayName(c: ContactRow): string {
  if (c.first_name || c.last_name) return [c.first_name, c.last_name].filter(Boolean).join(" ");
  if (c.display_name) return c.display_name;
  if (c.company) return c.company;
  return "Unnamed";
}

function contactSortKey(c: ContactRow): string {
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

function contactToForm(c: ContactRow): ContactForm {
  return {
    contact_type: (c.contact_type as ContactType) || "people",
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
  };
}

function formToRow(f: ContactForm): Record<string, unknown> {
  const fullName = buildFullName(f);
  const displayName = buildDisplayName(f);
  return {
    contact_type: f.contact_type,
    entity_type: f.contact_type === "company" ? "company" : "person",
    photo_url: f.photo_url || null,
    title: f.title || null,
    first_name: f.first_name || null,
    middle_name: f.middle_name || null,
    last_name: f.last_name || null,
    full_name: fullName || null,
    display_name: displayName,
    company: f.company || null,
    position: f.position || null,
    email: f.emails[0]?.email || null,
    phone: f.phones[0]?.number || null,
    country: f.country || null,
    country_code: f.country_code || null,
    province: f.province || null,
    province_code: f.province_code || null,
    city: f.city || null,
    birthday: f.birthday || null,
    notes: f.notes || null,
    website: f.websites[0]?.url || null,
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
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODULE-LEVEL REUSABLE COMPONENTS (extracted from render functions for perf)
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Detail view section wrapper ── */
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-b border-[#222] px-4 md:px-6 py-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-white/30">{icon}</span>
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/* ── Form text input ── */
function Input({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-white/40 mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || label}
        className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
      />
    </div>
  );
}

/* ── Form select input ── */
function SelectInput({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="text-xs text-white/40 mb-1 block">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-10 px-3 rounded-lg bg-white/5 border border-[#222] text-sm text-white outline-none focus:border-white/20 transition-colors appearance-none cursor-pointer"
      >
        <option value="" className="bg-[#111]">Select...</option>
        {options.map(o => <option key={o} value={o} className="bg-[#111]">{o}</option>)}
      </select>
    </div>
  );
}

/* ── Add button ── */
function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 text-sm text-white/50 hover:text-white py-2 transition-colors">
      <div className="w-6 h-6 rounded-full bg-white/10 border border-white/[0.08] flex items-center justify-center">
        <Plus size={14} className="text-white/60" />
      </div>
      {label}
    </button>
  );
}

/* ── Remove button ── */
function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-6 h-6 rounded-full bg-white/10 border border-white/[0.08] flex items-center justify-center shrink-0 hover:bg-white/20 transition-colors">
      <Minus size={14} className="text-white/60" />
    </button>
  );
}

/* ── Inline label select ── */
function LabelSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-10 px-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs text-white/60 font-medium outline-none cursor-pointer min-w-[80px]"
    >
      {options.map(o => <option key={o} value={o} className="bg-[#111] text-white">{o}</option>)}
    </select>
  );
}

/* ── Form section wrapper ── */
function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[#222] px-4 md:px-6 py-4 md:py-5">
      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">{title}</h3>
      {children}
    </div>
  );
}

/* ── Birthday Picker (DD/MM/YYYY) ── */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function BirthdayPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
}

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
  const [expandedFamily, setExpandedFamily] = useState<number | null>(null);
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

  /* ── Filtered + grouped contacts ── */
  const filtered = useMemo(() => {
    let list = contacts;
    const tab = filterType || typeTab;
    if (tab !== "all") list = list.filter(c => c.contact_type === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        contactDisplayName(c).toLowerCase().includes(q) ||
        (c.company || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.phone || "").includes(q)
      );
    }
    return list.sort((a, b) => contactSortKey(a).localeCompare(contactSortKey(b)));
  }, [contacts, typeTab, filterType, search]);

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

  /* ── Customer KPI stats ── */
  const customerKpis = useMemo(() => {
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

  /* ── Handlers ── */
  const handleSelectContact = (c: ContactRow) => {
    setSelectedId(c.id);
    setView("detail");
    setMobileShowDetail(true);
    setEditingId(null);
  };

  const handleAdd = (type: ContactType) => {
    setForm({ ...EMPTY_FORM, contact_type: type });
    setEditingId(null);
    setView("form");
    setShowTypeChooser(false);
    setMobileShowDetail(true);
    setExpandedFamily(null);
  };

  const handleEdit = () => {
    if (!selectedContact) return;
    setForm(contactToForm(selectedContact));
    setEditingId(selectedContact.id);
    setView("form");
    setExpandedFamily(null);
  };

  const handleSave = async () => {
    if (!form.first_name && !form.last_name && !form.company) return;
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
  const setField = <K extends keyof ContactForm>(key: K, val: ContactForm[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

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
            onClick={() => setShowTypeChooser(true)}
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
      <div className="flex-1 overflow-y-auto">
        {/* Compact KPI strip — mobile only (main dashboard is in right panel on desktop) */}
        {customerKpis && (
          <div className="md:hidden grid grid-cols-4 gap-2 px-4 py-3 border-b border-[#222]">
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-white">{customerKpis.total}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-white/30">Total</p>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-emerald-400">{customerKpis.active}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-emerald-400/40">Active</p>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-violet-400">{customerKpis.vip}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-violet-400/40">VIP</p>
            </div>
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-blue-400">{customerKpis.countries}</p>
              <p className="text-[8px] font-semibold uppercase tracking-widest text-blue-400/40">Countries</p>
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
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-white/[0.03] ${
                      isSelected ? "bg-white/[0.08]" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold text-white/60 shrink-0 overflow-hidden">
                      {c.photo_url ? (
                        <img src={c.photo_url} alt="" className="w-full h-full object-cover" />
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
      /* ── KPI Dashboard (shown when filterType is set and no contact selected) ── */
      if (customerKpis) {
        const tierCounts = {
          diamond: contacts.filter(c => c.contact_type === filterType && c.customer_type === "diamond").length,
          platinum: contacts.filter(c => c.contact_type === filterType && c.customer_type === "platinum").length,
          gold: contacts.filter(c => c.contact_type === filterType && c.customer_type === "gold").length,
          silver: contacts.filter(c => c.contact_type === filterType && c.customer_type === "silver").length,
          end_user: contacts.filter(c => c.contact_type === filterType && c.customer_type === "end_user").length,
          none: contacts.filter(c => c.contact_type === filterType && !c.customer_type).length,
        };
        const inactive = customerKpis.total - customerKpis.active;
        return (
          <div className="h-full overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
              {/* Title */}
              <div>
                <h2 className="text-2xl font-bold text-white">Customer Overview</h2>
                <p className="text-sm text-white/40 mt-1">Key metrics and insights</p>
              </div>

              {/* Main KPI Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Total */}
                <div className="bg-[#111] border border-[#222] rounded-xl p-5 transition-all hover:border-white/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10">
                      <Crown size={16} className="text-amber-400" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Total</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-white">{customerKpis.total}</p>
                  <p className="text-xs text-white/30 mt-1">All customers</p>
                </div>

                {/* Active */}
                <div className="bg-[#111] border border-[#222] rounded-xl p-5 transition-all hover:border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10">
                      <UserCheck size={16} className="text-emerald-400" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400/60">Active</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-emerald-400">{customerKpis.active}</p>
                  <p className="text-xs text-white/30 mt-1">{customerKpis.total > 0 ? Math.round((customerKpis.active / customerKpis.total) * 100) : 0}% of total</p>
                </div>

                {/* VIP */}
                <div className="bg-[#111] border border-[#222] rounded-xl p-5 transition-all hover:border-violet-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10">
                      <Gem size={16} className="text-violet-400" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-400/60">VIP</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-violet-400">{customerKpis.vip}</p>
                  <p className="text-xs text-white/30 mt-1">Diamond & Platinum</p>
                </div>

                {/* Countries */}
                <div className="bg-[#111] border border-[#222] rounded-xl p-5 transition-all hover:border-blue-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10">
                      <MapPinned size={16} className="text-blue-400" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-400/60">Countries</span>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-blue-400">{customerKpis.countries}</p>
                  <p className="text-xs text-white/30 mt-1">Global reach</p>
                </div>
              </div>

              {/* Tier Breakdown */}
              <div className="bg-[#111] border border-[#222] rounded-xl p-5">
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
                          style={{ width: customerKpis.total > 0 ? `${(tier.count / customerKpis.total) * 100}%` : "0%" }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-white/60 w-8 text-right">{tier.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Breakdown */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Active</span>
                  </div>
                  <p className="text-3xl font-bold text-emerald-400">{customerKpis.active}</p>
                </div>
                <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Inactive</span>
                  </div>
                  <p className="text-3xl font-bold text-red-400">{inactive}</p>
                </div>
              </div>

              {/* New This Month */}
              {customerKpis.newThisMonth > 0 && (
                <div className="bg-[#111] border border-[#222] rounded-xl p-5 flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/10">
                    <TrendingUp size={20} className="text-green-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-green-400">+{customerKpis.newThisMonth}</p>
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
          <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold text-white/50 mx-auto mb-4 overflow-hidden">
            {c.photo_url ? (
              <img src={c.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              getInitials(c)
            )}
          </div>
          <h2 className="text-xl font-semibold text-white">{contactDisplayName(c)}</h2>
          {c.position && <p className="text-sm text-white/50 mt-1">{c.position}</p>}
          {c.company && <p className="text-sm text-white/40">{c.company}</p>}

          <div className="flex items-center justify-center gap-2 mt-3">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border border-[#222] ${getTypeColor(c.contact_type)}`}>
              {c.contact_type?.charAt(0).toUpperCase() + c.contact_type?.slice(1)}
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

        {/* Phone numbers */}
        {(phones.length > 0 || c.phone) && (
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

        {/* Emails */}
        {(emails.length > 0 || c.email) && (
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

        {/* Addresses */}
        {addresses.length > 0 && (
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

        {/* Country / Province / City */}
        {(c.country || c.province || c.city) && (
          <Section title="Location" icon={<MapPin size={14} />}>
            <div className="flex items-center gap-2">
              {c.country_code && <span className="text-base">{countryCodeToFlag(c.country_code)}</span>}
              <p className="text-sm text-white">
                {[c.city, c.province, c.country].filter(Boolean).join(", ")}
              </p>
            </div>
          </Section>
        )}

        {/* Websites */}
        {(websitesList.length > 0 || c.website) && (
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

        {/* Birthday */}
        {c.birthday && (
          <Section title="Birthday" icon={<Calendar size={14} />}>
            <p className="text-sm text-white">{new Date(c.birthday).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
          </Section>
        )}

        {/* Social Profiles */}
        {socials.length > 0 && (
          <Section title="Social Profiles" icon={<Share2 size={14} />}>
            {socials.map((s, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="flex-1">
                  <span className="text-xs text-blue-400 font-medium">{s.platform}</span>
                  <p className="text-sm text-white">{s.username || s.url}</p>
                </div>
                {s.qr_code_url && (
                  <img src={s.qr_code_url} alt="QR" className="w-10 h-10 rounded border border-[#222]" />
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Related People */}
        {family.length > 0 && (
          <Section title="Related People" icon={<Users size={14} />}>
            {family.map((f, i) => (
              <div key={i} className="py-2 border-b border-white/[0.03] last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white/50 overflow-hidden">
                    {f.photo_url ? <img src={f.photo_url} alt="" className="w-full h-full object-cover" /> : (f.first_name?.[0] || "?").toUpperCase()}
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
                  <img src={c.business_card_front!} alt="Business Card Front" className="w-full rounded-lg border border-[#222]" />
                </div>
              )}
              {c.business_card_back && (
                <div>
                  <span className="text-xs text-white/40 mb-1.5 block">Back</span>
                  <img src={c.business_card_back!} alt="Business Card Back" className="w-full rounded-lg border border-[#222]" />
                </div>
              )}
            </div>
          </Section>
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
              disabled={saving || (!form.first_name && !form.last_name && !form.company)}
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

        {/* Photo + Type */}
        <div className="px-4 md:px-6 py-5 md:py-6 text-center border-b border-[#222]">
          <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-b from-white/15 to-white/5 flex items-center justify-center mx-auto mb-3 relative overflow-hidden">
            {form.photo_url ? (
              <img src={form.photo_url} alt="" className="w-full h-full object-cover" />
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
                Change Photo
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) compressImage(file).then(url => setField("photo_url", url));
                }} />
              </label>
              <button onClick={() => setField("photo_url", "")} className="text-sm text-red-400 hover:text-red-300 font-medium">Remove</button>
            </div>
          ) : (
            <label className="inline-block px-5 py-2 rounded-full bg-white/10 hover:bg-white/15 text-sm text-white/70 font-medium cursor-pointer transition-colors">
              Add Photo
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
        </div>

        {/* Basic Info */}
        <FormSection title="Basic Information">
          <div className="space-y-3">
            <SelectInput label="Title" value={form.title} onChange={v => setField("title", v)} options={TITLES} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="First Name" value={form.first_name} onChange={v => setField("first_name", v)} />
              <Input label="Middle Name" value={form.middle_name} onChange={v => setField("middle_name", v)} />
            </div>
            <Input label="Last Name / Family Name" value={form.last_name} onChange={v => setField("last_name", v)} />
            <Input label="Company" value={form.company} onChange={v => setField("company", v)} />
            <Input label="Position" value={form.position} onChange={v => setField("position", v)} />
          </div>
        </FormSection>

        {/* Phones */}
        <FormSection title="Phone Numbers">
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

        {/* Emails */}
        <FormSection title="Email Addresses">
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

        {/* Addresses */}
        <FormSection title="Addresses">
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

        {/* Location (country/province/city cascade) */}
        <FormSection title="Location">
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

        {/* Websites */}
        <FormSection title="Websites">
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

        {/* Birthday */}
        <FormSection title="Birthday">
          <BirthdayPicker value={form.birthday} onChange={v => setField("birthday", v)} />
        </FormSection>

        {/* Social Profiles */}
        <FormSection title="Social Profiles">
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
                      <img src={s.qr_code_url} alt="QR" className="w-14 h-14 rounded border border-[#222] object-cover" />
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

        {/* Related People */}
        <FormSection title="Related People">
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

        {/* Notes */}
        <FormSection title="Notes">
          <textarea
            value={form.notes}
            onChange={e => setField("notes", e.target.value)}
            placeholder="Add notes..."
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#222] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20 resize-none"
          />
        </FormSection>

        {/* Custom Fields */}
        <FormSection title="Custom Fields">
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

        {/* Business Card (customers only) */}
        {isCustomer && (
          <FormSection title="Business Card">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Front</label>
                <label className="flex flex-col items-center justify-center w-full aspect-[1.6/1] rounded-lg border-2 border-dashed border-[#222] hover:border-white/20 bg-white/[0.02] cursor-pointer transition-colors overflow-hidden">
                  {form.business_card_front ? (
                    <img src={form.business_card_front} alt="Front" className="w-full h-full object-cover" />
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
                    <img src={form.business_card_back} alt="Back" className="w-full h-full object-cover" />
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

        {/* Customer Type (only for customer contacts) */}
        {isCustomer && (
          <FormSection title="Customer Type">
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
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowTypeChooser(false)}>
      <div className="bg-[#111] border border-[#222] rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white mb-1">New Contact</h3>
        <p className="text-sm text-white/40 mb-5">Choose the contact type</p>
        <div className="grid grid-cols-2 gap-3">
          {CONTACT_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => handleAdd(t.value)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-[#222] hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.05] transition-all ${t.color}`}
            >
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center [&>svg]:w-[22px] [&>svg]:h-[22px]">
                {t.icon}
              </div>
              <span className="text-sm font-medium">{t.label}</span>
            </button>
          ))}
        </div>
        <button onClick={() => setShowTypeChooser(false)} className="w-full mt-4 py-2.5 rounded-lg text-sm text-white/50 hover:text-white border border-[#222] hover:bg-white/5 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );

  /* ═════════════════════════════════════════════════════════════════════════
     MAIN LAYOUT
     ═════════════════════════════════════════════════════════════════════════ */

  return (
    <div className="h-screen bg-[#0A0A0A] text-white flex overflow-hidden">
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
