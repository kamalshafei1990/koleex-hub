"use client";

/* ---------------------------------------------------------------------------
   Add Employee — Full-page form with all fields in one scrollable page.
   Layout matches Products app: min-h-screen, max-w container, natural scroll.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import PhoneIcon from "@/components/icons/ui/PhoneIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import MapPinIcon from "@/components/icons/ui/MapPinIcon";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import CreditCardIcon from "@/components/icons/ui/CreditCardIcon";
import KeyIcon from "@/components/icons/ui/KeyIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import EyeOffIcon from "@/components/icons/ui/EyeOffIcon";
import EmployeesIcon from "@/components/icons/EmployeesIcon";
import {
  emptyWizardData,
  generateEmployeeNumber,
  createFullEmployee,
  fetchDepartments,
  fetchPositionsByDepartment,
  type EmployeeWizardData,
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

/* ═══════════════════════════════════════════════════
   REUSABLE INPUT COMPONENTS
   ═══════════════════════════════════════════════════ */

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-[var(--text-dim)] mb-1.5">
      {label}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full h-10 px-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)]
                   text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)]
                   focus:outline-none focus:border-[var(--border-focus)] transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 px-3 pr-9 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)]
                     text-sm text-[var(--text-primary)] appearance-none
                     focus:outline-none focus:border-[var(--border-focus)] transition-colors"
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <AngleDownIcon size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)]">
        <Icon size={18} className="text-[var(--text-dim)]" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
        {description && (
          <p className="text-xs text-[var(--text-faint)] mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PAGE COMPONENT
   ═══════════════════════════════════════════════════ */

export default function AddEmployeePage() {
  const router = useRouter();

  /* ── Form state ── */
  const [form, setForm] = useState<EmployeeWizardData>(emptyWizardData());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /* ── Lookups ── */
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loadingDeps, setLoadingDeps] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  /* ── Country options (memoized) ── */
  const countryOptions = useMemo(
    () => COUNTRIES.map((c) => ({ value: c.code, label: `${c.flag} ${c.name}` })),
    [],
  );

  /* ── Load departments, roles & generate employee number ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [deps, empNum, rolesData] = await Promise.all([
        fetchDepartments(),
        generateEmployeeNumber(),
        fetchRoles(),
      ]);
      if (cancelled) return;
      setDepartments(deps);
      setRoles(rolesData);
      setForm((f) => ({ ...f, employee_number: empNum }));
      setLoadingDeps(false);
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Load positions when department changes ── */
  useEffect(() => {
    if (!form.department_id || form.create_new_department) {
      setPositions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const pos = await fetchPositionsByDepartment(form.department_id);
      if (!cancelled) setPositions(pos);
    })();
    return () => { cancelled = true; };
  }, [form.department_id, form.create_new_department]);

  /* ── Updater ── */
  const set = useCallback(
    <K extends keyof EmployeeWizardData>(key: K, value: EmployeeWizardData[K]) => {
      setForm((f) => ({ ...f, [key]: value }));
      setError(null);
    },
    [],
  );

  /* ── Validate ── */
  const validate = useCallback(() => {
    if (!form.first_name.trim()) return "First name is required.";
    if (!form.last_name.trim()) return "Last name is required.";
    if (!form.department_id && !form.create_new_department) return "Department is required.";
    if (form.create_new_department && !form.department_name.trim()) return "Department name is required.";
    if (!form.position_id && !form.create_new_position) return "Position is required.";
    if (form.create_new_position && !form.position_title.trim()) return "Position title is required.";
    if (form.create_account) {
      if (!form.login_email.trim() && !form.work_email.trim() && !form.personal_email.trim())
        return "Login email is required when creating an account.";
    }
    return null;
  }, [form]);

  /* ── Submit ── */
  const handleSubmit = useCallback(async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    const result = await createFullEmployee(form);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => router.push("/employees"), 1200);
    } else {
      setError(result.error || "Failed to create employee.");
      setSaving(false);
    }
  }, [form, validate, router]);

  /* ═══════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════ */

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

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <Link
              href="/employees"
              className="flex items-center justify-center h-8 w-8 rounded-lg
                         bg-[var(--bg-secondary)] border border-[var(--border-subtle)]
                         text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowLeftIcon size={16} />
            </Link>
            <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)]">
              <EmployeesIcon size={18} className="text-[var(--text-dim)]" />
            </div>
            <h1 className="text-xl md:text-[22px] font-semibold text-[var(--text-primary)]">
              Add Employee
            </h1>
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-medium
                       bg-[var(--bg-inverted)] text-[var(--text-inverted)]
                       hover:opacity-90 active:scale-[0.98] transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <SpinnerIcon size={16} className="animate-spin" />
            ) : (
              <CheckIcon size={16} />
            )}
            {saving ? "Saving..." : "Save Employee"}
          </button>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* ── Form sections ── */}
        <div className="space-y-6">

          {/* ═══════════ SECTION 1: Personal Information ═══════════ */}
          <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
            <SectionHeader icon={UserIcon} title="Personal Information" description="Basic identity and personal details" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <SelectInput
                label="Title"
                value={form.title}
                onChange={(v) => set("title", v)}
                options={TITLE_OPTIONS.map((t) => ({ value: t, label: t || "—" }))}
                placeholder="Select..."
              />
              <TextInput
                label="First Name"
                value={form.first_name}
                onChange={(v) => set("first_name", v)}
                placeholder="First name"
                required
              />
              <TextInput
                label="Middle Name"
                value={form.middle_name}
                onChange={(v) => set("middle_name", v)}
                placeholder="Middle name"
              />
              <TextInput
                label="Last Name"
                value={form.last_name}
                onChange={(v) => set("last_name", v)}
                placeholder="Last name"
                required
              />
              <SelectInput
                label="Gender"
                value={form.gender}
                onChange={(v) => set("gender", v)}
                options={GENDER_OPTIONS.map((g) => ({ value: g, label: g || "—" }))}
                placeholder="Select..."
              />
              <TextInput
                label="Date of Birth"
                value={form.birthday}
                onChange={(v) => set("birthday", v)}
                type="date"
              />
              <SelectInput
                label="Nationality"
                value={form.nationality}
                onChange={(v) => set("nationality", v)}
                options={countryOptions}
                placeholder="Select country..."
              />
              <SelectInput
                label="Marital Status"
                value={form.marital_status}
                onChange={(v) => set("marital_status", v)}
                options={MARITAL_OPTIONS.map((m) => ({ value: m, label: m || "—" }))}
                placeholder="Select..."
              />
              <TextInput
                label="Number of Children"
                value={form.number_of_children}
                onChange={(v) => set("number_of_children", v)}
                type="number"
                placeholder="0"
              />
            </div>
          </section>

          {/* ═══════════ SECTION 2: Contact Details ═══════════ */}
          <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
            <SectionHeader icon={PhoneIcon} title="Contact Details" description="Personal and work contact information" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <TextInput
                label="Personal Phone"
                value={form.personal_phone}
                onChange={(v) => set("personal_phone", v)}
                placeholder="+1 234 567 890"
                type="tel"
              />
              <TextInput
                label="Personal Email"
                value={form.personal_email}
                onChange={(v) => set("personal_email", v)}
                placeholder="personal@email.com"
                type="email"
              />
              <TextInput
                label="Work Phone"
                value={form.work_phone}
                onChange={(v) => set("work_phone", v)}
                placeholder="+1 234 567 890"
                type="tel"
              />
              <TextInput
                label="Work Email"
                value={form.work_email}
                onChange={(v) => set("work_email", v)}
                placeholder="name@company.com"
                type="email"
              />
            </div>
          </section>

          {/* ═══════════ SECTION 3: Employment Details ═══════════ */}
          <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
            <SectionHeader icon={BriefcaseIcon} title="Employment Details" description="Hiring, contract, and work arrangement" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <TextInput
                label="Employee Number"
                value={form.employee_number}
                onChange={(v) => set("employee_number", v)}
                placeholder="EMP-001"
                disabled
              />
              <TextInput
                label="Hire Date"
                value={form.hire_date}
                onChange={(v) => set("hire_date", v)}
                type="date"
              />
              <SelectInput
                label="Employment Type"
                value={form.employment_type}
                onChange={(v) => set("employment_type", v)}
                options={EMPLOYMENT_TYPE_OPTIONS}
              />
              <SelectInput
                label="Work Location"
                value={form.work_location}
                onChange={(v) => set("work_location", v)}
                options={WORK_LOCATION_OPTIONS}
              />
              <TextInput
                label="Contract End Date"
                value={form.contract_end_date}
                onChange={(v) => set("contract_end_date", v)}
                type="date"
              />
              <TextInput
                label="Probation End Date"
                value={form.probation_end_date}
                onChange={(v) => set("probation_end_date", v)}
                type="date"
              />
            </div>
          </section>

          {/* ═══════════ SECTION 4: Department & Position ═══════════ */}
          <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
            <SectionHeader icon={Building2Icon} title="Department & Position" description="Organizational placement" />

            {loadingDeps ? (
              <div className="flex items-center gap-2 text-sm text-[var(--text-faint)] py-4">
                <SpinnerIcon size={16} className="animate-spin" /> Loading departments...
              </div>
            ) : (
              <div className="space-y-4">
                {/* Department */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {!form.create_new_department ? (
                    <SelectInput
                      label="Department"
                      value={form.department_id}
                      onChange={(v) => {
                        set("department_id", v);
                        set("position_id", "");
                      }}
                      options={departments.map((d) => ({ value: d.id, label: d.name }))}
                      placeholder="Select department..."
                      required
                    />
                  ) : (
                    <TextInput
                      label="New Department Name"
                      value={form.department_name}
                      onChange={(v) => set("department_name", v)}
                      placeholder="e.g. Engineering"
                      required
                    />
                  )}
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        set("create_new_department", !form.create_new_department);
                        if (!form.create_new_department) {
                          set("department_id", "");
                          set("position_id", "");
                        }
                      }}
                      className="flex items-center gap-1.5 h-10 px-3 rounded-xl text-xs font-medium
                                 border border-[var(--border-subtle)] text-[var(--text-dim)]
                                 hover:text-[var(--text-primary)] hover:border-[var(--border-color)] transition-colors"
                    >
                      <PlusIcon size={14} />
                      {form.create_new_department ? "Use existing" : "Create new"}
                    </button>
                  </div>
                </div>

                {/* Position */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {!form.create_new_position ? (
                    <SelectInput
                      label="Position"
                      value={form.position_id}
                      onChange={(v) => set("position_id", v)}
                      options={positions.map((p) => ({ value: p.id, label: p.title }))}
                      placeholder={
                        !form.department_id && !form.create_new_department
                          ? "Select department first..."
                          : positions.length === 0
                            ? "No positions — create one"
                            : "Select position..."
                      }
                      required
                    />
                  ) : (
                    <TextInput
                      label="New Position Title"
                      value={form.position_title}
                      onChange={(v) => set("position_title", v)}
                      placeholder="e.g. Software Engineer"
                      required
                    />
                  )}
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        set("create_new_position", !form.create_new_position);
                        if (!form.create_new_position) set("position_id", "");
                      }}
                      className="flex items-center gap-1.5 h-10 px-3 rounded-xl text-xs font-medium
                                 border border-[var(--border-subtle)] text-[var(--text-dim)]
                                 hover:text-[var(--text-primary)] hover:border-[var(--border-color)] transition-colors"
                    >
                      <PlusIcon size={14} />
                      {form.create_new_position ? "Use existing" : "Create new"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ═══════════ SECTION 5: Private Address ═══════════ */}
          <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
            <SectionHeader icon={MapPinIcon} title="Private Address" description="Employee home address" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <TextInput
                  label="Address Line 1"
                  value={form.private_address_line1}
                  onChange={(v) => set("private_address_line1", v)}
                  placeholder="Street address"
                />
              </div>
              <div className="sm:col-span-2">
                <TextInput
                  label="Address Line 2"
                  value={form.private_address_line2}
                  onChange={(v) => set("private_address_line2", v)}
                  placeholder="Apartment, suite, unit"
                />
              </div>
              <TextInput
                label="City"
                value={form.private_city}
                onChange={(v) => set("private_city", v)}
                placeholder="City"
              />
              <TextInput
                label="State / Province"
                value={form.private_state}
                onChange={(v) => set("private_state", v)}
                placeholder="State or province"
              />
              <SelectInput
                label="Country"
                value={form.private_country}
                onChange={(v) => set("private_country", v)}
                options={countryOptions}
                placeholder="Select country..."
              />
              <TextInput
                label="Postal Code"
                value={form.private_postal_code}
                onChange={(v) => set("private_postal_code", v)}
                placeholder="Postal / ZIP"
              />
            </div>
          </section>

          {/* ═══════════ SECTION 6: Emergency Contact ═══════════ */}
          <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
            <SectionHeader icon={ShieldIcon} title="Emergency Contact" description="Person to contact in case of emergency" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <TextInput
                label="Contact Name"
                value={form.emergency_contact_name}
                onChange={(v) => set("emergency_contact_name", v)}
                placeholder="Full name"
              />
              <TextInput
                label="Contact Phone"
                value={form.emergency_contact_phone}
                onChange={(v) => set("emergency_contact_phone", v)}
                placeholder="+1 234 567 890"
                type="tel"
              />
              <SelectInput
                label="Relationship"
                value={form.emergency_contact_relationship}
                onChange={(v) => set("emergency_contact_relationship", v)}
                options={RELATIONSHIP_OPTIONS.map((r) => ({ value: r, label: r || "—" }))}
                placeholder="Select..."
              />
            </div>
          </section>

          {/* ═══════════ SECTION 7: Documents & Visa ═══════════ */}
          <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
            <SectionHeader icon={DocumentIcon} title="Documents & Visa" description="Identification and travel documents" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <TextInput
                label="Identification ID"
                value={form.identification_id}
                onChange={(v) => set("identification_id", v)}
                placeholder="National ID number"
              />
              <TextInput
                label="Passport Number"
                value={form.passport_number}
                onChange={(v) => set("passport_number", v)}
                placeholder="Passport number"
              />
              <TextInput
                label="Visa Number"
                value={form.visa_number}
                onChange={(v) => set("visa_number", v)}
                placeholder="Visa number"
              />
              <TextInput
                label="Visa Expiry Date"
                value={form.visa_expiry_date}
                onChange={(v) => set("visa_expiry_date", v)}
                type="date"
              />
            </div>
          </section>

          {/* ═══════════ SECTION 8: Bank Details ═══════════ */}
          <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
            <SectionHeader icon={CreditCardIcon} title="Bank Details" description="Employee banking information for payroll" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <TextInput
                label="Bank Name"
                value={form.bank_name}
                onChange={(v) => set("bank_name", v)}
                placeholder="e.g. HSBC, JPMorgan"
              />
              <TextInput
                label="Account Holder Name"
                value={form.bank_account_holder}
                onChange={(v) => set("bank_account_holder", v)}
                placeholder="Full name on account"
              />
              <TextInput
                label="Account Number"
                value={form.bank_account_number}
                onChange={(v) => set("bank_account_number", v)}
                placeholder="Account number"
              />
              <TextInput
                label="IBAN"
                value={form.bank_iban}
                onChange={(v) => set("bank_iban", v)}
                placeholder="International bank account number"
              />
              <TextInput
                label="SWIFT / BIC"
                value={form.bank_swift}
                onChange={(v) => set("bank_swift", v)}
                placeholder="SWIFT code"
              />
              <TextInput
                label="Currency"
                value={form.bank_currency}
                onChange={(v) => set("bank_currency", v)}
                placeholder="e.g. USD, EUR, GBP"
              />
            </div>
          </section>

          {/* ═══════════ SECTION 9: Account Setup (Optional) ═══════════ */}
          <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
            <SectionHeader icon={KeyIcon} title="Account Setup" description="Create a login account for this employee (optional)" />

            {/* Toggle */}
            <div className="flex items-center gap-3 mb-5">
              <button
                type="button"
                onClick={() => set("create_account", !form.create_account)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  form.create_account
                    ? "bg-emerald-500"
                    : "bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    form.create_account ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm text-[var(--text-dim)]">
                Create login account for this employee
              </span>
            </div>

            {form.create_account && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <TextInput
                  label="Username"
                  value={form.username}
                  onChange={(v) => set("username", v)}
                  placeholder="e.g. john.doe"
                />
                <TextInput
                  label="Login Email"
                  value={form.login_email}
                  onChange={(v) => set("login_email", v)}
                  placeholder="login@company.com"
                  type="email"
                />
                <div>
                  <FieldLabel label="Temporary Password" />
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.temp_password}
                      onChange={(e) => set("temp_password", e.target.value)}
                      className="w-full h-10 px-3 pr-10 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)]
                                 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)]
                                 focus:outline-none focus:border-[var(--border-focus)] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
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

        {/* ── Bottom save bar (mobile friendly) ── */}
        <div className="mt-8 mb-4 flex items-center justify-between gap-4">
          <Link
            href="/employees"
            className="flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-medium
                       border border-[var(--border-subtle)] text-[var(--text-dim)]
                       hover:text-[var(--text-primary)] hover:border-[var(--border-color)] transition-colors"
          >
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 h-10 px-6 rounded-xl text-sm font-medium
                       bg-[var(--bg-inverted)] text-[var(--text-inverted)]
                       hover:opacity-90 active:scale-[0.98] transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <SpinnerIcon size={16} className="animate-spin" />
            ) : (
              <CheckIcon size={16} />
            )}
            {saving ? "Saving..." : "Save Employee"}
          </button>
        </div>

      </div>
    </div>
  );
}
