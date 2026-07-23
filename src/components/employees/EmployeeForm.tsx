"use client";

/* ---------------------------------------------------------------------------
   Add Employee — Professional HR form with organized multi-panel layout.

   This file owns a lot. The page wires together four admin libs
   (employees, accounts, management, storage) and renders ~60 inputs.
   Helpers below are intentionally kept in the same file so the form
   stays readable top-to-bottom without jumping across modules.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fpAvatar } from "@/lib/cdn";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import PhoneIcon from "@/components/icons/ui/PhoneIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import CreditCardIcon from "@/components/icons/ui/CreditCardIcon";
import KeyIcon from "@/components/icons/ui/KeyIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import EyeOffIcon from "@/components/icons/ui/EyeOffIcon";
import EmployeesIcon from "@/components/icons/EmployeesIcon";
import CameraIcon from "@/components/icons/ui/CameraIcon";
import LanguagesIcon from "@/components/icons/ui/LanguagesIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import EmployeeSkillsSection from "@/components/employees/EmployeeSkillsSection";
import EmployeeBehaviorSection from "@/components/employees/EmployeeBehaviorSection";
import { usePermissions } from "@/lib/permissions";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import ProfileCompletenessBar from "@/components/ui/ProfileCompletenessBar";
import {
  emptyWizardData,
  generateEmployeeNumber,
  createFullEmployee,
  fetchDepartments,
  fetchPositionsByDepartment,
  fetchEmployeeList,
  updateFullEmployee,
  type EmployeeWizardData,
  type EmployeeListItem,
} from "@/lib/employees-admin";
import {
  fetchRoles,
  generateTemporaryPassword,
  suggestUsername,
} from "@/lib/accounts-admin";
import { uploadToStorage } from "@/lib/storage-client";
import { COUNTRIES } from "@/lib/commercial-policy/countries";
import {
  RELIGION_OPTIONS, LANGUAGE_OPTIONS, RELATIONSHIP_OPTIONS,
  CHILDREN_OPTIONS, splitMulti, joinMulti,
} from "@/lib/hr/person-options";
import { regionsFor, citiesFor } from "@/lib/geo/regions";
import HrFileField from "@/components/hr/HrFileField";
import BrandGlyph from "@/components/icons/brands/BrandGlyph";
import { useTranslation } from "@/lib/i18n";
import { employeesT } from "@/lib/translations/employees";
import type { DepartmentRow, PositionRow, RoleRow } from "@/types/supabase";

/* ═══════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════ */

const TITLE_OPTIONS = ["", "Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Eng."];
const GENDER_OPTIONS = ["", "Male", "Female", "Other"];
const MARITAL_OPTIONS = ["", "Single", "Married", "Divorced", "Widowed", "Separated"];

/* ── Option-label localisation ────────────────────────────────────────────
   The VALUE is what the database stores and the directory filters on, so it
   never changes; only the visible label is translated. Every lookup carries
   the English label as fallback, so a newly added enum value degrades to
   readable English instead of rendering a raw key. */
const OPT_KEY: Record<string, string> = {
  "Mr.": "opt.mr", "Mrs.": "opt.mrs", "Ms.": "opt.ms", "Dr.": "opt.dr", "Prof.": "opt.prof", "Eng.": "opt.eng",
  Male: "opt.male", Female: "opt.female", Other: "opt.other",
  Single: "opt.single", Married: "opt.married", Divorced: "opt.divorced", Widowed: "opt.widowed", Separated: "opt.separated",
  Islam: "rel.islam", Christianity: "rel.christianity", Catholicism: "rel.catholicism",
  "Orthodox Christianity": "rel.orthodox", Protestantism: "rel.protestantism", Judaism: "rel.judaism",
  Hinduism: "rel.hinduism", Buddhism: "rel.buddhism", Taoism: "rel.taoism", Confucianism: "rel.confucianism",
  Sikhism: "rel.sikhism", Jainism: "rel.jainism", Shinto: "rel.shinto", Zoroastrianism: "rel.zoroastrianism",
  "Bahá'í": "rel.bahai", Druze: "rel.druze", Yazidi: "rel.yazidi", "Folk religion": "rel.folk",
  Agnostic: "rel.agnostic", Atheist: "rel.atheist", None: "rel.none",
  "Prefer not to say": "rel.preferNot",
};
type TFn = (key: string, fallback?: string) => string;
/** Plain string list → {value,label} with the label translated. */
const tPlain = (t: TFn, arr: readonly string[]) =>
  arr.map((v) => ({ value: v, label: v ? t(OPT_KEY[v] ?? v, v) : "—" }));
/** {value,label,key} list → translated labels, value untouched. */
const tOpts = (t: TFn, arr: readonly { value: string; label: string; key?: string }[]) =>
  arr.map((o) => ({ value: o.value, label: o.key ? t(o.key, o.label) : o.label }));

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "full_time", label: "Full-time", key: "opt.fullTime" },
  { value: "part_time", label: "Part-time", key: "opt.partTime" },
  { value: "contract", label: "Contract", key: "opt.contract" },
  { value: "intern", label: "Intern", key: "opt.intern" },
  { value: "freelance", label: "Freelance", key: "opt.freelance" },
];
/* Mirrors koleex_employees.employment_status — the same values the list
   filters on, so a status set here is one the directory can find. */
const EMPLOYMENT_STATUS_OPTIONS = [
  { value: "active", label: "Active", key: "opt.active" },
  { value: "on_leave", label: "On Leave", key: "opt.onLeave" },
  { value: "suspended", label: "Suspended", key: "opt.suspended" },
  { value: "terminated", label: "Terminated", key: "opt.terminated" },
  { value: "resigned", label: "Resigned", key: "opt.resigned" },
];

const WORK_LOCATION_OPTIONS = [
  { value: "office", label: "Office", key: "opt.office" },
  { value: "remote", label: "Remote", key: "opt.remote" },
  { value: "hybrid", label: "Hybrid", key: "opt.hybrid" },
];
const BLOOD_TYPE_OPTIONS = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const DEGREE_OPTIONS = [
  { value: "", label: "Select...", key: "f.ph.select" },
  { value: "high_school", label: "High School Diploma", key: "opt.highSchool" },
  { value: "associate", label: "Associate Degree", key: "opt.associate" },
  { value: "bachelor", label: "Bachelor's Degree", key: "opt.bachelor" },
  { value: "master", label: "Master's Degree", key: "opt.master" },
  { value: "doctorate", label: "Doctorate / PhD", key: "opt.doctorate" },
  { value: "diploma", label: "Professional Diploma", key: "opt.diploma" },
  { value: "certificate", label: "Certificate", key: "opt.certificate" },
  { value: "other", label: "Other", key: "opt.other" },
];
const INSURANCE_CLASS_OPTIONS = [
  { value: "", label: "Select...", key: "f.ph.select" },
  { value: "A", label: "Class A (Premium)", key: "opt.classA" },
  { value: "B", label: "Class B (Standard)", key: "opt.classB" },
  { value: "C", label: "Class C (Basic)", key: "opt.classC" },
  { value: "VIP", label: "VIP", key: "opt.vip" },
];
const DRIVING_LICENSE_TYPE_OPTIONS = [
  { value: "", label: "Select...", key: "f.ph.select" },
  { value: "A", label: "A — Motorcycle", key: "opt.licA" },
  { value: "B", label: "B — Car", key: "opt.licB" },
  { value: "C", label: "C — Truck", key: "opt.licC" },
  { value: "D", label: "D — Bus", key: "opt.licD" },
  { value: "E", label: "E — Heavy Vehicle", key: "opt.licE" },
  { value: "international", label: "International", key: "opt.licIntl" },
];
/* Same platform list the Suppliers app uses (Contacts.tsx) — an employee and a
   supplier contact reachable on the same network should not be filed under two
   different spellings of it. */
const SOCIAL_PLATFORMS = ["WhatsApp", "WeChat", "LinkedIn", "Instagram", "Facebook", "Twitter/X", "Telegram", "Snapchat", "TikTok", "Other"];

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "SAR", label: "SAR — Saudi Riyal" },
  { value: "EGP", label: "EGP — Egyptian Pound" },
  { value: "QAR", label: "QAR — Qatari Riyal" },
  { value: "KWD", label: "KWD — Kuwaiti Dinar" },
  { value: "BHD", label: "BHD — Bahraini Dinar" },
  { value: "OMR", label: "OMR — Omani Rial" },
  { value: "JOD", label: "JOD — Jordanian Dinar" },
  { value: "CNY", label: "CNY — Chinese Yuan" },
  { value: "JPY", label: "JPY — Japanese Yen" },
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "TRY", label: "TRY — Turkish Lira" },
];
/** Same values as CURRENCY_OPTIONS but with a leading blank so the
 *  bank field is genuinely optional (unlike salary currency which
 *  defaults to USD). */
const BANK_CURRENCY_OPTIONS = [{ value: "", label: "—" }, ...CURRENCY_OPTIONS];

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;    // 5 MB raw before compression
const STORAGE_BUCKET = "media";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Human-readable labels for the validation banner. Keys match the
   field keys returned by validateForm() below. The banner shows the
   labels as clickable chips; clicking scrolls to + focuses the
   matching input (we target `[data-field="<key>"]`). */
const FIELD_LABELS: Record<string, string> = {
  first_name: "First Name",
  last_name: "Last Name",
  hire_date: "Hire Date",
  department_id: "Department",
  department_name: "New Department Name",
  position_id: "Position",
  position_title: "New Position Title",
  personal_email: "Personal Email",
  work_email: "Work Email",
  login_email: "Login Email",
  birthday: "Date of Birth",
  contract_end_date: "Contract End",
  probation_end_date: "Probation End",
  visa_expiry_date: "Visa Expiry",
  insurance_expiry_date: "Insurance Expiry",
  driving_license_expiry: "License Expiry",
  number_of_children: "Children",
  initial_salary: "Initial Salary",
  education_graduation_year: "Graduation Year",
};

function daysInMonth(month: number, year: number) {
  /* When the year is unknown we default to a non-leap year so the
     form doesn't let users pick Feb 29 before they've set a year.
     When month is unknown, fall back to 31 so the day dropdown is
     populated at all — it will re-filter the moment a month is
     picked. */
  if (!month) return 31;
  const y = year || 2001;
  return new Date(y, month, 0).getDate();
}

/* ═══════════════════════════════════════════════════
   REUSABLE INPUT COMPONENTS
   ═══════════════════════════════════════════════════ */

const inputBaseCls =
  "w-full h-10 px-3 rounded-xl bg-[var(--bg-primary)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const selectBaseCls =
  "w-full h-10 px-3 pr-9 rounded-xl bg-[var(--bg-primary)] text-[13px] text-[var(--text-primary)] appearance-none focus:outline-none transition-colors";

/** Pick the border class. Red takes precedence over focus, so any
 *  blur-after-error paints immediately. */
function borderFor(error?: string) {
  return error
    ? "border border-red-500/70 focus:border-red-500"
    : "border border-[var(--border-subtle)] focus:border-[var(--border-focus)]";
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="block text-[11px] font-medium text-[var(--text-dim)] mb-1">
      {label}
      {required && <span className="text-red-400 ml-0.5" aria-hidden="true">*</span>}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="text-[10.5px] text-red-400 mt-1" role="alert">{msg}</p>
  );
}

function TextInput({
  label, value, onChange, placeholder, type = "text", required, disabled,
  error, min, max, onBlur, inputMode, name,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; disabled?: boolean;
  error?: string;
  min?: number; max?: number;
  onBlur?: () => void;
  inputMode?: "numeric" | "decimal" | "email" | "tel" | "text";
  /** Field key used by the error banner's "jump to field" chips and
   *  by `aria-invalid` queries when scrolling to the first bad field. */
  name?: string;
}) {
  return (
    <div data-field={name}>
      <FieldLabel label={label} required={required} />
      <input
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        inputMode={inputMode}
        min={min}
        max={max}
        className={`${inputBaseCls} ${borderFor(error)}`}
      />
      <FieldError msg={error} />
    </div>
  );
}

function SelectInput({
  label, value, onChange, options, placeholder, required, error, name,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
  required?: boolean; error?: string;
  name?: string;
}) {
  return (
    <div data-field={name}>
      <FieldLabel label={label} required={required} />
      <div className="relative">
        <select
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          className={`${selectBaseCls} ${borderFor(error)}`}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <AngleDownIcon size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
      </div>
      <FieldError msg={error} />
    </div>
  );
}

/* ── Multi-value picker (languages).
   The column is a single `text`, so this joins on save and splits on load —
   a free-text box could not express "Arabic AND English" without the operator
   inventing a separator, and every operator invented a different one. */
function MultiSelectInput({
  label, value, onChange, options, placeholder = "Add…", allowCustom = true,
}: {
  label: string;
  /** Comma-joined string, exactly as stored. */
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder?: string;
  allowCustom?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement | null>(null);
  const selected = useMemo(() => splitMulti(value), [value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const add = (v: string) => {
    const item = v.trim();
    if (!item) return;
    if (selected.some((x) => x.toLowerCase() === item.toLowerCase())) return;
    onChange(joinMulti([...selected, item]));
    setQuery("");
  };
  const remove = (v: string) =>
    onChange(joinMulti(selected.filter((x) => x !== v)));

  const q = query.trim().toLowerCase();
  const available = options.filter(
    (o) => !selected.some((x) => x.toLowerCase() === o.toLowerCase()) &&
           (!q || o.toLowerCase().includes(q)),
  );
  /* Offer the typed value when it matches nothing — an employee may speak a
     language this list doesn't carry, and blocking that is worse than a typo. */
  const canCreate = allowCustom && q.length > 1 &&
    !options.some((o) => o.toLowerCase() === q) &&
    !selected.some((x) => x.toLowerCase() === q);

  return (
    <div ref={boxRef} className="relative">
      <FieldLabel label={label} />
      <div
        className={`min-h-10 w-full rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] px-2 py-1.5 flex flex-wrap items-center gap-1.5 cursor-text ${open ? "border-[var(--border-focus)]" : ""}`}
        onClick={() => setOpen(true)}
      >
        {selected.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] ps-2 pe-1 py-0.5 text-[12px] text-[var(--text-primary)]">
            {v}
            <button
              type="button"
              aria-label={`Remove ${v}`}
              onClick={(e) => { e.stopPropagation(); remove(v); }}
              className="w-4 h-4 rounded-full flex items-center justify-center text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              <CrossIcon size={9} />
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(query); }
            if (e.key === "Backspace" && !query && selected.length) remove(selected[selected.length - 1]);
          }}
          placeholder={selected.length ? "" : placeholder}
          className="flex-1 min-w-[80px] h-6 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none"
        />
      </div>

      {open && (available.length > 0 || canCreate) && (
        <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] shadow-xl py-1">
          {canCreate && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); add(query); }}
              className="w-full text-start px-3 py-2 text-[12.5px] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              Add “{query.trim()}”
            </button>
          )}
          {available.map((o) => (
            <button
              key={o}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); add(o); }}
              className="w-full text-start px-3 py-2 text-[12.5px] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-colors"
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Searchable combobox for long option lists (countries, employees).
   Native <select> typeahead matches the START of the visible label,
   which breaks when labels are prefixed with flag emojis — this
   component does a real substring search instead. */
interface ComboOption { value: string; label: string; prefix?: string; suffix?: string; }

function Combobox({
  label, value, onChange, options, placeholder = "Select...", required, error,
  searchPlaceholder = "Type to search...", emptyText = "No matches", ariaLabel, name,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: ComboOption[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  ariaLabel?: string;
  name?: string;
}) {
  const { t } = useTranslation(employeesT);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    const starts: ComboOption[] = [], contains: ComboOption[] = [];
    for (const o of options) {
      const l = o.label.toLowerCase();
      if (l.startsWith(q) || o.value.toLowerCase().startsWith(q)) starts.push(o);
      else if (l.includes(q)) contains.push(o);
    }
    return [...starts, ...contains];
  }, [query, options]);

  /* Close on outside click. */
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  /* Focus search input when opening. */
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    setQuery("");
  }, [open]);

  useEffect(() => { setHighlight(0); }, [query]);

  const pick = (v: string) => { onChange(v); setOpen(false); };

  return (
    <div ref={rootRef} data-field={name}>
      {label && <FieldLabel label={label} required={required} />}
      <div className="relative">
        <button
          type="button"
          data-combobox-trigger
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel || label}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          className={`${selectBaseCls} ${borderFor(error)} text-left flex items-center ${selected ? "" : "text-[var(--text-faint)]"}`}
        >
          <span className="truncate flex-1">
            {selected ? (
              <>
                {selected.prefix && <span className="mr-1.5">{selected.prefix}</span>}
                {selected.label}
                {selected.suffix && <span className="text-[var(--text-faint)] ml-1.5">{selected.suffix}</span>}
              </>
            ) : placeholder}
          </span>
        </button>
        <AngleDownIcon size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
        {selected && !required && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            aria-label={t("f.photo.clear")}
            className="absolute right-8 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-dim)]"
          >
            <CrossIcon size={12} />
          </button>
        )}

        {open && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden">
            <div className="p-2 border-b border-[var(--border-faint)]">
              <div className="relative">
                <SearchIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { setOpen(false); return; }
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlight((h) => Math.max(0, h - 1));
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      const opt = filtered[highlight];
                      if (opt) pick(opt.value);
                    }
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full h-9 pl-8 pr-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)]"
                />
              </div>
            </div>
            <ul role="listbox" className="max-h-64 overflow-y-auto">
              {filtered.length === 0 && (
                <li className="px-3 py-6 text-center text-[12px] text-[var(--text-faint)]">{emptyText}</li>
              )}
              {filtered.map((o, i) => {
                const isSel = o.value === value;
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSel}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => pick(o.value)}
                      className={`w-full text-left px-3 py-2 text-[13px] flex items-center gap-2 transition-colors ${
                        i === highlight ? "bg-[var(--bg-surface-subtle)]" : ""
                      } ${isSel ? "text-emerald-400" : "text-[var(--text-primary)]"}`}
                    >
                      {o.prefix && <span className="shrink-0">{o.prefix}</span>}
                      <span className="flex-1 truncate">{o.label}</span>
                      {o.suffix && <span className="text-[11px] text-[var(--text-faint)]">{o.suffix}</span>}
                      {isSel && <CheckIcon size={12} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      <FieldError msg={error} />
    </div>
  );
}

function DateInput({
  label, value, onChange, required, yearFrom = 1950, yearTo = 2040, error, name,
}: {
  label: string; value: string; onChange: (v: string) => void;
  required?: boolean; yearFrom?: number; yearTo?: number;
  error?: string;
  name?: string;
}) {
  const { t } = useTranslation(employeesT);
  const parts = value ? value.split("-") : [];
  const yr = parts[0] || "", mo = parts[1] || "", dy = parts[2] || "";
  const maxDay = daysInMonth(Number(mo), Number(yr));

  /* Previous implementation silently dropped partial dates (year-only
     or month+year but no day → returned ""). Now we keep a partial
     marker by pre-filling missing parts with a safe placeholder —
     that way the user's intent isn't lost if they need to scroll
     away to an earlier panel and come back. The final validate()
     still rejects incomplete dates. */
  const rebuild = (y: string, m: string, d: string) => {
    if (!y && !m && !d) return onChange("");
    const yy = y ? y.padStart(4, "0") : "0000";
    const mm = m ? m.padStart(2, "0") : "00";
    const dd = d ? d.padStart(2, "0") : "00";
    onChange(`${yy}-${mm}-${dd}`);
  };

  /* On phones each triad shares half a card column — with the desktop
     padding + chevron the selected value clips to "Ju" / "2". Below sm
     the selects go compact: centered value, no chevron, minimal padding. */
  const sCls =
    `h-10 px-1 sm:px-2 rounded-xl bg-[var(--bg-primary)] text-[12px] sm:text-[13px] text-[var(--text-primary)] appearance-none focus:outline-none transition-colors w-full pr-1 sm:pr-6 text-center sm:text-start ${borderFor(error)}`;

  return (
    <div data-field={name}>
      <FieldLabel label={label} required={required} />
      <div className="flex gap-1.5">
        <div className="relative flex-[1]">
          <select
            value={dy === "00" ? "" : dy}
            onChange={(e) => rebuild(yr, mo, e.target.value)}
            className={sCls}
            aria-label={`${label} day`}
            aria-invalid={error ? true : undefined}
          >
            <option value="">{t("d.day")}</option>
            {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
              <option key={d} value={String(d).padStart(2, "0")}>{d}</option>
            ))}
          </select>
          <AngleDownIcon size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none hidden sm:block" />
        </div>
        <div className="relative flex-[1.3]">
          <select
            value={mo === "00" ? "" : mo}
            onChange={(e) => {
              const newMo = e.target.value;
              const nd = daysInMonth(Number(newMo), Number(yr));
              const curD = Number(dy);
              /* Clamp day to the new month's range so Feb 31 can't
                 survive a month change. */
              const clamped = curD && curD > nd ? String(nd).padStart(2, "0") : dy;
              rebuild(yr, newMo, clamped);
            }}
            className={sCls}
            aria-label={`${label} month`}
          >
            <option value="">{t("d.month")}</option>
            {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
          </select>
          <AngleDownIcon size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none hidden sm:block" />
        </div>
        <div className="relative flex-[1.1]">
          <select
            value={yr === "0000" ? "" : yr}
            onChange={(e) => {
              const newYr = e.target.value;
              const nd = daysInMonth(Number(mo), Number(newYr));
              const curD = Number(dy);
              const clamped = curD && curD > nd ? String(nd).padStart(2, "0") : dy;
              rebuild(newYr, mo, clamped);
            }}
            className={sCls}
            aria-label={`${label} year`}
          >
            <option value="">{t("d.year")}</option>
            {Array.from({ length: yearTo - yearFrom + 1 }, (_, i) => yearTo - i).map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
          <AngleDownIcon size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none hidden sm:block" />
        </div>
      </div>
      <FieldError msg={error} />
    </div>
  );
}

function SectionHeader({
  icon: Icon, title, description,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-5 pb-4 border-b border-[var(--border-faint)]">
      <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center text-[var(--text-dim)] shrink-0" aria-hidden="true">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <h2 className="text-[14px] font-bold text-[var(--text-primary)] leading-tight">{title}</h2>
        {description && (
          <p className="text-[12px] text-[var(--text-dim)] mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}

/* Collapsible OPTIONAL section — hiring needs only Personal + Employment +
   Account up front; the rest starts folded so the form isn't a wall of
   fields. The whole header is the toggle; content stays MOUNTED (just
   hidden) so typed values and validation are preserved when folding. */
function CollapsibleSection({
  icon: Icon, title, description, open, onToggle, children,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  description?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={panelCls}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`w-full flex items-start gap-3 text-start group ${open ? "mb-5 pb-4 border-b border-[var(--border-faint)]" : ""}`}
      >
        <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center text-[var(--text-dim)] shrink-0" aria-hidden="true">
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-bold text-[var(--text-primary)] leading-tight">{title}</h2>
          {description && (
            <p className="text-[12px] text-[var(--text-dim)] mt-0.5">{description}</p>
          )}
        </div>
        <span className="flex items-center gap-2 shrink-0 mt-1.5">
          {!open && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)] hidden sm:block group-hover:text-[var(--text-dim)] transition-colors">
              Optional
            </span>
          )}
          <AngleDownIcon size={14} className={`text-[var(--text-dim)] transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      <div className={open ? "" : "hidden"}>{children}</div>
    </section>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="col-span-full text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-widest mt-2 -mb-1">
      {children}
    </p>
  );
}

/* ═══════════════════════════════════════════════════
   PHOTO UPLOAD
   ═══════════════════════════════════════════════════ */

/** Compress + upload to Supabase Storage. Returns the public URL.
 *  Previously we saved the compressed image as a base64 data URL
 *  directly into people.avatar_url which bloated every row; now the
 *  avatar column just holds a CDN URL. */
async function compressAndUploadPhoto(
  file: File,
  personHint: string,
): Promise<string> {
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`);
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed.");
  }

  const blob = await compressToBlob(file, 400, 0.82);
  const safeHint = personHint.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40) || "photo";
  const path = `employees/${Date.now()}_${safeHint}.jpg`;

  const up = await uploadToStorage(STORAGE_BUCKET, path, blob, {
    cacheControl: "3600",
    contentType: "image/jpeg",
  });
  if (!up.ok) throw new Error(up.error);
  return up.data.publicUrl;
}

function compressToBlob(file: File, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image — is the file corrupt?"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Compression returned empty blob"))),
          "image/jpeg",
          quality,
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/* ═══════════════════════════════════════════════════
   VALIDATION
   ═══════════════════════════════════════════════════ */

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

/** A date string is "complete" only when every part is a real
 *  number. The DateInput keeps partial entries so we detect them
 *  here and flag them as invalid. */
function isIncompleteDate(d: string): boolean {
  if (!d) return false;
  const [y, m, dd] = d.split("-");
  return y === "0000" || m === "00" || dd === "00";
}

function validateForm(form: EmployeeWizardData): Record<string, string> {
  const errs: Record<string, string> = {};

  /* Required core fields. */
  if (!form.first_name.trim()) errs.first_name = "Required";
  if (!form.last_name.trim()) errs.last_name = "Required";
  if (!form.hire_date) errs.hire_date = "Required";
  else if (isIncompleteDate(form.hire_date)) errs.hire_date = "Pick day, month, and year";

  if (!form.department_id && !form.create_new_department) errs.department_id = "Required";
  if (form.create_new_department && !form.department_name.trim()) errs.department_name = "Required";
  if (!form.position_id && !form.create_new_position) errs.position_id = "Required";
  if (form.create_new_position && !form.position_title.trim()) errs.position_title = "Required";

  /* Email format. */
  if (form.personal_email && !EMAIL_RE.test(form.personal_email)) errs.personal_email = "Invalid email";
  if (form.work_email && !EMAIL_RE.test(form.work_email)) errs.work_email = "Invalid email";

  if (form.create_account) {
    const loginEmail = form.login_email || form.work_email || form.personal_email;
    if (!loginEmail) errs.login_email = "Login email is required to create an account";
    else if (!EMAIL_RE.test(loginEmail)) errs.login_email = "Invalid email";
  }

  /* Partial-date markers on any optional date should also fail. */
  const dateFields: (keyof EmployeeWizardData)[] = [
    "birthday", "contract_end_date", "probation_end_date",
    "visa_expiry_date", "insurance_expiry_date", "driving_license_expiry",
  ];
  for (const f of dateFields) {
    const v = form[f] as string;
    if (isIncompleteDate(v)) errs[f as string] = "Pick day, month, and year";
  }

  /* Date range sanity. */
  const hd = form.hire_date && !isIncompleteDate(form.hire_date) ? form.hire_date : "";
  const bd = form.birthday && !isIncompleteDate(form.birthday) ? form.birthday : "";
  if (bd && hd && bd >= hd) errs.birthday = "Must be before hire date";
  if (bd && bd >= todayISO()) errs.birthday = "Birthday must be in the past";
  if (hd && form.contract_end_date && !isIncompleteDate(form.contract_end_date) && form.contract_end_date <= hd) {
    errs.contract_end_date = "Must be after hire date";
  }
  if (hd && form.probation_end_date && !isIncompleteDate(form.probation_end_date) && form.probation_end_date <= hd) {
    errs.probation_end_date = "Must be after hire date";
  }
  const t = todayISO();
  if (form.visa_expiry_date && !isIncompleteDate(form.visa_expiry_date) && form.visa_expiry_date < t) {
    errs.visa_expiry_date = "Already expired";
  }
  if (form.insurance_expiry_date && !isIncompleteDate(form.insurance_expiry_date) && form.insurance_expiry_date < t) {
    errs.insurance_expiry_date = "Already expired";
  }
  if (form.driving_license_expiry && !isIncompleteDate(form.driving_license_expiry) && form.driving_license_expiry < t) {
    errs.driving_license_expiry = "Already expired";
  }

  /* Number range sanity. */
  if (form.number_of_children) {
    const n = Number(form.number_of_children);
    if (!Number.isFinite(n) || n < 0 || n > 30) errs.number_of_children = "0–30";
  }
  if (form.initial_salary) {
    const n = Number(form.initial_salary);
    if (!Number.isFinite(n) || n < 0) errs.initial_salary = "Must be 0 or more";
  }
  if (form.education_graduation_year) {
    const n = Number(form.education_graduation_year);
    const thisYear = new Date().getFullYear();
    if (!Number.isFinite(n) || n < 1940 || n > thisYear + 10) errs.education_graduation_year = `1940–${thisYear + 10}`;
  }

  return errs;
}

/* ═══════════════════════════════════════════════════
   PANEL WRAPPER
   ═══════════════════════════════════════════════════ */

const panelCls =
  "bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6";

/* ── Employee tabs — same premium sticky pill nav as the Customer /
   Supplier form (CustomerTabBar in Contacts.tsx): photo hero up top,
   then the form split into tab panes instead of one long scroll. Panes
   stay MOUNTED (hidden, not unmounted) so values and validation hold. */
type EmpTab = "personal" | "employment" | "skills" | "behavior" | "compensation" | "documents" | "account";

/* Tab labels are translation KEYS — the bar resolves them at render so the
   strip localises with the rest of the form. */
const EMP_TABS: { id: EmpTab; label: string; icon: React.ComponentType<{ size?: number | string; className?: string }> }[] = [
  { id: "personal", label: "tab.personal", icon: UserIcon },
  { id: "employment", label: "tab.employment", icon: BriefcaseIcon },
  { id: "compensation", label: "tab.compensation", icon: CreditCardIcon },
  { id: "documents", label: "tab.documents", icon: DocumentIcon },
  { id: "skills", label: "tab.skills", icon: SparklesIcon },
  { id: "behavior", label: "tab.behavior", icon: ShieldIcon },
  { id: "account", label: "tab.account", icon: KeyIcon },
];

/* Which tab owns each validated field — error chips and the submit path
   must land on the right pane before scrolling to the field. */
const FIELD_TAB: Record<string, EmpTab> = {
  first_name: "personal", last_name: "personal", birthday: "personal",
  number_of_children: "personal", personal_email: "personal", work_email: "personal",
  employee_number: "employment", hire_date: "employment",
  department_id: "employment", department_name: "employment",
  position_id: "employment", position_title: "employment",
  contract_end_date: "employment", probation_end_date: "employment",
  initial_salary: "compensation", insurance_expiry_date: "compensation",
  visa_expiry_date: "documents", driving_license_expiry: "documents",
  education_graduation_year: "documents",
  login_email: "account",
};

function EmployeeTabBar({ activeTab, onChange, errorTabs }: {
  activeTab: EmpTab;
  onChange: (tab: EmpTab) => void;
  /* Tabs holding validation errors get a red dot (after a failed save). */
  errorTabs?: Set<EmpTab>;
}) {
  const { t } = useTranslation(employeesT);
  return (
    <div className="sticky top-[58px] z-20 -mx-4 md:-mx-6 lg:-mx-10 xl:-mx-16 px-4 md:px-6 lg:px-10 xl:px-16 bg-[var(--bg-primary)] pt-1 pb-2 mb-4">
      <nav className="flex gap-1 overflow-x-auto rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-1.5 py-1.5 scrollbar-none no-scrollbar">
        {EMP_TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={active ? "true" : undefined}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors whitespace-nowrap ${
                active
                  ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon size={14} className={active ? "text-[var(--text-inverted)]" : "text-[var(--text-faint)]"} />
              <span>{t(label)}</span>
              {errorTabs?.has(id) && !active && (
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PAGE COMPONENT
   ═══════════════════════════════════════════════════ */

/* Fields counted toward the profile-completeness bar. Picked to mirror
   what an HR operator would consider "a complete profile" — identity,
   contact, employment, address, emergency contact, documents, bank,
   compensation, education. Excludes derived/admin flags (create_*),
   the auto-generated employee_number, and the optional account block. */
const TRACKED_EMPLOYEE_FIELDS: readonly (keyof EmployeeWizardData)[] = [
  "photo_url", "title", "first_name", "last_name",
  "gender", "birthday", "nationality", "marital_status",
  "personal_phone", "personal_email",
  "hire_date", "employment_type", "work_email", "work_phone", "work_location",
  "department_id", "position_id",
  "private_address_line1", "private_city", "private_country",
  "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship",
  "identification_id", "passport_number",
  "bank_name", "bank_account_number", "bank_iban", "bank_currency",
  "initial_salary", "salary_currency",
  "manager_id",
  "education_degree",
];

/* Count "filled" only when the value DIFFERS from the empty default.
   `emptyWizardData()` populates four tracked fields with placeholders —
   hire_date = today, employment_type = "full_time", work_location =
   "office", salary_currency = "USD" — so a freshly-opened form used to
   start at 12%. Compare to defaults so the bar starts at 0%. */
function isUserFilled<K extends keyof EmployeeWizardData>(
  key: K,
  value: EmployeeWizardData[K],
  defaults: EmployeeWizardData,
): boolean {
  const def = defaults[key];
  if (value == null) return false;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return false;
    if (typeof def === "string" && trimmed === def.trim()) return false;
    return true;
  }
  if (typeof value === "number") {
    if (Number.isNaN(value)) return false;
    if (typeof def === "number" && value === def) return false;
    return true;
  }
  if (Array.isArray(value)) return value.length > 0;
  return value !== def;
}

function EmployeeCompletenessBar({ form }: { form: EmployeeWizardData }) {
  const defaults = useMemo(() => emptyWizardData(), []);
  const filled = TRACKED_EMPLOYEE_FIELDS.reduce(
    (n, k) => n + (isUserFilled(k, form[k], defaults) ? 1 : 0),
    0,
  );
  return (
    <ProfileCompletenessBar
      filled={filled}
      total={TRACKED_EMPLOYEE_FIELDS.length}
      className="mb-5"
    />
  );
}

export interface EmployeeFormProps {
  /** "create" posts a new employee; "edit" saves over an existing one. */
  mode?: "create" | "edit";
  /** Required in edit mode — the koleex_employees row being saved. */
  employeeId?: string;
  /** Pre-filled state in edit mode (see wizardDataFromProfile). */
  initial?: EmployeeWizardData;
}

/* ONE form for both add and edit. They used to be two different screens
   writing different subsets of columns, so the same employee looked like a
   different record depending on which door you came through. */
export default function EmployeeForm({ mode = "create", employeeId, initial }: EmployeeFormProps) {
  const perms = usePermissions();
  const isEdit = mode === "edit";
  const { t } = useTranslation(employeesT);
  const router = useRouter();
  const [form, setForm] = useState<EmployeeWizardData>(initial ?? emptyWizardData());
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{
    id: string;
    name: string;
    partial?: string;
    /* Credentials shown once in the success modal. The admin copies
       them to share with the new employee — after the modal closes
       they're gone (the hashed version stays in the DB). */
    username?: string;
    loginEmail?: string;
    tempPassword?: string;
  } | null>(null);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [loadingDeps, setLoadingDeps] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  /* Tabbed layout (same grammar as the Customer / Supplier form). The
     optional Contact / Emergency sections inside the Personal tab still
     start folded so the hiring path reads short. */
  const [activeTab, setActiveTab] = useState<EmpTab>("personal");
  const [openSections, setOpenSections] = useState({ contact: false, emergency: false });
  const toggleSection = (k: keyof typeof openSections) =>
    setOpenSections((s) => ({ ...s, [k]: !s[k] }));

  /* Completeness % mirrored in the sticky action bar — the full bar at
     the top scrolls away, this keeps the signal while filling. */
  const completenessDefaults = useMemo(() => emptyWizardData(), []);
  const completenessPct = useMemo(() => {
    const filled = TRACKED_EMPLOYEE_FIELDS.reduce(
      (n, k) => n + (isUserFilled(k, form[k], completenessDefaults) ? 1 : 0),
      0,
    );
    return Math.round((filled / TRACKED_EMPLOYEE_FIELDS.length) * 100);
  }, [form, completenessDefaults]);

  /* Country options are stable — compute once. The flag is kept in
     `prefix` so the user can actually type-to-search by country
     name (the old native <select> matched the emoji first). */
  const countryOptions: ComboOption[] = useMemo(
    () => COUNTRIES.map((c) => ({ value: c.code, label: c.name, prefix: c.flag, suffix: c.code })),
    [],
  );

  /* The wizard state is a flat string map, so social_accounts travels as a
     JSON string; the editor above wants an array. Parse on read, serialise on
     write — and never throw on bad stored JSON, which would blank the form. */
  const socials = useMemo<{ platform: string; value: string }[]>(() => {
    try {
      const parsed = JSON.parse(form.social_accounts || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [form.social_accounts]);
  const setSocials = useCallback(
    (rows: { platform: string; value: string }[]) => set("social_accounts", JSON.stringify(rows)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* Divisions for the chosen country, and cities for the chosen division.
     Both recompute from the form, so changing the country above instantly
     re-stocks the two pickers below it. */
  const stateOptions: ComboOption[] = useMemo(
    () => regionsFor(form.private_country).map((r) => ({
      value: r.name,
      label: r.name,
      suffix: r.name_alt,
    })),
    [form.private_country],
  );
  const cityOptions: ComboOption[] = useMemo(
    () => citiesFor(form.private_country, form.private_state).map((c) => ({ value: c, label: c })),
    [form.private_country, form.private_state],
  );

  /* Active-only manager picker. Filter in memory because the fetch
     response already trims most rows. */
  const managerOptions: ComboOption[] = useMemo(
    () => employees
      .filter((e) => e.employment_status === "active")
      .map((e) => ({
        value: e.id,
        label: e.person.full_name,
        suffix: e.position_title || e.employee_number || undefined,
      })),
    [employees],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [deps, empNum, rolesData, empList] = await Promise.all([
        fetchDepartments(),
        /* Editing keeps the existing number — asking the server for a fresh
           one would overwrite it the moment the form mounted. */
        isEdit ? Promise.resolve("") : generateEmployeeNumber(),
        fetchRoles(),
        fetchEmployeeList({ activeOnly: true }),
      ]);
      if (cancelled) return;
      setDepartments(deps); setRoles(rolesData); setEmployees(empList);
      if (!isEdit) setForm((f) => ({ ...f, employee_number: empNum }));
      setLoadingDeps(false);
    })();
    return () => { cancelled = true; };
  }, [isEdit]);

  useEffect(() => {
    if (!form.department_id || form.create_new_department) { setPositions([]); return; }
    let cancelled = false;
    fetchPositionsByDepartment(form.department_id).then((pos) => { if (!cancelled) setPositions(pos); });
    return () => { cancelled = true; };
  }, [form.department_id, form.create_new_department]);

  /* Position → suggested account role. Positions carry a default role
     (koleex_positions.role_id), so picking "Sales Executive" pre-selects
     the Sales role in Account Setup. Only fills an EMPTY role — a role
     the admin chose by hand is never overwritten. */
  useEffect(() => {
    if (!form.position_id || form.create_new_position) return;
    const pos = positions.find((p) => p.id === form.position_id);
    if (pos?.role_id) {
      setForm((f) => (f.role_id ? f : { ...f, role_id: pos.role_id! }));
    }
  }, [form.position_id, form.create_new_position, positions]);

  /* Duplicate-hire guard: warn (non-blocking) when the typed name or
     email matches an existing employee — protects the people table,
     which is the identity source of truth for the whole hub. */
  const dupWarning = useMemo(() => {
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const full = norm(`${form.first_name} ${form.last_name}`);
    const email = (form.work_email || form.personal_email).trim().toLowerCase();
    if (full.length < 5 && !email) return null;
    const hit = employees.find((e) =>
      /* Never flag the record being edited as a duplicate of itself. */
      e.id !== employeeId &&
      ((full.length >= 5 && norm(e.person.full_name || "") === full) ||
        (!!email && (e.person.email || "").trim().toLowerCase() === email)),
    );
    return hit ? hit.person.full_name : null;
  }, [employees, employeeId, form.first_name, form.last_name, form.work_email, form.personal_email]);

  /* Browser-level unsaved-changes guard. Fires on tab close /
     refresh / hard navigation. Next.js <Link> soft navigations are
     handled separately by the back-arrow confirm below. */
  useEffect(() => {
    if (!isDirty || saving || saved) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, saving, saved]);

  const set = useCallback(
    <K extends keyof EmployeeWizardData>(key: K, value: EmployeeWizardData[K]) => {
      setForm((f) => ({ ...f, [key]: value }));
      setError(null);
      setIsDirty(true);
    }, [],
  );

  /* Per-field errors. Computed on every render from the current
     form so corrections clear the highlight immediately. Only
     displayed after the user has tried to submit at least once —
     users shouldn't see red fields the moment they open the form. */
  const errors = useMemo(() => validateForm(form), [form]);
  /* Tabs that currently hold at least one invalid field (red-dot marker). */
  const errorTabs = useMemo(
    () => new Set(Object.keys(errors).map((k) => FIELD_TAB[k] ?? "personal")),
    [errors],
  );
  const errFor = (key: string): string | undefined =>
    attemptedSubmit ? errors[key] : undefined;

  const handlePhotoSelect = async (file: File | undefined) => {
    if (!file) return;
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const url = await compressAndUploadPhoto(file, `${form.first_name}_${form.last_name}`);
      set("photo_url", url);
    } catch (e: unknown) {
      setPhotoError(e instanceof Error ? e.message : "Photo upload failed");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleBack = () => {
    if (isDirty && !saved) {
      if (!window.confirm(t("unsaved.confirm"))) return;
    }
    router.push(isEdit && employeeId ? `/employees/${employeeId}` : "/employees");
  };

  /** Scroll a field into view and focus it. Targets [data-field]
   *  wrappers set by TextInput / SelectInput / DateInput / Combobox. */
  const focusField = useCallback((fieldKey: string) => {
    if (typeof window === "undefined") return;
    const root = document.querySelector(`[data-field="${fieldKey}"]`) as HTMLElement | null;
    if (!root) return;
    root.scrollIntoView({ behavior: "smooth", block: "center" });
    /* Give the scroll a beat before focusing so the browser doesn't
       abort the smooth-scroll animation. */
    setTimeout(() => {
      const focusable = root.querySelector<HTMLElement>(
        "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [data-combobox-trigger]",
      );
      focusable?.focus();
    }, 250);
  }, []);

  /* Switch to the tab that owns a field (unfolding its section when it
     lives in a folded one), then scroll+focus once the pane rendered. */
  const jumpToField = useCallback((fieldKey: string) => {
    setActiveTab(FIELD_TAB[fieldKey] ?? "personal");
    if (fieldKey === "personal_email" || fieldKey === "work_email") {
      setOpenSections((s) => ({ ...s, contact: true }));
    }
    setTimeout(() => focusField(fieldKey), 140);
  }, [focusField]);

  const handleSubmit = useCallback(async () => {
    setAttemptedSubmit(true);
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) {
      /* Clear the plain-text banner; the rich error banner rendered
         below reads from the `errors` memo. */
      setError(null);
      /* Unfold the folded Personal sub-sections, then jump to the tab
         holding the first invalid field and focus it. */
      setOpenSections({ contact: true, emergency: true });
      const firstKey = Object.keys(errs)[0];
      if (firstKey) jumpToField(firstKey);
      return;
    }
    setSaving(true); setError(null);
    const result = isEdit && employeeId
      ? await updateFullEmployee(employeeId, form)
      : await createFullEmployee(form);
    if (!result.success) {
      setError(result.error || "Failed to create employee.");
      setSaving(false);
      /* Employee-number collisions are recoverable — auto-fetch a
         fresh suggestion from the server and point the user at the
         field so they can just click Save again. */
      if (result.error?.toLowerCase().includes("employee number")) {
        const next = await generateEmployeeNumber();
        if (next !== form.employee_number) {
          setForm((f) => ({ ...f, employee_number: next }));
        }
        jumpToField("employee_number");
      }
      return;
    }
    setIsDirty(false);
    /* Editing returns straight to the profile — the success modal exists to
       hand over the new login credentials, and an edit never mints any. */
    if (isEdit && employeeId) {
      /* The list caches its rows; drop it so the change shows immediately. */
      try { sessionStorage.removeItem("kx:employees:list:v1"); } catch { /* ignore */ }
      router.push(`/employees/${employeeId}`);
      return;
    }
    /* Baseline behavior — recorded as the first assessment for the new hire,
       ONLY if scores were entered. Best-effort: a failed baseline (e.g. the
       operator lacks HR create) must not undo the successful hire. Never a
       "fake finalized" record — it is an honest baseline, labelled as such. */
    try {
      const items = JSON.parse(form.behavior_baseline || "[]");
      if (Array.isArray(items) && items.some((i) => i?.employee_score != null)) {
        await fetch("/api/hr/behavior", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employee_id: result.employeeId, assessment_type: "baseline", items }),
        });
      }
    } catch { /* baseline is optional */ }

    setSaved({
      id: result.employeeId!,
      name: `${form.first_name} ${form.last_name}`.trim(),
      partial: result.error,
      username: result.accountUsername,
      loginEmail: result.accountLoginEmail,
      tempPassword: result.tempPassword,
    });
    setSaving(false);
  }, [form, jumpToField, isEdit, employeeId, router]);

  const resetForm = async () => {
    const empNum = await generateEmployeeNumber();
    setForm({ ...emptyWizardData(), employee_number: empNum });
    setAttemptedSubmit(false);
    setSaved(null);
    setIsDirty(false);
    setError(null);
    setPhotoError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ── Post-save modal ──
     Replaces the old 1.2s redirect that dumped the user on the
     employees list with no way to jump to the new record. */
  const SavedModal = saved ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="saved-title"
    >
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-500/10">
            <CheckIcon size={20} className="text-emerald-400" />
          </div>
          <div>
            <h2 id="saved-title" className="text-base font-semibold text-[var(--text-primary)]">{t("saved.title")}</h2>
            <p className="text-xs text-[var(--text-dim)]">{t("saved.body").replace("{name}", saved.name || "")}</p>
          </div>
        </div>
        {saved.partial && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[12px] text-amber-400">
            {saved.partial}
          </div>
        )}

        {/* Credentials — shown ONCE. After the modal closes the
            plain-text temp password is gone (only the base64 version
            remains in the DB). Each field has its own Copy button so
            the admin can share username + password via any channel. */}
        {saved.username && saved.tempPassword && (
          <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
            <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-2">
              {t("cred.title")}
            </p>
            <p className="text-[11px] text-[var(--text-dim)] mb-3">
              {t("cred.shareBefore")} {saved.name || t("cred.theEmployee")} {t("cred.shareAfter")}
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--text-dim)] w-16 shrink-0">{t("cred.username")}</span>
                <code className="flex-1 text-[13px] font-mono px-2 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] truncate">
                  {saved.username}
                </code>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard?.writeText(saved.username!).catch(() => {}); }}
                  className="h-8 px-2 text-[11px] rounded-md border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Copy
                </button>
              </div>
              {saved.loginEmail && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[var(--text-dim)] w-16 shrink-0">{t("cred.email")}</span>
                  <code className="flex-1 text-[13px] font-mono px-2 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] truncate">
                    {saved.loginEmail}
                  </code>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard?.writeText(saved.loginEmail!).catch(() => {}); }}
                    className="h-8 px-2 text-[11px] rounded-md border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    Copy
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--text-dim)] w-16 shrink-0">{t("cred.password")}</span>
                <code className="flex-1 text-[13px] font-mono px-2 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] truncate">
                  {saved.tempPassword}
                </code>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard?.writeText(saved.tempPassword!).catch(() => {}); }}
                  className="h-8 px-2 text-[11px] rounded-md border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
            <p className="text-[10px] text-[var(--text-faint)] mt-3">
              The employee will be asked to set their own password the first time they sign in.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Link
            href={`/employees/${saved.id}`}
            className="h-10 px-3 rounded-xl text-sm font-medium bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 flex items-center justify-center transition-opacity"
          >
            {t("saved.view")}
          </Link>
          <button
            onClick={resetForm}
            className="h-10 px-3 rounded-xl text-sm font-medium border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
          >
            {t("saved.addAnother")}
          </button>
          <Link
            href="/employees"
            className="h-10 px-3 rounded-xl text-sm font-medium border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
          >
            {t("saved.toList")}
          </Link>
        </div>
      </div>
    </div>
  ) : null;

  /* ── Main render ── */
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {SavedModal}
      <div className="mx-auto px-4 md:px-6 lg:px-10 xl:px-16 py-6 md:py-8">

        {/* ── Header ── */}
        <div className="sticky top-0 z-30 -mx-4 md:-mx-6 lg:-mx-10 xl:-mx-16 px-4 md:px-6 lg:px-10 xl:px-16 py-3 -mt-2 bg-[var(--bg-primary)]/95 backdrop-blur-md border-b border-[var(--border-faint)] flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
              aria-label={t("back.toList")}
            >
              <ArrowLeftIcon size={16} />
            </button>
            <EmployeesIcon size={18} className="text-[var(--text-dim)] shrink-0 hidden sm:block" />
            <h1 className="text-lg font-semibold text-[var(--text-primary)] truncate">{isEdit ? t("app.edit", "Edit employee") : t("app.add")}</h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span
              className="hidden sm:flex items-center gap-2 text-[11px] font-semibold text-[var(--text-dim)] tabular-nums"
              title="Profile completeness"
            >
              <span className="h-1.5 w-16 rounded-full bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] overflow-hidden">
                <span
                  className="block h-full rounded-full bg-[var(--text-primary)] transition-[width] duration-300"
                  style={{ width: `${completenessPct}%` }}
                />
              </span>
              {completenessPct}%
            </span>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 h-10 px-4 sm:px-5 rounded-xl text-sm font-medium bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              aria-label={t("save.employee")}
            >
              {saving ? <SpinnerIcon size={16} className="animate-spin" /> : <CheckIcon size={16} />}
              <span className="hidden xs:inline sm:inline">{saving ? t("saving") : t("save.employee")}</span>
            </button>
          </div>
        </div>

        {/* Profile completeness — counts the trackable fields filled */}
        <EmployeeCompletenessBar form={form} />

        {/* ── Photo hero — same centered uploader as the Customer form ── */}
        <div className="flex flex-col items-center mb-5">
          <label className="block cursor-pointer group" aria-label={t("f.photo.upload")}>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              aria-label={t("f.photo.file")}
              onChange={(e) => handlePhotoSelect(e.target.files?.[0])}
            />
            <div className="relative h-28 w-28 rounded-2xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex items-center justify-center overflow-hidden group-hover:border-[var(--border-focus)] transition-colors">
              {photoUploading ? (
                <SpinnerIcon size={22} className="animate-spin text-[var(--text-dim)]" />
              ) : form.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fpAvatar(form.photo_url)} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="text-center">
                  <CameraIcon size={22} className="mx-auto text-[var(--text-faint)] group-hover:text-[var(--text-dim)] transition-colors" />
                  <span className="block text-[10px] text-[var(--text-faint)] mt-1">{t("f.photo.add")}</span>
                </div>
              )}
            </div>
          </label>
          <p className="text-[11px] text-[var(--text-faint)] mt-2">
            {t("f.photo.help")}
          </p>
          {photoError && (
            <p className="text-[11px] text-red-400 mt-1" role="alert">{photoError}</p>
          )}
          {form.photo_url && !photoUploading && (
            <button
              type="button"
              onClick={() => set("photo_url", null)}
              className="text-[10px] text-red-400 hover:text-red-300 mt-1 transition-colors"
            >
              Remove photo
            </button>
          )}
        </div>

        {/* Validation summary — lists the exact fields that need
            attention, with click-to-jump chips. Appears only after
            the user has attempted a save at least once. Lets them
            see what's blocking without scrolling the whole form. */}
        {attemptedSubmit && Object.keys(errors).length > 0 && (
          <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/20" role="alert">
            <p className="text-sm font-semibold text-red-400 mb-2">
              {t("val.header").replace("{n}", String(Object.keys(errors).length))}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(errors).map(([key, msg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => jumpToField(key)}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 hover:text-red-200 transition-colors cursor-pointer"
                  title={`Jump to ${FIELD_LABELS[key] || key}`}
                >
                  {FIELD_LABELS[key] || key}
                  <span className="ml-1 text-red-400/80">· {msg}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400" role="alert">{error}</div>
        )}

        {/* ═══════════════════════════════════════════
           FORM SECTIONS — tabbed like the Customer form
           ═══════════════════════════════════════════ */}
        <EmployeeTabBar
          activeTab={activeTab}
          onChange={setActiveTab}
          errorTabs={attemptedSubmit ? errorTabs : undefined}
        />
        <div>
          {/* ── PERSONAL TAB ── */}
          <div className={activeTab === "personal" ? "space-y-4" : "hidden"}>

          {/* ── 1. PERSONAL PROFILE ── */}
          <section className={panelCls}>
            <SectionHeader
              icon={UserIcon}
              title={t("sec.personal")}
              description={t("sec.personal.desc")}
            />

            {/* Name row — the photo moved to the hero above the tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <SelectInput label={t("f.title")} value={form.title} onChange={(v) => set("title", v)}
                options={tPlain(t, TITLE_OPTIONS)} placeholder="—" />
              <TextInput name="first_name" label={t("f.firstName")} value={form.first_name} onChange={(v) => set("first_name", v)} placeholder={t("f.firstName")} required error={errFor("first_name")} />
              <TextInput label={t("f.middleName")} value={form.middle_name} onChange={(v) => set("middle_name", v)} placeholder={t("f.middleName")} />
              <TextInput name="last_name" label={t("f.lastName")} value={form.last_name} onChange={(v) => set("last_name", v)} placeholder={t("f.lastName")} required error={errFor("last_name")} />
            </div>

            {/* Alternate name */}
            <div className="mb-4 p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-faint)]">
              <div className="flex items-center gap-2 mb-2.5">
                <LanguagesIcon size={12} className="text-[var(--text-faint)]" />
                <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-widest">{t("f.altName.title")}</span>
                <span className="text-[10px] text-[var(--text-faint)]">{t("f.altName.eg")}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextInput label={t("f.firstNameAlt")} value={form.first_name_alt} onChange={(v) => set("first_name_alt", v)} placeholder="e.g. 明" />
                <TextInput label={t("f.lastNameAlt")} value={form.last_name_alt} onChange={(v) => set("last_name_alt", v)} placeholder="e.g. 李" />
              </div>
            </div>

            {dupWarning && (
              <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3" role="alert">
                <ShieldIcon size={14} className="text-amber-400 mt-0.5 shrink-0" />
                <div className="text-[12px] text-amber-300">
                  A similar employee already exists: <span className="font-semibold">{dupWarning}</span>.
                  Double-check before creating a duplicate record.
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              <SelectInput label={t("f.gender")} value={form.gender} onChange={(v) => set("gender", v)}
                options={tPlain(t, GENDER_OPTIONS)} placeholder={t("f.ph.select")} />
              <DateInput name="birthday" label={t("f.birthday")} value={form.birthday} onChange={(v) => set("birthday", v)} yearFrom={1940} yearTo={2010} error={errFor("birthday")} />
              <Combobox
                label={t("f.nationality")}
                value={form.nationality}
                onChange={(v) => set("nationality", v)}
                options={countryOptions}
                placeholder={t("f.ph.selectCountry")}
                searchPlaceholder="Search 249 countries…"
              />
              <SelectInput label={t("f.marital")} value={form.marital_status} onChange={(v) => set("marital_status", v)}
                options={tPlain(t, MARITAL_OPTIONS)} placeholder={t("f.ph.select")} />
              <SelectInput name="number_of_children" label={t("f.children")} value={form.number_of_children} onChange={(v) => set("number_of_children", v)}
                options={CHILDREN_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} error={errFor("number_of_children")} />
              <SelectInput label={t("f.blood")} value={form.blood_type} onChange={(v) => set("blood_type", v)}
                options={BLOOD_TYPE_OPTIONS.map((b) => ({ value: b, label: b || "—" }))} placeholder="—" />
              <SelectInput label={t("f.religion")} value={form.religion} onChange={(v) => set("religion", v)}
                options={tPlain(t, RELIGION_OPTIONS)} placeholder={t("f.ph.select")} />
              <MultiSelectInput label={t("f.languages")} value={form.languages} onChange={(v) => set("languages", v)}
                options={LANGUAGE_OPTIONS} placeholder={t("f.ph.addLanguage")} />
            </div>
          </section>

          {/* ── 2. CONTACT & ADDRESS (optional, folded) ── */}
          <CollapsibleSection
            icon={PhoneIcon}
            title={t("sec.contact")}
            description={t("sec.contact.desc")}
            open={openSections.contact}
            onToggle={() => toggleSection("contact")}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <TextInput label={t("f.personalPhone")} value={form.personal_phone} onChange={(v) => set("personal_phone", v)} placeholder="+1 234 567 890" type="tel" inputMode="tel" />
              <TextInput name="personal_email" label={t("f.personalEmail")} value={form.personal_email} onChange={(v) => set("personal_email", v)} placeholder="personal@email.com" type="email" inputMode="email" error={errFor("personal_email")} />
              <TextInput label={t("f.workPhone")} value={form.work_phone} onChange={(v) => set("work_phone", v)} placeholder="+1 234 567 890" type="tel" inputMode="tel" />
              <TextInput name="work_email" label={t("f.workEmail")} value={form.work_email} onChange={(v) => set("work_email", v)} placeholder="name@company.com" type="email" inputMode="email" error={errFor("work_email")}
                onBlur={() => {
                  // Mirror into the login email while it's still untouched.
                  if (form.create_account && !form.login_email && form.work_email) {
                    set("login_email", form.work_email);
                  }
                }} />
            </div>

            <SubLabel>{t("f.addr.home")}</SubLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
              <TextInput label={t("f.addr.line1")} value={form.private_address_line1} onChange={(v) => set("private_address_line1", v)} placeholder={t("f.ph.street")} />
              <TextInput label={t("f.addr.line2")} value={form.private_address_line2} onChange={(v) => set("private_address_line2", v)} placeholder={t("f.ph.aptSuite")} />
              {/* Country → state → city. Ordered country-first because that is
                  the direction the data flows: picking a country decides which
                  provinces exist, and picking a province decides which cities.
                  Countries we don't carry divisions for fall back to typing —
                  an empty dropdown would read as "broken", not as "no data". */}
              <Combobox
                label={t("f.addr.country")}
                value={form.private_country}
                onChange={(v) => {
                  set("private_country", v);
                  /* Clear the finer levels: a province from the old country is
                     simply wrong under the new one, and leaving it produces
                     records like "Zhejiang, Egypt". */
                  if (v !== form.private_country) { set("private_state", ""); set("private_city", ""); }
                }}
                options={countryOptions}
                placeholder={t("f.ph.selectCountry")}
                searchPlaceholder="Search 249 countries…"
              />
              {stateOptions.length > 0 ? (
                <Combobox
                  label={t("f.addr.state")}
                  value={form.private_state}
                  onChange={(v) => {
                    set("private_state", v);
                    if (v !== form.private_state) set("private_city", "");
                  }}
                  options={stateOptions}
                  placeholder={t("f.ph.selectState")}
                  searchPlaceholder="Type to search…"
                />
              ) : (
                <TextInput label={t("f.addr.state")} value={form.private_state} onChange={(v) => set("private_state", v)} placeholder={t("f.addr.state")} />
              )}
              {cityOptions.length > 0 ? (
                <Combobox
                  label={t("f.addr.city")}
                  value={form.private_city}
                  onChange={(v) => set("private_city", v)}
                  options={cityOptions}
                  placeholder={t("f.ph.selectCity")}
                  searchPlaceholder="Type to search…"
                />
              ) : (
                <TextInput label={t("f.addr.city")} value={form.private_city} onChange={(v) => set("private_city", v)} placeholder={t("f.addr.city")} />
              )}
              <TextInput label={t("f.addr.postal")} value={form.private_postal_code} onChange={(v) => set("private_postal_code", v)} placeholder={t("f.addr.postal")} />
            </div>

            {/* ── WeChat ──
                One card, not two loose fields: the ID and the QR are two ways
                of reaching the SAME account, so they read as one identity.
                The QR tile is square because a QR is square — the old
                full-width dashed banner made a code look like a file drop. */}
            <SubLabel>{t("f.wechat.title")}</SubLabel>
            <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 p-3">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="min-w-0 flex-1 space-y-3">
                  <TextInput
                    label={t("f.wechat.id")}
                    value={form.wechat_id}
                    onChange={(v) => set("wechat_id", v)}
                    placeholder={t("f.ph.wechatHandle")}
                  />
                  <p className="text-[11px] leading-snug text-[var(--text-dim)]">
                    Add the ID, the QR image, or both — either one is enough to
                    reach this person.
                  </p>
                </div>
                <div className="sm:w-[190px] shrink-0">
                  <FieldLabel label={t("f.wechat.qr")} />
                  <HrFileField
                    value={form.wechat_qr_url}
                    onChange={(v) => set("wechat_qr_url", v)}
                    folder="documents"
                    shape="square"
                    label={t("f.drop.qr")}
                    hint="PNG / JPG"
                    browseLabel="Browse" removeLabel="Remove" errorLabel="Upload failed"
                  />
                </div>
              </div>
            </div>

            {/* ── Social accounts (same repeater shape as the Suppliers app) ── */}
            <SubLabel>{t("sec.social")}</SubLabel>
            <div className="mt-3 space-y-2.5">
              {socials.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSocials(socials.filter((_, x) => x !== i))}
                    aria-label={t("f.social.remove")}
                    className="w-6 h-6 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <CrossIcon size={10} />
                  </button>
                  {/* The logo is the fastest way to scan a list of handles —
                      you recognise the mark before you read the name. Same
                      BrandGlyph the Suppliers app uses. */}
                  <span className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)]">
                    <BrandGlyph name={row.platform} size={17} />
                  </span>
                  <div className="w-32 shrink-0 sm:w-40">
                    <select
                      value={row.platform}
                      onChange={(e) => setSocials(socials.map((r, x) => x === i ? { ...r, platform: e.target.value } : r))}
                      className={`${selectBaseCls} border-[var(--border-subtle)]`}
                      aria-label={t("f.social.platform")}
                    >
                      {SOCIAL_PLATFORMS.map((pf) => <option key={pf} value={pf}>{pf}</option>)}
                    </select>
                  </div>
                  <input
                    value={row.value}
                    onChange={(e) => setSocials(socials.map((r, x) => x === i ? { ...r, value: e.target.value } : r))}
                    placeholder={t("f.ph.socialLink")}
                    aria-label={t("f.social.account")}
                    className={`${inputBaseCls} border border-[var(--border-subtle)] flex-1 min-w-0`}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setSocials([...socials, { platform: "LinkedIn", value: "" }])}
                className="flex items-center gap-2 text-[12.5px] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
              >
                <span className="w-6 h-6 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center">
                  <PlusIcon size={11} />
                </span>
                {t("f.social.add")}
              </button>
            </div>
          </CollapsibleSection>

          {/* ── 3. EMERGENCY CONTACTS (optional, folded) ── */}
          <CollapsibleSection
            icon={ShieldIcon}
            title={t("sec.emergency")}
            description={t("sec.emergency.desc")}
            open={openSections.emergency}
            onToggle={() => toggleSection("emergency")}
          >
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <SubLabel>{t("f.em.primary")}</SubLabel>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <TextInput label={t("f.em.name")} value={form.emergency_contact_name} onChange={(v) => set("emergency_contact_name", v)} placeholder={t("f.ph.fullName")} />
                  <TextInput label={t("f.em.phone")} value={form.emergency_contact_phone} onChange={(v) => set("emergency_contact_phone", v)} placeholder="+1 234 567 890" type="tel" inputMode="tel" />
                  <SelectInput label={t("f.em.relationship")} value={form.emergency_contact_relationship} onChange={(v) => set("emergency_contact_relationship", v)}
                    options={tPlain(t, RELATIONSHIP_OPTIONS)} placeholder={t("f.ph.select")} />
                </div>
              </div>
              <div>
                <SubLabel>{t("f.em.secondary")}</SubLabel>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <TextInput label={t("f.em.name")} value={form.emergency_contact2_name} onChange={(v) => set("emergency_contact2_name", v)} placeholder={t("f.ph.fullName")} />
                  <TextInput label={t("f.em.phone")} value={form.emergency_contact2_phone} onChange={(v) => set("emergency_contact2_phone", v)} placeholder="+1 234 567 890" type="tel" inputMode="tel" />
                  <SelectInput label={t("f.em.relationship")} value={form.emergency_contact2_relationship} onChange={(v) => set("emergency_contact2_relationship", v)}
                    options={tPlain(t, RELATIONSHIP_OPTIONS)} placeholder={t("f.ph.select")} />
                </div>
              </div>
            </div>
          </CollapsibleSection>

          </div>

          {/* ── EMPLOYMENT TAB ── */}
          <div className={activeTab === "employment" ? "space-y-4" : "hidden"}>

          {/* ── 4. EMPLOYMENT & ORGANIZATION ── */}
          <section className={panelCls}>
            <SectionHeader
              icon={BriefcaseIcon}
              title={t("sec.employment")}
              description={t("sec.employment.desc")}
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
              {/* Employee Number — auto-generated but editable.
                  Previously disabled; that left no escape hatch when
                  the auto-generator misfired (e.g. RLS hid existing
                  rows from the anon client and every new hire
                  collided on EMP-001). Now editable + a refresh
                  button fetches a fresh suggestion from the server. */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <FieldLabel label={t("f.emp.number")} />
                  <button
                    type="button"
                    onClick={async () => {
                      const next = await generateEmployeeNumber();
                      set("employee_number", next);
                    }}
                    className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text-primary)] -mt-1 transition-colors"
                    title={t("f.emp.fetchNext")}
                  >
                    {t("f.acct.regenerate")}
                  </button>
                </div>
                <input
                  name="employee_number"
                  type="text"
                  value={form.employee_number}
                  onChange={(e) => set("employee_number", e.target.value)}
                  placeholder="EMP-001"
                  className={`${inputBaseCls} ${borderFor()}`}
                />
              </div>
              <SelectInput label={t("f.emp.type")} value={form.employment_type} onChange={(v) => set("employment_type", v)} options={tOpts(t, EMPLOYMENT_TYPE_OPTIONS)} />
              {/* Status is an edit-only control: a new hire is always created
                  active, so offering it on the add form would be a field with
                  exactly one sensible answer. */}
              {isEdit && (
                <SelectInput
                  label={t("f.emp.status")}
                  value={form.employment_status}
                  onChange={(v) => set("employment_status", v)}
                  options={tOpts(t, EMPLOYMENT_STATUS_OPTIONS)}
                />
              )}
              <DateInput name="hire_date" label={t("f.emp.hireDate")} value={form.hire_date} onChange={(v) => set("hire_date", v)} yearFrom={2000} yearTo={2030} required error={errFor("hire_date")} />
              <SelectInput label={t("f.emp.workLocation")} value={form.work_location} onChange={(v) => set("work_location", v)} options={tOpts(t, WORK_LOCATION_OPTIONS)} />
              <Combobox
                label={t("f.emp.manager")}
                value={form.manager_id}
                onChange={(v) => set("manager_id", v)}
                options={managerOptions}
                placeholder={managerOptions.length ? t("f.ph.select") : t("f.ph.noActiveEmp")}
                searchPlaceholder="Search employees…"
                emptyText="No employees match"
              />
              <DateInput name="contract_end_date" label={t("f.emp.contractEnd")} value={form.contract_end_date} onChange={(v) => set("contract_end_date", v)} yearFrom={2024} yearTo={2035} error={errFor("contract_end_date")} />
              <DateInput name="probation_end_date" label={t("f.emp.probationEnd")} value={form.probation_end_date} onChange={(v) => set("probation_end_date", v)} yearFrom={2024} yearTo={2030} error={errFor("probation_end_date")} />
            </div>

            {/* Department & Position */}
            <div className="border-t border-[var(--border-faint)] pt-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Building2Icon size={14} className="text-[var(--text-dim)]" />
                  <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-widest">{t("f.deptPos")}</span>
                </div>
                <Link
                  href="/management"
                  className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors underline-offset-2 hover:underline shrink-0 whitespace-nowrap"
                >
                  <span className="hidden sm:inline">Manage in Management app →</span>
                  <span className="sm:hidden">Manage →</span>
                </Link>
              </div>

              {loadingDeps ? (
                <div className="flex items-center gap-2 text-xs text-[var(--text-faint)] py-3">
                  <SpinnerIcon size={14} className="animate-spin" /> Loading...
                </div>
              ) : departments.length === 0 && !form.create_new_department ? (
                <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-dashed border-[var(--border-subtle)] text-center">
                  <Building2Icon size={20} className="mx-auto text-[var(--text-faint)] mb-2" />
                  <p className="text-[13px] text-[var(--text-primary)] font-medium mb-1">{t("f.dept.empty.title")}</p>
                  <p className="text-[11px] text-[var(--text-dim)] mb-3">
                    {t("f.dept.empty.body")}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <Link
                      href="/management"
                      className="h-8 px-3 rounded-lg text-[11px] font-medium border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] inline-flex items-center gap-1 transition-colors"
                    >
                      Open Management
                    </Link>
                    <button
                      type="button"
                      onClick={() => set("create_new_department", true)}
                      className="h-8 px-3 rounded-lg text-[11px] font-medium bg-[var(--bg-inverted)] text-[var(--text-inverted)] inline-flex items-center gap-1 hover:opacity-90 transition-opacity"
                    >
                      <PlusIcon size={10} /> Create inline
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {/* Department */}
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      {!form.create_new_department ? (
                        <SelectInput
                          name="department_id"
                          label={t("f.pos.department")}
                          value={form.department_id}
                          onChange={(v) => { set("department_id", v); set("position_id", ""); }}
                          options={departments.map((d) => ({ value: d.id, label: d.name }))}
                          placeholder={t("f.ph.select")}
                          required
                          error={errFor("department_id")}
                        />
                      ) : (
                        <TextInput name="department_name" label={t("f.dept.new")} value={form.department_name} onChange={(v) => set("department_name", v)} placeholder="e.g. Engineering" required error={errFor("department_name")} />
                      )}
                    </div>
                    <button type="button" onClick={() => {
                      const next = !form.create_new_department;
                      set("create_new_department", next);
                      if (next) { set("department_id", ""); set("position_id", ""); }
                    }}
                      className="flex items-center gap-1 h-10 px-3 rounded-xl text-[11px] font-medium border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                      <PlusIcon size={12} />{form.create_new_department ? t("f.dept.existing") : t("f.dept.newShort")}
                    </button>
                  </div>
                  {/* Position */}
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      {!form.create_new_position ? (
                        <SelectInput
                          name="position_id"
                          label={t("f.pos.position")}
                          value={form.position_id}
                          onChange={(v) => set("position_id", v)}
                          options={positions.map((p) => ({ value: p.id, label: p.title }))}
                          placeholder={
                            !form.department_id && !form.create_new_department
                              ? t("f.pos.selectDept")
                              : positions.length === 0
                              ? t("f.pos.noPositions")
                              : t("f.ph.select")
                          }
                          required
                          error={errFor("position_id")}
                        />
                      ) : (
                        <TextInput name="position_title" label={t("f.pos.new")} value={form.position_title} onChange={(v) => set("position_title", v)} placeholder="e.g. Software Engineer" required error={errFor("position_title")} />
                      )}
                    </div>
                    <button type="button" onClick={() => {
                      const next = !form.create_new_position;
                      set("create_new_position", next);
                      if (next) set("position_id", "");
                    }}
                      className="flex items-center gap-1 h-10 px-3 rounded-xl text-[11px] font-medium border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                      <PlusIcon size={12} />{form.create_new_position ? t("f.dept.existing") : t("f.dept.newShort")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          </div>

          {/* ── SKILLS TAB ── */}
          <div className={activeTab === "skills" ? "space-y-4" : "hidden"}>
            <section className={panelCls}>
              <SectionHeader
                icon={SparklesIcon}
                title={t("sec.skills")}
                description={t("sec.skills.desc")}
              />
              <EmployeeSkillsSection
                positionId={form.create_new_position ? "" : form.position_id}
                value={form.skills}
                onChange={(v) => set("skills", v)}
                canConfigurePosition={perms.can("Employees", "edit")}
              />
            </section>
          </div>

          {/* ── BEHAVIOR TAB ── */}
          <div className={activeTab === "behavior" ? "space-y-4" : "hidden"}>
            <section className={panelCls}>
              <SectionHeader
                icon={ShieldIcon}
                title={t("sec.behavior")}
                description={t("sec.behavior.desc")}
              />
              <EmployeeBehaviorSection
                mode={mode}
                employeeId={employeeId}
                positionId={form.create_new_position ? "" : form.position_id}
                value={form.behavior_baseline}
                onChange={(v) => set("behavior_baseline", v)}
                canConfigurePosition={perms.can("Employees", "edit")}
              />
            </section>
          </div>

          {/* ── COMPENSATION TAB ── */}
          <div className={activeTab === "compensation" ? "space-y-4" : "hidden"}>

          {/* ── 5. COMPENSATION & BENEFITS ── */}
          <section className={panelCls}>
            <SectionHeader
              icon={CreditCardIcon}
              title={t("sec.compensation")}
              description={t("sec.compensation.desc")}
            />

            <SubLabel>{t("f.comp.salary")}</SubLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 mb-4 max-w-md">
              <TextInput name="initial_salary" label={t("f.comp.initSalary")} value={form.initial_salary} onChange={(v) => set("initial_salary", v)} placeholder="e.g. 5000" type="number" min={0} inputMode="decimal" error={errFor("initial_salary")} />
              <SelectInput label={t("f.comp.currency")} value={form.salary_currency} onChange={(v) => set("salary_currency", v)} options={CURRENCY_OPTIONS} />
            </div>

            <SubLabel>{t("f.comp.bank")}</SubLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3 mb-4">
              <TextInput label={t("f.comp.bankName")} value={form.bank_name} onChange={(v) => set("bank_name", v)} placeholder="e.g. HSBC" />
              <TextInput label={t("f.comp.holder")} value={form.bank_account_holder} onChange={(v) => set("bank_account_holder", v)} placeholder={t("f.ph.nameOnAccount")} />
              <TextInput label={t("f.comp.accNum")} value={form.bank_account_number} onChange={(v) => set("bank_account_number", v)} placeholder={t("f.comp.accNum")} />
              <TextInput label={t("f.comp.iban")} value={form.bank_iban} onChange={(v) => set("bank_iban", v)} placeholder={t("f.comp.iban")} />
              <TextInput label={t("f.comp.swift")} value={form.bank_swift} onChange={(v) => set("bank_swift", v)} placeholder={t("f.ph.swiftCode")} />
              <SelectInput label={t("f.comp.currency")} value={form.bank_currency} onChange={(v) => set("bank_currency", v)} options={BANK_CURRENCY_OPTIONS} />
            </div>

            <SubLabel>{t("f.comp.insurance")}</SubLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
              <TextInput label={t("f.comp.provider")} value={form.insurance_provider} onChange={(v) => set("insurance_provider", v)} placeholder="e.g. Bupa" />
              <TextInput label={t("f.comp.policy")} value={form.insurance_policy_number} onChange={(v) => set("insurance_policy_number", v)} placeholder={t("f.comp.policy")} />
              <SelectInput label={t("f.comp.class")} value={form.insurance_class} onChange={(v) => set("insurance_class", v)} options={tOpts(t, INSURANCE_CLASS_OPTIONS)} />
              <DateInput name="insurance_expiry_date" label={t("f.comp.expiry")} value={form.insurance_expiry_date} onChange={(v) => set("insurance_expiry_date", v)} yearFrom={2024} yearTo={2035} error={errFor("insurance_expiry_date")} />
            </div>
          </section>
          </div>

          {/* ── DOCUMENTS TAB ── */}
          <div className={activeTab === "documents" ? "space-y-4" : "hidden"}>

          {/* ── 6. DOCUMENTS & COMPLIANCE ── */}
          <section className={panelCls}>
            <SectionHeader
              icon={DocumentIcon}
              title={t("sec.docs")}
              description={t("sec.docs.desc")}
            />

            <SubLabel>{t("f.docs.identification")}</SubLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3 mb-4">
              <TextInput label={t("f.docs.natId")} value={form.identification_id} onChange={(v) => set("identification_id", v)} placeholder={t("f.ph.idNumber")} />
              <TextInput label={t("f.docs.passport")} value={form.passport_number} onChange={(v) => set("passport_number", v)} placeholder="Passport #" />
              <TextInput label={t("f.docs.ssn")} value={form.social_security_number} onChange={(v) => set("social_security_number", v)} placeholder="SSN" />
              <TextInput label={t("f.docs.tax")} value={form.tax_id} onChange={(v) => set("tax_id", v)} placeholder={t("f.docs.tax")} />
            </div>

            {/* The scan belongs BESIDE the number it pictures, not in a
                separate "attachments" pile at the bottom — you fill in the
                passport number and the passport photo in the same breath.
                An ID card has TWO sides and both carry data (number and photo
                on the front; address, issuing authority and expiry on the
                back), so one slot could only ever hold half the document. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <FieldLabel label={t("f.docs.natIdFront")} />
                <HrFileField
                  value={form.national_id_doc_url}
                  onChange={(v) => set("national_id_doc_url", v)}
                  folder="documents"
                  shape="card"
                  label={t("f.drop.front")}
                  hint="Image or PDF, up to 10 MB"
                  browseLabel="Browse" removeLabel="Remove" errorLabel="Upload failed"
                />
              </div>
              <div>
                <FieldLabel label={t("f.docs.natIdBack")} />
                <HrFileField
                  value={form.national_id_back_doc_url}
                  onChange={(v) => set("national_id_back_doc_url", v)}
                  folder="documents"
                  shape="card"
                  label={t("f.drop.back")}
                  hint="Image or PDF, up to 10 MB"
                  browseLabel="Browse" removeLabel="Remove" errorLabel="Upload failed"
                />
              </div>
              <div>
                <FieldLabel label={t("f.docs.passportPhoto")} />
                <HrFileField
                  value={form.passport_doc_url}
                  onChange={(v) => set("passport_doc_url", v)}
                  folder="documents"
                  shape="card"
                  label={t("f.drop.passport")}
                  hint="Image or PDF, up to 10 MB"
                  browseLabel="Browse" removeLabel="Remove" errorLabel="Upload failed"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-3 mb-4">
              <div>
                <SubLabel>{t("f.docs.visa")}</SubLabel>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <TextInput label={t("f.docs.visaNum")} value={form.visa_number} onChange={(v) => set("visa_number", v)} placeholder="Visa #" />
                  <DateInput name="visa_expiry_date" label={t("f.docs.visaExp")} value={form.visa_expiry_date} onChange={(v) => set("visa_expiry_date", v)} yearFrom={2024} yearTo={2035} error={errFor("visa_expiry_date")} />
                </div>
                <div className="mt-3">
                  <FieldLabel label={t("f.docs.visaPhoto")} />
                  <HrFileField
                    value={form.visa_doc_url}
                    onChange={(v) => set("visa_doc_url", v)}
                    folder="documents"
                    shape="card"
                    label={t("f.drop.visa")}
                    hint="Image or PDF, up to 10 MB"
                    browseLabel="Browse" removeLabel="Remove" errorLabel="Upload failed"
                  />
                </div>
              </div>
              <div>
                <SubLabel>{t("f.docs.education")}</SubLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <SelectInput label={t("f.docs.degree")} value={form.education_degree} onChange={(v) => set("education_degree", v)} options={tOpts(t, DEGREE_OPTIONS)} />
                  <TextInput label={t("f.docs.institution")} value={form.education_institution} onChange={(v) => set("education_institution", v)} placeholder={t("f.ph.universityName")} />
                  <TextInput label={t("f.docs.field")} value={form.education_field} onChange={(v) => set("education_field", v)} placeholder="e.g. Computer Science" />
                  <TextInput name="education_graduation_year" label={t("f.docs.gradYear")} value={form.education_graduation_year} onChange={(v) => set("education_graduation_year", v)} placeholder="e.g. 2020" type="number" min={1940} max={new Date().getFullYear() + 10} inputMode="numeric" error={errFor("education_graduation_year")} />
                </div>
              </div>
            </div>

            <SubLabel>{t("f.docs.drivingLicense")}</SubLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
              <TextInput label={t("f.docs.licenseNum")} value={form.driving_license_number} onChange={(v) => set("driving_license_number", v)} placeholder="License #" />
              <SelectInput label={t("f.docs.licenseType")} value={form.driving_license_type} onChange={(v) => set("driving_license_type", v)} options={tOpts(t, DRIVING_LICENSE_TYPE_OPTIONS)} />
              <DateInput name="driving_license_expiry" label={t("f.comp.expiry")} value={form.driving_license_expiry} onChange={(v) => set("driving_license_expiry", v)} yearFrom={2024} yearTo={2040} error={errFor("driving_license_expiry")} />
            </div>
          </section>
          </div>

          {/* ── ACCOUNT TAB ── */}
          <div className={activeTab === "account" ? "space-y-4" : "hidden"}>

          {/* ── 7. ACCOUNT SETUP ── */}
          <section className={panelCls}>
            <SectionHeader
              icon={KeyIcon}
              title={t("sec.account")}
              description={t("sec.account.desc")}
            />

            <div className="flex items-center gap-3 mb-3">
              <button
                type="button"
                onClick={() => {
                  /* Turning the account on pre-fills login email (from work
                     email) and username (from the name) when still empty —
                     the same address was previously typed twice. */
                  setForm((f) => {
                    const next = !f.create_account;
                    return {
                      ...f,
                      create_account: next,
                      login_email: next && !f.login_email && f.work_email ? f.work_email : f.login_email,
                      username: next && !f.username && f.first_name && f.last_name
                        ? suggestUsername(`${f.first_name} ${f.last_name}`)
                        : f.username,
                    };
                  });
                  setIsDirty(true);
                }}
                role="switch"
                aria-checked={form.create_account}
                aria-label={t("f.acct.toggle")}
                className={`relative w-11 h-6 rounded-full transition-colors ${form.create_account ? "bg-emerald-500" : "bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.create_account ? "translate-x-5" : "translate-x-0"}`} />
              </button>
              <span className="text-sm text-[var(--text-dim)]">{t("f.acct.toggle")}</span>
            </div>

            {!form.create_account && (
              <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
                <ShieldIcon size={14} className="text-amber-400 mt-0.5 shrink-0" />
                <div className="text-[12px] text-amber-300">
                  {t("f.acct.warn")}
                </div>
              </div>
            )}

            {form.create_account && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <TextInput
                  label={t("f.acct.username")}
                  value={form.username}
                  onChange={(v) => set("username", v)}
                  placeholder="e.g. john.doe"
                  onBlur={() => {
                    /* Suggest a username once both names exist and
                       the user hasn't typed their own. Feedback was
                       silent — user never saw what we picked. */
                    if (!form.username && form.first_name && form.last_name) {
                      set("username", suggestUsername(`${form.first_name} ${form.last_name}`));
                    }
                  }}
                />
                <TextInput
                  name="login_email"
                  label={t("f.acct.loginEmail")}
                  value={form.login_email}
                  onChange={(v) => set("login_email", v)}
                  placeholder="login@company.com"
                  type="email"
                  inputMode="email"
                  required
                  error={errFor("login_email")}
                />
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <FieldLabel label={t("f.acct.tempPassword")} />
                    <button
                      type="button"
                      onClick={() => set("temp_password", generateTemporaryPassword())}
                      className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text-primary)] -mt-1 transition-colors"
                    >
                      {t("f.acct.regenerate")}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.temp_password}
                      onChange={(e) => set("temp_password", e.target.value)}
                      className={`${inputBaseCls} ${borderFor()} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? t("f.acct.hidePw") : t("f.acct.showPw")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-dim)] transition-colors"
                    >
                      {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                    </button>
                  </div>
                </div>
                <SelectInput
                  label={t("f.acct.role")}
                  value={form.role_id}
                  onChange={(v) => set("role_id", v)}
                  options={roles.map((r) => ({ value: r.id, label: r.name }))}
                  placeholder={t("f.acct.selectRole")}
                />
              </div>
            )}
          </section>
          </div>
        </div>
      </div>
    </div>
  );
}
