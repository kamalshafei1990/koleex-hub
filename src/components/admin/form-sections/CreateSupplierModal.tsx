"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import PictureIcon from "@/components/icons/ui/PictureIcon";
import { Country, State, City } from "country-state-city";
import Modal from "./Modal";
import { createContact } from "@/lib/contacts-admin";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (supplier: { id: string; name: string; logo: string | null }) => void;
}

const SUPPLIER_TYPES = [
  "Manufacturer", "Distributor", "Wholesaler", "Agent", "Trading Company",
  "Service Provider", "Freelancer", "OEM", "ODM", "Other",
];

const SUPPLIER_SOURCES = [
  "Alibaba", "Made-in-China", "Global Sources", "Exhibition / Trade Show",
  "Referral", "Website", "LinkedIn", "Cold Call", "Partner", "Agent", "Other",
];

const PAYMENT_TERMS = [
  "T/T in Advance", "T/T 30% / 70%", "Net 30", "Net 60", "Net 90",
  "COD", "L/C", "D/P", "D/A", "Western Union", "PayPal", "Other",
];

const CURRENCIES = ["USD", "CNY", "EUR", "GBP", "AED", "SAR", "EGP", "Other"];

const CERTIFICATIONS = [
  "ISO 9001", "ISO 14001", "ISO 45001", "CE", "FDA",
  "BSCI", "SEDEX", "SA8000", "GMP", "HACCP",
  "UL", "RoHS", "REACH", "FSC", "GOTS", "Other",
];

const SAMPLE_STATUSES = ["None", "Requested", "Received", "Approved", "Rejected"];

interface ContactPerson {
  name: string;
  position: string;
  department: string;
  phone: string;
  mobile: string;
  email: string;
  notes: string;
}

/* ── Country flag helper ── */
function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return "";
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    ...Array.from(upper).map(c => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

interface CountryOption { name: string; isoCode: string; flag: string; }
const ALL_COUNTRIES: CountryOption[] = Country.getAllCountries().map(c => ({
  name: c.name,
  isoCode: c.isoCode,
  flag: countryCodeToFlag(c.isoCode),
}));

/* ═════════════════════════════════════════════════════
   Searchable Country Dropdown
   ═════════════════════════════════════════════════════ */
function CountryPicker({ value, countryCode, onChange, label }: {
  value: string; countryCode: string;
  onChange: (name: string, isoCode: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return ALL_COUNTRIES;
    const q = query.toLowerCase();
    return ALL_COUNTRIES.filter(c => c.name.toLowerCase().includes(q) || c.isoCode.toLowerCase().includes(q));
  }, [query]);

  const selectedFlag = countryCode ? countryCodeToFlag(countryCode) : "";

  const inp = "w-full h-11 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus-within:border-[var(--border-focus)] focus-within:ring-1 focus-within:ring-[var(--border-focus)] transition-all";

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">{label ?? "Country"}</label>
      <div
        className={`${inp} flex items-center gap-2 px-4 cursor-pointer`}
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        {selectedFlag && <span className="text-base">{selectedFlag}</span>}
        <input
          ref={inputRef}
          type="text"
          value={open ? query : value}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search country..."
          className="flex-1 bg-transparent outline-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)]"
        />
        <AngleDownIcon className={`h-3.5 w-3.5 text-[var(--text-ghost)] transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="absolute z-[110] mt-1.5 w-full max-h-52 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl shadow-black/30">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-[12px] text-[var(--text-ghost)]">No countries found</div>
          ) : (
            filtered.map(c => (
              <button
                key={c.isoCode}
                type="button"
                onClick={() => { onChange(c.name, c.isoCode); setOpen(false); setQuery(""); }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-left hover:bg-[var(--bg-surface-subtle)] transition-colors ${
                  c.isoCode === countryCode ? "bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] font-medium" : "text-[var(--text-muted)]"
                }`}
              >
                <span className="text-base">{c.flag}</span>
                <span className="truncate">{c.name}</span>
                <span className="text-[10px] text-[var(--text-ghost)] ml-auto shrink-0">{c.isoCode}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════
   Searchable Province/State Dropdown
   ═════════════════════════════════════════════════════ */
function ProvincePicker({ countryCode, value, stateCode, onChange, label }: {
  countryCode: string; value: string; stateCode: string;
  onChange: (name: string, isoCode: string) => void;
  label?: string;
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
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return states;
    const q = query.toLowerCase();
    return states.filter(s => s.name.toLowerCase().includes(q));
  }, [query, states]);

  if (states.length === 0) return null;

  const inp = "w-full h-11 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus-within:border-[var(--border-focus)] focus-within:ring-1 focus-within:ring-[var(--border-focus)] transition-all";

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">{label ?? "Province / State"}</label>
      <div
        className={`${inp} flex items-center gap-2 px-4 cursor-pointer`}
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        <input
          ref={inputRef}
          type="text"
          value={open ? query : value}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search province..."
          className="flex-1 bg-transparent outline-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)]"
        />
        <AngleDownIcon className={`h-3.5 w-3.5 text-[var(--text-ghost)] transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="absolute z-[110] mt-1.5 w-full max-h-52 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl shadow-black/30">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-[12px] text-[var(--text-ghost)]">No provinces found</div>
          ) : (
            filtered.map(s => (
              <button
                key={s.isoCode}
                type="button"
                onClick={() => { onChange(s.name, s.isoCode); setOpen(false); setQuery(""); }}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-left hover:bg-[var(--bg-surface-subtle)] transition-colors ${
                  s.isoCode === stateCode ? "bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] font-medium" : "text-[var(--text-muted)]"
                }`}
              >
                <span className="truncate">{s.name}</span>
                <span className="text-[10px] text-[var(--text-ghost)] ml-auto shrink-0">{s.isoCode}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════
   Searchable City Dropdown
   ═════════════════════════════════════════════════════ */
function CityPicker({ countryCode, stateCode, value, onChange, label }: {
  countryCode: string; stateCode: string; value: string;
  onChange: (name: string) => void;
  label?: string;
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
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return cities;
    const q = query.toLowerCase();
    return cities.filter(c => c.name.toLowerCase().includes(q));
  }, [query, cities]);

  const inp = "w-full h-11 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all";

  // Fallback to text input if no city data
  if (cities.length === 0) {
    return (
      <div>
        <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">{label ?? "City"}</label>
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Enter city..." className={inp} />
      </div>
    );
  }

  const inpWrap = "w-full h-11 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus-within:border-[var(--border-focus)] focus-within:ring-1 focus-within:ring-[var(--border-focus)] transition-all";

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">{label ?? "City"}</label>
      <div
        className={`${inpWrap} flex items-center gap-2 px-4 cursor-pointer`}
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        <input
          ref={inputRef}
          type="text"
          value={open ? query : value}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search city..."
          className="flex-1 bg-transparent outline-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)]"
        />
        <AngleDownIcon className={`h-3.5 w-3.5 text-[var(--text-ghost)] transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="absolute z-[110] mt-1.5 w-full max-h-52 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl shadow-black/30">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-[12px] text-[var(--text-ghost)]">No cities found</div>
          ) : (
            filtered.map((c, idx) => (
              <button
                key={`${c.name}-${idx}`}
                type="button"
                onClick={() => { onChange(c.name); setOpen(false); setQuery(""); }}
                className={`w-full px-4 py-2.5 text-[13px] text-left hover:bg-[var(--bg-surface-subtle)] transition-colors ${
                  c.name === value ? "bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] font-medium" : "text-[var(--text-muted)]"
                }`}
              >
                {c.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════
   MAIN MODAL
   ═════════════════════════════════════════════════════ */
/** Compress image to base64 data URL for storage in DB */
async function compressImage(file: File, maxWidth = 400, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
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

export default function CreateSupplierModal({ open, onClose, onCreated }: Props) {
  // Company info
  const [companyNameEn, setCompanyNameEn] = useState("");
  const [companyNameCn, setCompanyNameCn] = useState("");
  const [supplierType, setSupplierType] = useState("");
  const [industry, setIndustry] = useState("");
  const [source, setSource] = useState("");

  // Logo
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  // Contact info
  const [tel, setTel] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");

  // Location (country/province/city)
  const [countryName, setCountryName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [provinceName, setProvinceName] = useState("");
  const [provinceCode, setProvinceCode] = useState("");
  const [city, setCity] = useState("");

  // Contact persons
  const [contactPersons, setContactPersons] = useState<ContactPerson[]>([]);

  // Business
  const [division, setDivision] = useState("");
  const [category, setCategory] = useState("");
  const [brandNames, setBrandNames] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [paymentInfo, setPaymentInfo] = useState("");
  const [moq, setMoq] = useState("");
  const [leadTime, setLeadTime] = useState("");

  // Quality
  const [certifications, setCertifications] = useState<string[]>([]);
  const [sampleStatus, setSampleStatus] = useState("");
  const [rating, setRating] = useState(0);

  // Notes
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setCompanyNameEn(""); setCompanyNameCn(""); setSupplierType(""); setIndustry(""); setSource("");
    setLogoFile(null); setLogoPreview(null);
    setTel(""); setMobile(""); setEmail(""); setWebsite(""); setAddress("");
    setCountryName(""); setCountryCode(""); setProvinceName(""); setProvinceCode(""); setCity("");
    setContactPersons([]);
    setDivision(""); setCategory(""); setBrandNames(""); setPaymentTerms(""); setCurrency("USD"); setPaymentInfo(""); setMoq(""); setLeadTime("");
    setCertifications([]); setSampleStatus(""); setRating(0);
    setNotes(""); setError("");
  };

  const handleSave = async () => {
    if (!companyNameEn.trim()) { setError("Company name (English) is required"); return; }
    setSaving(true);
    setError("");

    // Compress logo to base64 if provided
    let photoUrl: string | null = null;
    if (logoFile) {
      photoUrl = await compressImage(logoFile);
    }

    const brands = brandNames.split(",").map(b => b.trim()).filter(Boolean);

    const { data, error: createError } = await createContact({
      contact_type: "supplier",
      entity_type: "company",
      is_active: true,
      photo_url: photoUrl,
      company_name_en: companyNameEn.trim(),
      company_name_cn: companyNameCn.trim() || null,
      first_name: companyNameEn.trim(),
      supplier_type: supplierType || null,
      industry: industry.trim() || null,
      source: source || null,
      supplier_tel: tel.trim() || null,
      supplier_mobile: mobile.trim() || null,
      supplier_email: email.trim() || null,
      supplier_website: website.trim() || null,
      supplier_address: address.trim() || null,
      country: countryName || null,
      country_code: countryCode || null,
      province: provinceName || null,
      province_code: provinceCode || null,
      city: city || null,
      contact_persons: contactPersons.filter(cp => cp.name.trim()),
      division: division.trim() || null,
      category: category.trim() || null,
      brand_names: brands,
      payment_terms: paymentTerms || null,
      currency: currency || null,
      payment_info: paymentInfo.trim() || null,
      moq: moq.trim() || null,
      lead_time: leadTime.trim() || null,
      certifications,
      sample_status: sampleStatus || null,
      rating,
      notes: notes.trim() || null,
      // Required array fields (defaults)
      tags: [],
      phones: [],
      emails: [],
      addresses: [],
      websites: [],
      social_profiles: [],
      family_members: [],
      related_names: [],
      custom_fields: [],
      shipping_addresses: [],
      attachments: [],
      product_categories: [],
      additional_company_names: [],
      catalogues: [],
      documents: [],
      bank_accounts: [],
      resume_lines: [],
      emergency_contacts: [],
      visa_documents: [],
    });

    setSaving(false);
    if (!data || createError) {
      setError(createError || "Failed to create supplier");
      return;
    }

    onCreated({ id: data.id, name: companyNameEn.trim(), logo: photoUrl });
    reset();
    onClose();
  };

  const handleClose = () => { reset(); onClose(); };

  const addContactPerson = () => {
    setContactPersons(prev => [...prev, { name: "", position: "", department: "", phone: "", mobile: "", email: "", notes: "" }]);
  };

  const updateContactPerson = (idx: number, field: keyof ContactPerson, value: string) => {
    setContactPersons(prev => prev.map((cp, i) => i === idx ? { ...cp, [field]: value } : cp));
  };

  const removeContactPerson = (idx: number) => {
    setContactPersons(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleCert = (cert: string) => {
    setCertifications(prev => prev.includes(cert) ? prev.filter(c => c !== cert) : [...prev, cert]);
  };

  const inp = "w-full h-11 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all appearance-none";
  const lbl = "block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5";
  const sectionTitle = "text-[11px] font-bold uppercase tracking-wider text-[var(--text-ghost)] mb-3 flex items-center gap-2";

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Create New Supplier"
      subtitle="Add a new supplier to your contacts"
      width="max-w-3xl"
      footer={
        <>
          <button onClick={handleClose} className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !companyNameEn.trim()} className="h-10 px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-40">
            {saving ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Creating..." : "Create Supplier"}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-8">

        {/* ── Company Name + Logo ── */}
        <div>
          <p className={sectionTitle}>Company Information</p>
          <div className="space-y-4">
            {/* Logo + Names row */}
            <div className="flex gap-5 items-start">
              {/* Logo upload */}
              <div className="shrink-0">
                <label className={lbl}>Logo</label>
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                  if (!e.target.files?.length) return;
                  setLogoFile(e.target.files[0]);
                  setLogoPreview(URL.createObjectURL(e.target.files[0]));
                }} />
                {logoPreview ? (
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                    <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); if (logoRef.current) logoRef.current.value = ""; }}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors">
                      <span className="text-[10px]">&times;</span>
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => logoRef.current?.click()}
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-[var(--border-subtle)] hover:border-[var(--border-focus)] bg-[var(--bg-surface-subtle)] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group">
                    <PictureIcon className="h-5 w-5 text-[var(--text-ghost)] group-hover:text-[var(--text-dim)]" />
                    <span className="text-[9px] text-[var(--text-ghost)]">Upload</span>
                  </button>
                )}
              </div>
              {/* Names */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Company Name (English) *</label>
                  <input type="text" value={companyNameEn} onChange={(e) => setCompanyNameEn(e.target.value)} placeholder="e.g. Shenzhen Tech Co., Ltd." className={inp} autoFocus />
                </div>
                <div>
                  <label className={lbl}>Company Name (Chinese)</label>
                  <input type="text" value={companyNameCn} onChange={(e) => setCompanyNameCn(e.target.value)} placeholder="e.g. &#28145;&#22323;&#31185;&#25216;&#26377;&#38480;&#20844;&#21496;" className={inp} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={lbl}>Supplier Type</label>
                <select value={supplierType} onChange={(e) => setSupplierType(e.target.value)} className={inp}>
                  <option value="">Select type...</option>
                  {SUPPLIER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Industry</label>
                <input type="text" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Electronics" className={inp} />
              </div>
              <div>
                <label className={lbl}>Source</label>
                <select value={source} onChange={(e) => setSource(e.target.value)} className={inp}>
                  <option value="">Select source...</option>
                  {SUPPLIER_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--border-subtle)]" />

        {/* ── Contact Info ── */}
        <div>
          <p className={sectionTitle}>Contact Information</p>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={lbl}>Telephone</label>
                <input type="text" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="+86 755 1234 5678" className={inp} />
              </div>
              <div>
                <label className={lbl}>Mobile</label>
                <input type="text" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+86 138 0000 0000" className={inp} />
              </div>
              <div>
                <label className={lbl}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sales@company.com" className={inp} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Website</label>
                <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://www.company.com" className={inp} />
              </div>
              <CountryPicker
                value={countryName}
                countryCode={countryCode}
                onChange={(name, code) => {
                  setCountryName(name);
                  setCountryCode(code);
                  // Reset province & city when country changes
                  setProvinceName(""); setProvinceCode(""); setCity("");
                }}
              />
            </div>
            {/* Province + City — appear after country is selected */}
            {countryCode && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ProvincePicker
                  countryCode={countryCode}
                  value={provinceName}
                  stateCode={provinceCode}
                  onChange={(name, code) => {
                    setProvinceName(name);
                    setProvinceCode(code);
                    setCity(""); // Reset city when province changes
                  }}
                />
                <CityPicker
                  countryCode={countryCode}
                  stateCode={provinceCode}
                  value={city}
                  onChange={setCity}
                />
              </div>
            )}
            <div>
              <label className={lbl}>Address</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address..." className={inp} />
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--border-subtle)]" />

        {/* ── Contact Persons ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className={sectionTitle + " mb-0"}>Contact Persons</p>
            <button type="button" onClick={addContactPerson} className="h-8 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center gap-1.5 transition-colors">
              <PlusIcon className="h-3 w-3" /> Add Person
            </button>
          </div>
          {contactPersons.length === 0 ? (
            <p className="text-[12px] text-[var(--text-ghost)] text-center py-4 border border-dashed border-[var(--border-subtle)] rounded-xl">No contact persons added yet</p>
          ) : (
            <div className="space-y-4">
              {contactPersons.map((cp, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[var(--text-dim)]">Person {idx + 1}</span>
                    <button type="button" onClick={() => removeContactPerson(idx)} className="h-7 w-7 rounded-md flex items-center justify-center text-[var(--text-ghost)] hover:text-red-400 transition-colors">
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-[var(--text-ghost)] mb-1">Name</label>
                      <input type="text" value={cp.name} onChange={(e) => updateContactPerson(idx, "name", e.target.value)} placeholder="Full name" className={`${inp} h-9 text-[12px]`} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--text-ghost)] mb-1">Position</label>
                      <input type="text" value={cp.position} onChange={(e) => updateContactPerson(idx, "position", e.target.value)} placeholder="e.g. Sales Manager" className={`${inp} h-9 text-[12px]`} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--text-ghost)] mb-1">Department</label>
                      <input type="text" value={cp.department} onChange={(e) => updateContactPerson(idx, "department", e.target.value)} placeholder="e.g. Sales" className={`${inp} h-9 text-[12px]`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-[var(--text-ghost)] mb-1">Phone</label>
                      <input type="text" value={cp.phone} onChange={(e) => updateContactPerson(idx, "phone", e.target.value)} placeholder="Phone" className={`${inp} h-9 text-[12px]`} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--text-ghost)] mb-1">Mobile</label>
                      <input type="text" value={cp.mobile} onChange={(e) => updateContactPerson(idx, "mobile", e.target.value)} placeholder="Mobile" className={`${inp} h-9 text-[12px]`} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--text-ghost)] mb-1">Email</label>
                      <input type="email" value={cp.email} onChange={(e) => updateContactPerson(idx, "email", e.target.value)} placeholder="Email" className={`${inp} h-9 text-[12px]`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--border-subtle)]" />

        {/* ── Business Details ── */}
        <div>
          <p className={sectionTitle}>Business Details</p>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Division</label>
                <input type="text" value={division} onChange={(e) => setDivision(e.target.value)} placeholder="e.g. Industrial" className={inp} />
              </div>
              <div>
                <label className={lbl}>Category</label>
                <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Robotics" className={inp} />
              </div>
            </div>
            <div>
              <label className={lbl}>Brand Names</label>
              <input type="text" value={brandNames} onChange={(e) => setBrandNames(e.target.value)} placeholder="Comma-separated: Brand A, Brand B" className={inp} />
              <p className="text-[10px] text-[var(--text-ghost)] mt-1">Separate multiple brands with commas</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={lbl}>Payment Terms</label>
                <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={inp}>
                  <option value="">Select terms...</option>
                  {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Currency</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inp}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>MOQ</label>
                <input type="text" value={moq} onChange={(e) => setMoq(e.target.value)} placeholder="e.g. 100 units" className={inp} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Lead Time</label>
                <input type="text" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} placeholder="e.g. 30-45 days" className={inp} />
              </div>
              <div>
                <label className={lbl}>Payment Info / Bank Details</label>
                <input type="text" value={paymentInfo} onChange={(e) => setPaymentInfo(e.target.value)} placeholder="Bank transfer details..." className={inp} />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--border-subtle)]" />

        {/* ── Quality & Certifications ── */}
        <div>
          <p className={sectionTitle}>Quality & Certifications</p>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Rating</label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star === rating ? 0 : star)}
                      className={`h-9 w-9 rounded-lg flex items-center justify-center text-lg transition-colors ${
                        star <= rating
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-[var(--bg-surface-subtle)] text-[var(--text-ghost)] hover:text-amber-400/60"
                      }`}
                    >
                      &#9733;
                    </button>
                  ))}
                  {rating > 0 && <span className="text-[11px] text-[var(--text-dim)] ml-2">{rating}/5</span>}
                </div>
              </div>
              <div>
                <label className={lbl}>Sample Status</label>
                <select value={sampleStatus} onChange={(e) => setSampleStatus(e.target.value)} className={inp}>
                  <option value="">Select status...</option>
                  {SAMPLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={lbl}>Certifications</label>
              <div className="flex flex-wrap gap-2">
                {CERTIFICATIONS.map(cert => (
                  <button
                    key={cert}
                    type="button"
                    onClick={() => toggleCert(cert)}
                    className={`h-8 px-3 rounded-lg text-[11px] font-medium border transition-colors ${
                      certifications.includes(cert)
                        ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                        : "bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] text-[var(--text-ghost)] hover:text-[var(--text-dim)]"
                    }`}
                  >
                    {cert}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--border-subtle)]" />

        {/* ── Notes ── */}
        <div>
          <p className={sectionTitle}>Notes</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes about this supplier..."
            rows={3}
            className={`${inp} h-auto py-3 resize-none`}
          />
        </div>
      </div>
    </Modal>
  );
}
