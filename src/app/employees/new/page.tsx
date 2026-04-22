"use client";

/* ---------------------------------------------------------------------------
   Add Employee — Professional HR form with organized multi-panel layout.

   This file owns a lot. The page wires together four admin libs
   (employees, accounts, management, storage) and renders ~60 inputs.
   Helpers below are intentionally kept in the same file so the form
   stays readable top-to-bottom without jumping across modules.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import CrossIcon from "@/components/icons/ui/CrossIcon";
import {
  emptyWizardData,
  generateEmployeeNumber,
  createFullEmployee,
  fetchDepartments,
  fetchPositionsByDepartment,
  fetchEmployeeList,
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
import type { DepartmentRow, PositionRow, RoleRow } from "@/types/supabase";

/* ═══════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════ */

const TITLE_OPTIONS = ["", "Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Eng."];
const GENDER_OPTIONS = ["", "Male", "Female", "Other"];
const MARITAL_OPTIONS = ["", "Single", "Married", "Divorced", "Widowed", "Separated"];
const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
  { value: "freelance", label: "Freelance" },
];
const WORK_LOCATION_OPTIONS = [
  { value: "office", label: "Office" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
];
const RELATIONSHIP_OPTIONS = ["", "Spouse", "Parent", "Sibling", "Child", "Friend", "Other"];
const BLOOD_TYPE_OPTIONS = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const DEGREE_OPTIONS = [
  { value: "", label: "Select..." },
  { value: "high_school", label: "High School Diploma" },
  { value: "associate", label: "Associate Degree" },
  { value: "bachelor", label: "Bachelor's Degree" },
  { value: "master", label: "Master's Degree" },
  { value: "doctorate", label: "Doctorate / PhD" },
  { value: "diploma", label: "Professional Diploma" },
  { value: "certificate", label: "Certificate" },
  { value: "other", label: "Other" },
];
const INSURANCE_CLASS_OPTIONS = [
  { value: "", label: "Select..." },
  { value: "A", label: "Class A (Premium)" },
  { value: "B", label: "Class B (Standard)" },
  { value: "C", label: "Class C (Basic)" },
  { value: "VIP", label: "VIP" },
];
const DRIVING_LICENSE_TYPE_OPTIONS = [
  { value: "", label: "Select..." },
  { value: "A", label: "A — Motorcycle" },
  { value: "B", label: "B — Car" },
  { value: "C", label: "C — Truck" },
  { value: "D", label: "D — Bus" },
  { value: "E", label: "E — Heavy Vehicle" },
  { value: "international", label: "International" },
];
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
  error, min, max, onBlur, inputMode,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; disabled?: boolean;
  error?: string;
  min?: number; max?: number;
  onBlur?: () => void;
  inputMode?: "numeric" | "decimal" | "email" | "tel" | "text";
}) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <input
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
  label, value, onChange, options, placeholder, required, error,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
  required?: boolean; error?: string;
}) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <div className="relative">
        <select
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

/* ── Searchable combobox for long option lists (countries, employees).
   Native <select> typeahead matches the START of the visible label,
   which breaks when labels are prefixed with flag emojis — this
   component does a real substring search instead. */
interface ComboOption { value: string; label: string; prefix?: string; suffix?: string; }

function Combobox({
  label, value, onChange, options, placeholder = "Select...", required, error,
  searchPlaceholder = "Type to search...", emptyText = "No matches", ariaLabel,
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
}) {
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
    <div ref={rootRef}>
      {label && <FieldLabel label={label} required={required} />}
      <div className="relative">
        <button
          type="button"
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
            aria-label="Clear selection"
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
  label, value, onChange, required, yearFrom = 1950, yearTo = 2040, error,
}: {
  label: string; value: string; onChange: (v: string) => void;
  required?: boolean; yearFrom?: number; yearTo?: number;
  error?: string;
}) {
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

  const sCls =
    `h-10 px-2 rounded-xl bg-[var(--bg-primary)] text-[13px] text-[var(--text-primary)] appearance-none focus:outline-none transition-colors w-full pr-6 ${borderFor(error)}`;

  return (
    <div>
      <FieldLabel label={label} required={required} />
      <div className="flex gap-1.5">
        <div className="relative flex-[1]">
          <select
            value={dy === "00" ? "" : dy}
            onChange={(e) => rebuild(yr, mo, e.target.value)}
            className={sCls}
            aria-label={`${label} day`}
          >
            <option value="">Day</option>
            {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
              <option key={d} value={String(d).padStart(2, "0")}>{d}</option>
            ))}
          </select>
          <AngleDownIcon size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
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
            <option value="">Month</option>
            {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
          </select>
          <AngleDownIcon size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
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
            <option value="">Year</option>
            {Array.from({ length: yearTo - yearFrom + 1 }, (_, i) => yearTo - i).map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
          <AngleDownIcon size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
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

/* ═══════════════════════════════════════════════════
   PAGE COMPONENT
   ═══════════════════════════════════════════════════ */

export default function AddEmployeePage() {
  const router = useRouter();
  const [form, setForm] = useState<EmployeeWizardData>(emptyWizardData());
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; name: string; partial?: string } | null>(null);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [loadingDeps, setLoadingDeps] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  /* Country options are stable — compute once. The flag is kept in
     `prefix` so the user can actually type-to-search by country
     name (the old native <select> matched the emoji first). */
  const countryOptions: ComboOption[] = useMemo(
    () => COUNTRIES.map((c) => ({ value: c.code, label: c.name, prefix: c.flag, suffix: c.code })),
    [],
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
        generateEmployeeNumber(),
        fetchRoles(),
        fetchEmployeeList({ activeOnly: true }),
      ]);
      if (cancelled) return;
      setDepartments(deps); setRoles(rolesData); setEmployees(empList);
      setForm((f) => ({ ...f, employee_number: empNum }));
      setLoadingDeps(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!form.department_id || form.create_new_department) { setPositions([]); return; }
    let cancelled = false;
    fetchPositionsByDepartment(form.department_id).then((pos) => { if (!cancelled) setPositions(pos); });
    return () => { cancelled = true; };
  }, [form.department_id, form.create_new_department]);

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
      if (!window.confirm("You have unsaved changes. Leave this page?")) return;
    }
    router.push("/employees");
  };

  const handleSubmit = useCallback(async () => {
    setAttemptedSubmit(true);
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) {
      const count = Object.keys(errs).length;
      setError(`Please fix ${count} field${count === 1 ? "" : "s"} before saving.`);
      /* Scroll to the first invalid field so the user doesn't have
         to hunt for red borders on a long form. */
      if (typeof window !== "undefined") {
        const first = document.querySelector('[aria-invalid="true"]');
        (first as HTMLElement | null)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    setSaving(true); setError(null);
    const result = await createFullEmployee(form);
    if (!result.success) {
      setError(result.error || "Failed to create employee.");
      setSaving(false);
      return;
    }
    setIsDirty(false);
    setSaved({
      id: result.employeeId!,
      name: `${form.first_name} ${form.last_name}`.trim(),
      partial: result.error,
    });
    setSaving(false);
  }, [form]);

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
            <h2 id="saved-title" className="text-base font-semibold text-[var(--text-primary)]">Employee Created</h2>
            <p className="text-xs text-[var(--text-dim)]">{saved.name || "New employee"} was added.</p>
          </div>
        </div>
        {saved.partial && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[12px] text-amber-400">
            {saved.partial}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Link
            href={`/employees/${saved.id}`}
            className="h-10 px-3 rounded-xl text-sm font-medium bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 flex items-center justify-center transition-opacity"
          >
            View profile
          </Link>
          <button
            onClick={resetForm}
            className="h-10 px-3 rounded-xl text-sm font-medium border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
          >
            Add another
          </button>
          <Link
            href="/employees"
            className="h-10 px-3 rounded-xl text-sm font-medium border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
          >
            Back to list
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
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
              aria-label="Back to employees"
            >
              <ArrowLeftIcon size={16} />
            </button>
            <EmployeesIcon size={18} className="text-[var(--text-dim)] shrink-0 hidden sm:block" />
            <h1 className="text-lg font-semibold text-[var(--text-primary)] truncate">Add Employee</h1>
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 h-10 px-4 sm:px-5 rounded-xl text-sm font-medium bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            aria-label="Save employee"
          >
            {saving ? <SpinnerIcon size={16} className="animate-spin" /> : <CheckIcon size={16} />}
            <span className="hidden xs:inline sm:inline">{saving ? "Saving..." : "Save Employee"}</span>
          </button>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400" role="alert">{error}</div>
        )}

        {/* ═══════════════════════════════════════════
           FORM SECTIONS
           ═══════════════════════════════════════════ */}
        <div className="space-y-4">

          {/* ── 1. PERSONAL PROFILE ── */}
          <section className={panelCls}>
            <SectionHeader
              icon={UserIcon}
              title="Personal Profile"
              description="Name, photo, and basic details about the person."
            />

            {/* Photo + Name */}
            <div className="flex gap-4 mb-4">
              <label className="block cursor-pointer group shrink-0" aria-label="Upload employee photo">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label="Photo file"
                  onChange={(e) => handlePhotoSelect(e.target.files?.[0])}
                />
                <div className="relative h-24 w-24 rounded-2xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-primary)] flex items-center justify-center overflow-hidden group-hover:border-[var(--border-focus)] transition-colors">
                  {photoUploading ? (
                    <SpinnerIcon size={20} className="animate-spin text-[var(--text-dim)]" />
                  ) : form.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <CameraIcon size={20} className="mx-auto text-[var(--text-faint)] group-hover:text-[var(--text-dim)] transition-colors" />
                      <span className="block text-[9px] text-[var(--text-faint)] mt-0.5">Photo</span>
                    </div>
                  )}
                </div>
              </label>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 content-start">
                <SelectInput label="Title" value={form.title} onChange={(v) => set("title", v)}
                  options={TITLE_OPTIONS.map((t) => ({ value: t, label: t || "—" }))} placeholder="—" />
                <TextInput label="First Name" value={form.first_name} onChange={(v) => set("first_name", v)} placeholder="First name" required error={errFor("first_name")} />
                <TextInput label="Middle Name" value={form.middle_name} onChange={(v) => set("middle_name", v)} placeholder="Middle name" />
                <TextInput label="Last Name" value={form.last_name} onChange={(v) => set("last_name", v)} placeholder="Last name" required error={errFor("last_name")} />
              </div>
            </div>

            {photoError && (
              <p className="text-[11px] text-red-400 mb-3" role="alert">{photoError}</p>
            )}
            {form.photo_url && !photoUploading && (
              <button type="button" onClick={() => set("photo_url", null)}
                className="text-[10px] text-red-400 hover:text-red-300 mb-3 transition-colors">Remove photo</button>
            )}

            {/* Alternate name */}
            <div className="mb-4 p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-faint)]">
              <div className="flex items-center gap-2 mb-2.5">
                <LanguagesIcon size={12} className="text-[var(--text-faint)]" />
                <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-widest">Alternate Name</span>
                <span className="text-[10px] text-[var(--text-faint)]">e.g. Chinese official name</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="First Name (Alt)" value={form.first_name_alt} onChange={(v) => set("first_name_alt", v)} placeholder="e.g. 明" />
                <TextInput label="Last Name (Alt)" value={form.last_name_alt} onChange={(v) => set("last_name_alt", v)} placeholder="e.g. 李" />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              <SelectInput label="Gender" value={form.gender} onChange={(v) => set("gender", v)}
                options={GENDER_OPTIONS.map((g) => ({ value: g, label: g || "—" }))} placeholder="Select..." />
              <DateInput label="Date of Birth" value={form.birthday} onChange={(v) => set("birthday", v)} yearFrom={1940} yearTo={2010} error={errFor("birthday")} />
              <Combobox
                label="Nationality"
                value={form.nationality}
                onChange={(v) => set("nationality", v)}
                options={countryOptions}
                placeholder="Select country..."
                searchPlaceholder="Search 249 countries..."
              />
              <SelectInput label="Marital Status" value={form.marital_status} onChange={(v) => set("marital_status", v)}
                options={MARITAL_OPTIONS.map((m) => ({ value: m, label: m || "—" }))} placeholder="Select..." />
              <TextInput label="Children" value={form.number_of_children} onChange={(v) => set("number_of_children", v)} type="number" placeholder="0" min={0} max={30} inputMode="numeric" error={errFor("number_of_children")} />
              <SelectInput label="Blood Type" value={form.blood_type} onChange={(v) => set("blood_type", v)}
                options={BLOOD_TYPE_OPTIONS.map((b) => ({ value: b, label: b || "—" }))} placeholder="—" />
              <TextInput label="Religion" value={form.religion} onChange={(v) => set("religion", v)} placeholder="e.g. Islam" />
              <TextInput label="Languages" value={form.languages} onChange={(v) => set("languages", v)} placeholder="e.g. Arabic, English" />
            </div>
          </section>

          {/* ── 2. CONTACT & ADDRESS ── */}
          <section className={panelCls}>
            <SectionHeader
              icon={PhoneIcon}
              title="Contact & Address"
              description="How to reach this person — phone, email, and home address."
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <TextInput label="Personal Phone" value={form.personal_phone} onChange={(v) => set("personal_phone", v)} placeholder="+1 234 567 890" type="tel" inputMode="tel" />
              <TextInput label="Personal Email" value={form.personal_email} onChange={(v) => set("personal_email", v)} placeholder="personal@email.com" type="email" inputMode="email" error={errFor("personal_email")} />
              <TextInput label="Work Phone" value={form.work_phone} onChange={(v) => set("work_phone", v)} placeholder="+1 234 567 890" type="tel" inputMode="tel" />
              <TextInput label="Work Email" value={form.work_email} onChange={(v) => set("work_email", v)} placeholder="name@company.com" type="email" inputMode="email" error={errFor("work_email")} />
            </div>

            <SubLabel>Home Address</SubLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
              <TextInput label="Address Line 1" value={form.private_address_line1} onChange={(v) => set("private_address_line1", v)} placeholder="Street address" />
              <TextInput label="Address Line 2" value={form.private_address_line2} onChange={(v) => set("private_address_line2", v)} placeholder="Apt, suite, unit" />
              <TextInput label="City" value={form.private_city} onChange={(v) => set("private_city", v)} placeholder="City" />
              <TextInput label="State / Province" value={form.private_state} onChange={(v) => set("private_state", v)} placeholder="State" />
              <Combobox
                label="Country"
                value={form.private_country}
                onChange={(v) => set("private_country", v)}
                options={countryOptions}
                placeholder="Select country..."
                searchPlaceholder="Search 249 countries..."
              />
              <TextInput label="Postal Code" value={form.private_postal_code} onChange={(v) => set("private_postal_code", v)} placeholder="ZIP" />
            </div>
          </section>

          {/* ── 3. EMERGENCY CONTACTS ── */}
          <section className={panelCls}>
            <SectionHeader
              icon={ShieldIcon}
              title="Emergency Contacts"
              description="People to contact if something happens on the job."
            />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <SubLabel>Primary Contact</SubLabel>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <TextInput label="Name" value={form.emergency_contact_name} onChange={(v) => set("emergency_contact_name", v)} placeholder="Full name" />
                  <TextInput label="Phone" value={form.emergency_contact_phone} onChange={(v) => set("emergency_contact_phone", v)} placeholder="+1 234 567 890" type="tel" inputMode="tel" />
                  <SelectInput label="Relationship" value={form.emergency_contact_relationship} onChange={(v) => set("emergency_contact_relationship", v)}
                    options={RELATIONSHIP_OPTIONS.map((r) => ({ value: r, label: r || "—" }))} placeholder="Select..." />
                </div>
              </div>
              <div>
                <SubLabel>Secondary Contact</SubLabel>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <TextInput label="Name" value={form.emergency_contact2_name} onChange={(v) => set("emergency_contact2_name", v)} placeholder="Full name" />
                  <TextInput label="Phone" value={form.emergency_contact2_phone} onChange={(v) => set("emergency_contact2_phone", v)} placeholder="+1 234 567 890" type="tel" inputMode="tel" />
                  <SelectInput label="Relationship" value={form.emergency_contact2_relationship} onChange={(v) => set("emergency_contact2_relationship", v)}
                    options={RELATIONSHIP_OPTIONS.map((r) => ({ value: r, label: r || "—" }))} placeholder="Select..." />
                </div>
              </div>
            </div>
          </section>

          {/* ── 4. EMPLOYMENT & ORGANIZATION ── */}
          <section className={panelCls}>
            <SectionHeader
              icon={BriefcaseIcon}
              title="Employment & Organization"
              description="Hire date, role, department, and reporting line."
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
              <TextInput label="Employee Number" value={form.employee_number} onChange={(v) => set("employee_number", v)} placeholder="EMP-001" disabled />
              <SelectInput label="Employment Type" value={form.employment_type} onChange={(v) => set("employment_type", v)} options={EMPLOYMENT_TYPE_OPTIONS} />
              <DateInput label="Hire Date" value={form.hire_date} onChange={(v) => set("hire_date", v)} yearFrom={2000} yearTo={2030} required error={errFor("hire_date")} />
              <SelectInput label="Work Location" value={form.work_location} onChange={(v) => set("work_location", v)} options={WORK_LOCATION_OPTIONS} />
              <Combobox
                label="Manager / Supervisor"
                value={form.manager_id}
                onChange={(v) => set("manager_id", v)}
                options={managerOptions}
                placeholder={managerOptions.length ? "Select..." : "No active employees yet"}
                searchPlaceholder="Search employees..."
                emptyText="No employees match"
              />
              <DateInput label="Contract End" value={form.contract_end_date} onChange={(v) => set("contract_end_date", v)} yearFrom={2024} yearTo={2035} error={errFor("contract_end_date")} />
              <DateInput label="Probation End" value={form.probation_end_date} onChange={(v) => set("probation_end_date", v)} yearFrom={2024} yearTo={2030} error={errFor("probation_end_date")} />
            </div>

            {/* Department & Position */}
            <div className="border-t border-[var(--border-faint)] pt-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Building2Icon size={14} className="text-[var(--text-dim)]" />
                  <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-widest">Department & Position</span>
                </div>
                <Link
                  href="/management"
                  className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors underline-offset-2 hover:underline"
                >
                  Manage in Management app →
                </Link>
              </div>

              {loadingDeps ? (
                <div className="flex items-center gap-2 text-xs text-[var(--text-faint)] py-3">
                  <SpinnerIcon size={14} className="animate-spin" /> Loading...
                </div>
              ) : departments.length === 0 && !form.create_new_department ? (
                <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-dashed border-[var(--border-subtle)] text-center">
                  <Building2Icon size={20} className="mx-auto text-[var(--text-faint)] mb-2" />
                  <p className="text-[13px] text-[var(--text-primary)] font-medium mb-1">No departments yet</p>
                  <p className="text-[11px] text-[var(--text-dim)] mb-3">
                    Create your first department in the Management app, or add one inline now.
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
                          label="Department"
                          value={form.department_id}
                          onChange={(v) => { set("department_id", v); set("position_id", ""); }}
                          options={departments.map((d) => ({ value: d.id, label: d.name }))}
                          placeholder="Select..."
                          required
                          error={errFor("department_id")}
                        />
                      ) : (
                        <TextInput label="New Department" value={form.department_name} onChange={(v) => set("department_name", v)} placeholder="e.g. Engineering" required error={errFor("department_name")} />
                      )}
                    </div>
                    <button type="button" onClick={() => {
                      const next = !form.create_new_department;
                      set("create_new_department", next);
                      if (next) { set("department_id", ""); set("position_id", ""); }
                    }}
                      className="flex items-center gap-1 h-10 px-3 rounded-xl text-[11px] font-medium border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                      <PlusIcon size={12} />{form.create_new_department ? "Existing" : "New"}
                    </button>
                  </div>
                  {/* Position */}
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      {!form.create_new_position ? (
                        <SelectInput
                          label="Position"
                          value={form.position_id}
                          onChange={(v) => set("position_id", v)}
                          options={positions.map((p) => ({ value: p.id, label: p.title }))}
                          placeholder={
                            !form.department_id && !form.create_new_department
                              ? "Select dept first..."
                              : positions.length === 0
                              ? "No positions — use New"
                              : "Select..."
                          }
                          required
                          error={errFor("position_id")}
                        />
                      ) : (
                        <TextInput label="New Position" value={form.position_title} onChange={(v) => set("position_title", v)} placeholder="e.g. Software Engineer" required error={errFor("position_title")} />
                      )}
                    </div>
                    <button type="button" onClick={() => {
                      const next = !form.create_new_position;
                      set("create_new_position", next);
                      if (next) set("position_id", "");
                    }}
                      className="flex items-center gap-1 h-10 px-3 rounded-xl text-[11px] font-medium border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                      <PlusIcon size={12} />{form.create_new_position ? "Existing" : "New"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── 5. COMPENSATION & BENEFITS ── */}
          <section className={panelCls}>
            <SectionHeader
              icon={CreditCardIcon}
              title="Compensation & Benefits"
              description="Salary, bank account, and insurance details."
            />

            <SubLabel>Salary</SubLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 mb-4 max-w-md">
              <TextInput label="Initial Salary" value={form.initial_salary} onChange={(v) => set("initial_salary", v)} placeholder="e.g. 5000" type="number" min={0} inputMode="decimal" error={errFor("initial_salary")} />
              <SelectInput label="Currency" value={form.salary_currency} onChange={(v) => set("salary_currency", v)} options={CURRENCY_OPTIONS} />
            </div>

            <SubLabel>Bank Account</SubLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3 mb-4">
              <TextInput label="Bank Name" value={form.bank_name} onChange={(v) => set("bank_name", v)} placeholder="e.g. HSBC" />
              <TextInput label="Account Holder" value={form.bank_account_holder} onChange={(v) => set("bank_account_holder", v)} placeholder="Name on account" />
              <TextInput label="Account Number" value={form.bank_account_number} onChange={(v) => set("bank_account_number", v)} placeholder="Account #" />
              <TextInput label="IBAN" value={form.bank_iban} onChange={(v) => set("bank_iban", v)} placeholder="IBAN" />
              <TextInput label="SWIFT / BIC" value={form.bank_swift} onChange={(v) => set("bank_swift", v)} placeholder="SWIFT code" />
              <SelectInput label="Currency" value={form.bank_currency} onChange={(v) => set("bank_currency", v)} options={BANK_CURRENCY_OPTIONS} />
            </div>

            <SubLabel>Insurance</SubLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
              <TextInput label="Provider" value={form.insurance_provider} onChange={(v) => set("insurance_provider", v)} placeholder="e.g. Bupa" />
              <TextInput label="Policy Number" value={form.insurance_policy_number} onChange={(v) => set("insurance_policy_number", v)} placeholder="Policy #" />
              <SelectInput label="Class" value={form.insurance_class} onChange={(v) => set("insurance_class", v)} options={INSURANCE_CLASS_OPTIONS} />
              <DateInput label="Expiry" value={form.insurance_expiry_date} onChange={(v) => set("insurance_expiry_date", v)} yearFrom={2024} yearTo={2035} error={errFor("insurance_expiry_date")} />
            </div>
          </section>

          {/* ── 6. DOCUMENTS & COMPLIANCE ── */}
          <section className={panelCls}>
            <SectionHeader
              icon={DocumentIcon}
              title="Documents & Compliance"
              description="IDs, visa, education, and driving license."
            />

            <SubLabel>Identification</SubLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3 mb-4">
              <TextInput label="National ID" value={form.identification_id} onChange={(v) => set("identification_id", v)} placeholder="ID number" />
              <TextInput label="Passport Number" value={form.passport_number} onChange={(v) => set("passport_number", v)} placeholder="Passport #" />
              <TextInput label="Social Security #" value={form.social_security_number} onChange={(v) => set("social_security_number", v)} placeholder="SSN" />
              <TextInput label="Tax ID" value={form.tax_id} onChange={(v) => set("tax_id", v)} placeholder="Tax ID" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-3 mb-4">
              <div>
                <SubLabel>Visa</SubLabel>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <TextInput label="Visa Number" value={form.visa_number} onChange={(v) => set("visa_number", v)} placeholder="Visa #" />
                  <DateInput label="Visa Expiry" value={form.visa_expiry_date} onChange={(v) => set("visa_expiry_date", v)} yearFrom={2024} yearTo={2035} error={errFor("visa_expiry_date")} />
                </div>
              </div>
              <div>
                <SubLabel>Education</SubLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <SelectInput label="Degree" value={form.education_degree} onChange={(v) => set("education_degree", v)} options={DEGREE_OPTIONS} />
                  <TextInput label="Institution" value={form.education_institution} onChange={(v) => set("education_institution", v)} placeholder="University name" />
                  <TextInput label="Field of Study" value={form.education_field} onChange={(v) => set("education_field", v)} placeholder="e.g. Computer Science" />
                  <TextInput label="Graduation Year" value={form.education_graduation_year} onChange={(v) => set("education_graduation_year", v)} placeholder="e.g. 2020" type="number" min={1940} max={new Date().getFullYear() + 10} inputMode="numeric" error={errFor("education_graduation_year")} />
                </div>
              </div>
            </div>

            <SubLabel>Driving License</SubLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
              <TextInput label="License Number" value={form.driving_license_number} onChange={(v) => set("driving_license_number", v)} placeholder="License #" />
              <SelectInput label="Type" value={form.driving_license_type} onChange={(v) => set("driving_license_type", v)} options={DRIVING_LICENSE_TYPE_OPTIONS} />
              <DateInput label="Expiry" value={form.driving_license_expiry} onChange={(v) => set("driving_license_expiry", v)} yearFrom={2024} yearTo={2040} error={errFor("driving_license_expiry")} />
            </div>
          </section>

          {/* ── 7. ACCOUNT SETUP ── */}
          <section className={panelCls}>
            <SectionHeader
              icon={KeyIcon}
              title="Account Setup"
              description="Optional. Create login credentials so this employee can sign in to Koleex Hub."
            />

            <div className="flex items-center gap-3 mb-3">
              <button
                type="button"
                onClick={() => set("create_account", !form.create_account)}
                role="switch"
                aria-checked={form.create_account}
                aria-label="Create login account"
                className={`relative w-11 h-6 rounded-full transition-colors ${form.create_account ? "bg-emerald-500" : "bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.create_account ? "translate-x-5" : "translate-x-0"}`} />
              </button>
              <span className="text-sm text-[var(--text-dim)]">Create login account for this employee</span>
            </div>

            {!form.create_account && (
              <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
                <ShieldIcon size={14} className="text-amber-400 mt-0.5 shrink-0" />
                <div className="text-[12px] text-amber-300">
                  Without an account this employee can&apos;t be picked as a project manager, task
                  assignee, CRM owner, or planning resource. HR records still work, but nothing
                  else will link to them. You can add an account later from the profile.
                </div>
              </div>
            )}

            {form.create_account && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <TextInput
                  label="Username"
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
                  label="Login Email"
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
                    <FieldLabel label="Temporary Password" />
                    <button
                      type="button"
                      onClick={() => set("temp_password", generateTemporaryPassword())}
                      className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text-primary)] -mt-1 transition-colors"
                    >
                      Regenerate
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
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-dim)] transition-colors"
                    >
                      {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                    </button>
                  </div>
                </div>
                <SelectInput
                  label="Role"
                  value={form.role_id}
                  onChange={(v) => set("role_id", v)}
                  options={roles.map((r) => ({ value: r.id, label: r.name }))}
                  placeholder="Select role..."
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
