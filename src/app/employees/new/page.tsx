"use client";

/* ---------------------------------------------------------------------------
   Add Employee — Professional HR form with organized two-column layout.
   Groups related fields into logical panels for a clean, scannable layout.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { fetchRoles } from "@/lib/accounts-admin";
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

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function daysInMonth(month: number, year: number) {
  if (!month || !year) return 31;
  return new Date(year, month, 0).getDate();
}

/* ═══════════════════════════════════════════════════
   REUSABLE INPUT COMPONENTS
   ═══════════════════════════════════════════════════ */

/* Phase 17: bumped inputs from h-9 → h-10 to match the employee
   wizard + the rest of the hub's form patterns. Also gives mobile
   touch targets a 4 px larger hit area, which matters on the dense
   multi-column grids below. */
const inputCls =
  "w-full h-10 px-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--border-focus)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const selectCls =
  "w-full h-10 px-3 pr-9 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] appearance-none focus:outline-none focus:border-[var(--border-focus)] transition-colors";

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="block text-[11px] font-medium text-[var(--text-dim)] mb-1">
      {label}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function TextInput({
  label, value, onChange, placeholder, type = "text", required, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; disabled?: boolean;
}) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled} className={inputCls} />
    </div>
  );
}

function SelectInput({
  label, value, onChange, options, placeholder, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <AngleDownIcon size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
      </div>
    </div>
  );
}

function DateInput({
  label, value, onChange, required, yearFrom = 1950, yearTo = 2040,
}: {
  label: string; value: string; onChange: (v: string) => void;
  required?: boolean; yearFrom?: number; yearTo?: number;
}) {
  const parts = value ? value.split("-") : [];
  const yr = parts[0] || "", mo = parts[1] || "", dy = parts[2] || "";
  const maxDay = daysInMonth(Number(mo), Number(yr));

  const rebuild = (y: string, m: string, d: string) => {
    if (!y && !m && !d) return onChange("");
    const yy = y.padStart(4, "0"), mm = m.padStart(2, "0"), dd = d.padStart(2, "0");
    if (y && m && d) onChange(`${yy}-${mm}-${dd}`);
    else if (y && m) onChange(`${yy}-${mm}-01`);
    else onChange("");
  };

  /* Phase 17: matches the h-10 inputs above. */
  const sCls =
    "h-10 px-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] appearance-none focus:outline-none focus:border-[var(--border-focus)] transition-colors w-full pr-6";

  return (
    <div>
      <FieldLabel label={label} required={required} />
      <div className="flex gap-1.5">
        <div className="relative flex-[1]">
          <select value={dy} onChange={(e) => rebuild(yr, mo, e.target.value)} className={sCls}>
            <option value="">Day</option>
            {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
              <option key={d} value={String(d).padStart(2, "0")}>{d}</option>
            ))}
          </select>
          <AngleDownIcon size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
        </div>
        <div className="relative flex-[1.3]">
          <select value={mo} onChange={(e) => {
            const newMo = e.target.value;
            const nd = daysInMonth(Number(newMo), Number(yr));
            rebuild(yr, newMo, Number(dy) > nd ? String(nd).padStart(2, "0") : dy);
          }} className={sCls}>
            <option value="">Month</option>
            {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
          </select>
          <AngleDownIcon size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
        </div>
        <div className="relative flex-[1.1]">
          <select value={yr} onChange={(e) => {
            const newYr = e.target.value;
            const nd = daysInMonth(Number(mo), Number(newYr));
            rebuild(newYr, mo, Number(dy) > nd ? String(nd).padStart(2, "0") : dy);
          }} className={sCls}>
            <option value="">Year</option>
            {Array.from({ length: yearTo - yearFrom + 1 }, (_, i) => yearTo - i).map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
          <AngleDownIcon size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
        </div>
      </div>
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
  /* Phase 18: more prominent section headers. Bigger title, an
     optional description line so each section explains itself at a
     glance, icon inside a rounded tile so the visual hierarchy
     reads as "icon → title → fields below" instead of a thin
     uppercase label that got lost in the panel. */
  return (
    <div className="flex items-start gap-3 mb-5 pb-4 border-b border-[var(--border-faint)]">
      <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
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

/** Divider label inside a panel */
function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="col-span-full text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-widest mt-2 -mb-1">
      {children}
    </p>
  );
}

/* ═══════════════════════════════════════════════════
   IMAGE COMPRESSION
   ═══════════════════════════════════════════════════ */

async function compressImage(file: File, maxWidth = 400, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/* ═══════════════════════════════════════════════════
   PANEL WRAPPER
   ═══════════════════════════════════════════════════ */

/* Phase 18: bumped panel padding so the many fields inside each
   section aren't packed edge-to-edge. Matches the wizard modal
   (p-5 md:p-6) for a consistent form feel across entry points. */
const panelCls =
  "bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6";

/* ═══════════════════════════════════════════════════
   PAGE COMPONENT
   ═══════════════════════════════════════════════════ */

export default function AddEmployeePage() {
  const router = useRouter();
  const [form, setForm] = useState<EmployeeWizardData>(emptyWizardData());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [loadingDeps, setLoadingDeps] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const countryOptions = useMemo(
    () => COUNTRIES.map((c) => ({ value: c.code, label: `${c.flag} ${c.name}` })),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [deps, empNum, rolesData, empList] = await Promise.all([
        fetchDepartments(), generateEmployeeNumber(), fetchRoles(), fetchEmployeeList(),
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

  const set = useCallback(
    <K extends keyof EmployeeWizardData>(key: K, value: EmployeeWizardData[K]) => {
      setForm((f) => ({ ...f, [key]: value })); setError(null);
    }, [],
  );

  const validate = useCallback(() => {
    if (!form.first_name.trim()) return "First name is required.";
    if (!form.last_name.trim()) return "Last name is required.";
    if (!form.department_id && !form.create_new_department) return "Department is required.";
    if (form.create_new_department && !form.department_name.trim()) return "Department name is required.";
    if (!form.position_id && !form.create_new_position) return "Position is required.";
    if (form.create_new_position && !form.position_title.trim()) return "Position title is required.";
    if (form.create_account && !form.login_email.trim() && !form.work_email.trim() && !form.personal_email.trim())
      return "Login email is required when creating an account.";
    return null;
  }, [form]);

  const handleSubmit = useCallback(async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true); setError(null);
    const result = await createFullEmployee(form);
    if (result.success) { setSuccess(true); setTimeout(() => router.push("/employees"), 1200); }
    else { setError(result.error || "Failed to create employee."); setSaving(false); }
  }, [form, validate, router]);

  /* ── Success ── */
  if (success) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-emerald-500/10 mx-auto mb-4">
            <CheckIcon size={32} className="text-emerald-400" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Employee Created</h2>
          <p className="text-sm text-[var(--text-dim)]">Redirecting to employees list...</p>
        </div>
      </div>
    );
  }

  /* ── Main render ── */
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Phase 18.1: let the form fill the viewport width instead of
          sitting in a narrow column. Horizontal padding scales with
          the breakpoint so content still has comfortable side gutters
          on ultra-wide monitors; the grid-column caps below (max 4
          columns per row) keep individual inputs from stretching out
          even when the page is 1800 px+ wide. */}
      <div className="mx-auto px-4 md:px-6 lg:px-10 xl:px-16 py-6 md:py-8">

        {/* ── Header ──
            Phase 17: removed the duplicate Save button from the
            header. Primary Save sits at the bottom bar next to
            Cancel — one clear action location instead of two
            identical buttons. */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/employees"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
              <ArrowLeftIcon size={16} />
            </Link>
            <EmployeesIcon size={18} className="text-[var(--text-dim)] shrink-0" />
            <h1 className="text-lg font-semibold text-[var(--text-primary)] truncate">Add Employee</h1>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">{error}</div>
        )}

        {/* ═══════════════════════════════════════════
           FORM SECTIONS — 2-col desktop grid
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
                <label className="block cursor-pointer group shrink-0">
                  <input type="file" accept="image/*" className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try { set("photo_url", await compressImage(file)); } catch { /* */ }
                    }} />
                  <div className="relative h-24 w-24 rounded-2xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-primary)] flex items-center justify-center overflow-hidden group-hover:border-[var(--border-focus)] transition-colors">
                    {form.photo_url ? (
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
                  <TextInput label="First Name" value={form.first_name} onChange={(v) => set("first_name", v)} placeholder="First name" required />
                  <TextInput label="Middle Name" value={form.middle_name} onChange={(v) => set("middle_name", v)} placeholder="Middle name" />
                  <TextInput label="Last Name" value={form.last_name} onChange={(v) => set("last_name", v)} placeholder="Last name" required />
                </div>
              </div>

              {form.photo_url && (
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

              {/* Personal details — 8 fields, capped at 4 columns
                  (was xl:grid-cols-8 which squeezed each to ~135 px). */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                <SelectInput label="Gender" value={form.gender} onChange={(v) => set("gender", v)}
                  options={GENDER_OPTIONS.map((g) => ({ value: g, label: g || "—" }))} placeholder="Select..." />
                <DateInput label="Date of Birth" value={form.birthday} onChange={(v) => set("birthday", v)} yearFrom={1940} yearTo={2010} />
                <SelectInput label="Nationality" value={form.nationality} onChange={(v) => set("nationality", v)} options={countryOptions} placeholder="Select..." />
                <SelectInput label="Marital Status" value={form.marital_status} onChange={(v) => set("marital_status", v)}
                  options={MARITAL_OPTIONS.map((m) => ({ value: m, label: m || "—" }))} placeholder="Select..." />
                <TextInput label="Children" value={form.number_of_children} onChange={(v) => set("number_of_children", v)} type="number" placeholder="0" />
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
                <TextInput label="Personal Phone" value={form.personal_phone} onChange={(v) => set("personal_phone", v)} placeholder="+1 234 567 890" type="tel" />
                <TextInput label="Personal Email" value={form.personal_email} onChange={(v) => set("personal_email", v)} placeholder="personal@email.com" type="email" />
                <TextInput label="Work Phone" value={form.work_phone} onChange={(v) => set("work_phone", v)} placeholder="+1 234 567 890" type="tel" />
                <TextInput label="Work Email" value={form.work_email} onChange={(v) => set("work_email", v)} placeholder="name@company.com" type="email" />
              </div>

              {/* Address — 6 fields, capped at 3 columns. Line 1 spans
                  2 since addresses usually want the room. */}
              <SubLabel>Home Address</SubLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                <TextInput label="Address Line 1" value={form.private_address_line1} onChange={(v) => set("private_address_line1", v)} placeholder="Street address" />
                <TextInput label="Address Line 2" value={form.private_address_line2} onChange={(v) => set("private_address_line2", v)} placeholder="Apt, suite, unit" />
                <TextInput label="City" value={form.private_city} onChange={(v) => set("private_city", v)} placeholder="City" />
                <TextInput label="State / Province" value={form.private_state} onChange={(v) => set("private_state", v)} placeholder="State" />
                <SelectInput label="Country" value={form.private_country} onChange={(v) => set("private_country", v)} options={countryOptions} placeholder="Select..." />
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
                    <TextInput label="Phone" value={form.emergency_contact_phone} onChange={(v) => set("emergency_contact_phone", v)} placeholder="+1 234 567 890" type="tel" />
                    <SelectInput label="Relationship" value={form.emergency_contact_relationship} onChange={(v) => set("emergency_contact_relationship", v)}
                      options={RELATIONSHIP_OPTIONS.map((r) => ({ value: r, label: r || "—" }))} placeholder="Select..." />
                  </div>
                </div>
                <div>
                  <SubLabel>Secondary Contact</SubLabel>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <TextInput label="Name" value={form.emergency_contact2_name} onChange={(v) => set("emergency_contact2_name", v)} placeholder="Full name" />
                    <TextInput label="Phone" value={form.emergency_contact2_phone} onChange={(v) => set("emergency_contact2_phone", v)} placeholder="+1 234 567 890" type="tel" />
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
                <DateInput label="Hire Date" value={form.hire_date} onChange={(v) => set("hire_date", v)} yearFrom={2000} yearTo={2030} required />
                <SelectInput label="Work Location" value={form.work_location} onChange={(v) => set("work_location", v)} options={WORK_LOCATION_OPTIONS} />
                <SelectInput label="Manager / Supervisor" value={form.manager_id} onChange={(v) => set("manager_id", v)}
                  options={employees.map((e) => ({ value: e.id, label: e.person.full_name }))} placeholder="Select..." />
                <DateInput label="Contract End" value={form.contract_end_date} onChange={(v) => set("contract_end_date", v)} yearFrom={2024} yearTo={2035} />
                <DateInput label="Probation End" value={form.probation_end_date} onChange={(v) => set("probation_end_date", v)} yearFrom={2024} yearTo={2030} />
              </div>

              {/* Department & Position */}
              <div className="border-t border-[var(--border-faint)] pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2Icon size={14} className="text-[var(--text-dim)]" />
                  <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-widest">Department & Position</span>
                </div>

                {loadingDeps ? (
                  <div className="flex items-center gap-2 text-xs text-[var(--text-faint)] py-3">
                    <SpinnerIcon size={14} className="animate-spin" /> Loading...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {/* Department */}
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        {!form.create_new_department ? (
                          <SelectInput label="Department" value={form.department_id}
                            onChange={(v) => { set("department_id", v); set("position_id", ""); }}
                            options={departments.map((d) => ({ value: d.id, label: d.name }))} placeholder="Select..." required />
                        ) : (
                          <TextInput label="New Department" value={form.department_name} onChange={(v) => set("department_name", v)} placeholder="e.g. Engineering" required />
                        )}
                      </div>
                      <button type="button" onClick={() => { set("create_new_department", !form.create_new_department); if (!form.create_new_department) { set("department_id", ""); set("position_id", ""); } }}
                        className="flex items-center gap-1 h-10 px-3 rounded-xl text-[11px] font-medium border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                        <PlusIcon size={12} />{form.create_new_department ? "Existing" : "New"}
                      </button>
                    </div>
                    {/* Position */}
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        {!form.create_new_position ? (
                          <SelectInput label="Position" value={form.position_id} onChange={(v) => set("position_id", v)}
                            options={positions.map((p) => ({ value: p.id, label: p.title }))}
                            placeholder={!form.department_id && !form.create_new_department ? "Select dept first..." : positions.length === 0 ? "No positions — create" : "Select..."} required />
                        ) : (
                          <TextInput label="New Position" value={form.position_title} onChange={(v) => set("position_title", v)} placeholder="e.g. Software Engineer" required />
                        )}
                      </div>
                      <button type="button" onClick={() => { set("create_new_position", !form.create_new_position); if (!form.create_new_position) set("position_id", ""); }}
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

              {/* Salary — only 2 fields, don't stretch them across
                  the whole panel. Cap at 2 cols on md+. */}
              <SubLabel>Salary</SubLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 mb-4 max-w-md">
                <TextInput label="Initial Salary" value={form.initial_salary} onChange={(v) => set("initial_salary", v)} placeholder="e.g. 5000" type="number" />
                <SelectInput label="Currency" value={form.salary_currency} onChange={(v) => set("salary_currency", v)} options={CURRENCY_OPTIONS} />
              </div>

              {/* Bank — 6 fields, capped at 3 cols. */}
              <SubLabel>Bank Account</SubLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3 mb-4">
                <TextInput label="Bank Name" value={form.bank_name} onChange={(v) => set("bank_name", v)} placeholder="e.g. HSBC" />
                <TextInput label="Account Holder" value={form.bank_account_holder} onChange={(v) => set("bank_account_holder", v)} placeholder="Name on account" />
                <TextInput label="Account Number" value={form.bank_account_number} onChange={(v) => set("bank_account_number", v)} placeholder="Account #" />
                <TextInput label="IBAN" value={form.bank_iban} onChange={(v) => set("bank_iban", v)} placeholder="IBAN" />
                <TextInput label="SWIFT / BIC" value={form.bank_swift} onChange={(v) => set("bank_swift", v)} placeholder="SWIFT code" />
                <TextInput label="Currency" value={form.bank_currency} onChange={(v) => set("bank_currency", v)} placeholder="e.g. USD" />
              </div>

              {/* Insurance — 4 fields. */}
              <SubLabel>Insurance</SubLabel>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
                <TextInput label="Provider" value={form.insurance_provider} onChange={(v) => set("insurance_provider", v)} placeholder="e.g. Bupa" />
                <TextInput label="Policy Number" value={form.insurance_policy_number} onChange={(v) => set("insurance_policy_number", v)} placeholder="Policy #" />
                <SelectInput label="Class" value={form.insurance_class} onChange={(v) => set("insurance_class", v)} options={INSURANCE_CLASS_OPTIONS} />
                <DateInput label="Expiry" value={form.insurance_expiry_date} onChange={(v) => set("insurance_expiry_date", v)} yearFrom={2024} yearTo={2035} />
              </div>
            </section>

            {/* ── 6. DOCUMENTS & COMPLIANCE ── */}
            <section className={panelCls}>
              <SectionHeader
                icon={DocumentIcon}
                title="Documents & Compliance"
                description="IDs, visa, education, and driving license."
              />

              {/* Identification — 4 fields. */}
              <SubLabel>Identification</SubLabel>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3 mb-4">
                <TextInput label="National ID" value={form.identification_id} onChange={(v) => set("identification_id", v)} placeholder="ID number" />
                <TextInput label="Passport Number" value={form.passport_number} onChange={(v) => set("passport_number", v)} placeholder="Passport #" />
                <TextInput label="Social Security #" value={form.social_security_number} onChange={(v) => set("social_security_number", v)} placeholder="SSN" />
                <TextInput label="Tax ID" value={form.tax_id} onChange={(v) => set("tax_id", v)} placeholder="Tax ID" />
              </div>

              {/* Visa + Education side by side */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-3 mb-4">
                <div>
                  <SubLabel>Visa</SubLabel>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <TextInput label="Visa Number" value={form.visa_number} onChange={(v) => set("visa_number", v)} placeholder="Visa #" />
                    <DateInput label="Visa Expiry" value={form.visa_expiry_date} onChange={(v) => set("visa_expiry_date", v)} yearFrom={2024} yearTo={2035} />
                  </div>
                </div>
                <div>
                  <SubLabel>Education</SubLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <SelectInput label="Degree" value={form.education_degree} onChange={(v) => set("education_degree", v)} options={DEGREE_OPTIONS} />
                    <TextInput label="Institution" value={form.education_institution} onChange={(v) => set("education_institution", v)} placeholder="University name" />
                    <TextInput label="Field of Study" value={form.education_field} onChange={(v) => set("education_field", v)} placeholder="e.g. Computer Science" />
                    <TextInput label="Graduation Year" value={form.education_graduation_year} onChange={(v) => set("education_graduation_year", v)} placeholder="e.g. 2020" type="number" />
                  </div>
                </div>
              </div>

              <SubLabel>Driving License</SubLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                <TextInput label="License Number" value={form.driving_license_number} onChange={(v) => set("driving_license_number", v)} placeholder="License #" />
                <SelectInput label="Type" value={form.driving_license_type} onChange={(v) => set("driving_license_type", v)} options={DRIVING_LICENSE_TYPE_OPTIONS} />
                <DateInput label="Expiry" value={form.driving_license_expiry} onChange={(v) => set("driving_license_expiry", v)} yearFrom={2024} yearTo={2040} />
              </div>
            </section>

            {/* ── 7. ACCOUNT SETUP — full width ── */}
            <section className={panelCls}>
              <SectionHeader
                icon={KeyIcon}
                title="Account Setup"
                description="Optional. Create login credentials so this employee can sign in to Koleex Hub."
              />

          <div className="flex items-center gap-3 mb-4">
            <button type="button" onClick={() => set("create_account", !form.create_account)}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.create_account ? "bg-emerald-500" : "bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]"}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.create_account ? "translate-x-5" : "translate-x-0"}`} />
            </button>
            <span className="text-sm text-[var(--text-dim)]">Create login account for this employee</span>
          </div>

          {form.create_account && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <TextInput label="Username" value={form.username} onChange={(v) => set("username", v)} placeholder="e.g. john.doe" />
              <TextInput label="Login Email" value={form.login_email} onChange={(v) => set("login_email", v)} placeholder="login@company.com" type="email" />
              <div>
                <FieldLabel label="Temporary Password" />
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={form.temp_password}
                    onChange={(e) => set("temp_password", e.target.value)} className={inputCls + " pr-10"} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-dim)] transition-colors">
                    {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                  </button>
                </div>
              </div>
              <SelectInput label="Role" value={form.role_id} onChange={(v) => set("role_id", v)}
                options={roles.map((r) => ({ value: r.id, label: r.name }))} placeholder="Select role..." />
            </div>
          )}
            </section>
        </div>

        {/* ── Bottom bar ──
            Phase 18: sticky to the bottom of the viewport so a long
            form doesn't force the user to scroll all the way down to
            save. Semi-opaque blurred panel matches the hub's floating
            header pattern. Bottom padding respects iOS home-indicator
            safe area. */}
        <div
          className="sticky bottom-0 mt-8 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 bg-[var(--bg-primary)]/85 backdrop-blur-xl border-t border-[var(--border-subtle)] z-[5]"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <Link href="/employees"
            className="flex items-center gap-2 h-10 px-4 sm:px-5 rounded-xl text-sm font-medium border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
            Cancel
          </Link>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 h-10 px-6 rounded-xl text-sm font-medium bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? <SpinnerIcon size={16} className="animate-spin" /> : <CheckIcon size={16} />}
            {saving ? "Saving..." : "Save Employee"}
          </button>
        </div>

      </div>
    </div>
  );
}
