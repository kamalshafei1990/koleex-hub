"use client";

/* ---------------------------------------------------------------------------
   Edit Employee — /employees/[id]/edit

   Full editor for an existing employee. Mirrors the profile page's section
   layout (Personal / Employment / Work & Contact / Emergency / HR private)
   and saves everything through one structured PATCH:
     { employee, person, assignment } → /api/employees/[id]

   Private HR sections (salary, bank, legal IDs, insurance) only render when
   the server actually sent those columns — sanitizeEmployeeRow strips them
   for viewers without can_view_private, and can't-read means can't-write.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import CreditCardIcon from "@/components/icons/ui/CreditCardIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import {
  fetchEmployeeProfile,
  fetchDepartments,
  fetchPositionsByDepartment,
  updateEmployee,
} from "@/lib/employees-admin";
import { usePermissions } from "@/lib/permissions";
import { useTranslation } from "@/lib/i18n";
import { employeesT } from "@/lib/translations/employees";
import type { DepartmentRow, PositionRow } from "@/types/supabase";

/* ── Options (match Add Employee) ── */
const GENDER_OPTIONS = ["", "Male", "Female", "Other"];
const MARITAL_OPTIONS = ["", "Single", "Married", "Divorced", "Widowed", "Separated"];
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On Leave" },
  { value: "terminated", label: "Terminated" },
  { value: "inactive", label: "Inactive" },
];
const TYPE_OPTIONS = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
  { value: "freelance", label: "Freelance" },
];
const LOCATION_OPTIONS = [
  { value: "office", label: "Office" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
];
const RELATIONSHIP_OPTIONS = ["", "Spouse", "Parent", "Sibling", "Child", "Friend", "Other"];
const DEGREE_OPTIONS = [
  { value: "", label: "—" },
  { value: "high_school", label: "High school" },
  { value: "diploma", label: "Diploma" },
  { value: "bachelor", label: "Bachelor" },
  { value: "master", label: "Master" },
  { value: "phd", label: "PhD" },
  { value: "other", label: "Other" },
];

/* Person + employee edit state is one flat string map — numbers/dates are
   converted at save time so inputs stay simple controlled text fields. */
type F = Record<string, string>;

const PERSON_KEYS = [
  "full_name", "name_alt", "email", "phone",
  "address_line1", "address_line2", "city", "state", "country", "postal_code",
] as const;

const EMP_TEXT_KEYS = [
  "gender", "nationality", "birth_date", "marital_status", "languages",
  "employment_status", "employment_type", "work_location",
  "hire_date", "contract_end_date", "probation_end_date",
  "work_email", "work_phone",
  "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship",
  "emergency_contact2_name", "emergency_contact2_phone", "emergency_contact2_relationship",
  "notes",
] as const;

const EMP_PRIVATE_TEXT_KEYS = [
  "initial_salary", "salary_currency",
  "bank_name", "bank_account_holder", "bank_account_number", "bank_iban", "bank_swift", "bank_currency",
  "identification_id", "passport_number", "social_security_number", "tax_id",
  "visa_number", "visa_expiry_date",
  "insurance_provider", "insurance_policy_number", "insurance_class", "insurance_expiry_date",
] as const;

const EMP_EDU_KEYS = [
  "education_degree", "education_institution", "education_field", "education_graduation_year",
  "driving_license_number", "driving_license_expiry",
] as const;

/* Fields that must be sent as numbers (or null). */
const NUMERIC_KEYS = new Set(["initial_salary", "education_graduation_year"]);
/* Fields that must be sent as null when blank (dates, enums). */
const NULLABLE_KEYS = new Set([
  "birth_date", "hire_date", "contract_end_date", "probation_end_date",
  "visa_expiry_date", "insurance_expiry_date", "driving_license_expiry",
  "gender", "marital_status",
]);

const panelCls = "bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6";
const inputCls = "w-full h-9 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-colors";
const labelCls = "block text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)] mb-1";

function Field({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }> | string[];
}) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o || "—" } : o));
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function SectionCard({
  icon: Icon, title, children,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={panelCls}>
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[var(--border-faint)]">
        <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-faint)] flex items-center justify-center text-[var(--text-dim)] shrink-0" aria-hidden>
          <Icon size={16} />
        </div>
        <h2 className="text-[14px] font-bold text-[var(--text-primary)]">{title}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

export default function EmployeeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t } = useTranslation(employeesT);
  const { id } = use(params);
  const router = useRouter();
  const perms = usePermissions();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState<string | null>(null);
  const [hasPrivate, setHasPrivate] = useState(false);
  const [form, setForm] = useState<F>({});

  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [deptId, setDeptId] = useState("");
  const [posId, setPosId] = useState("");
  const [origAssignment, setOrigAssignment] = useState<{ d: string; p: string }>({ d: "", p: "" });

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  /* ── Load profile + org data ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [prof, depts] = await Promise.all([fetchEmployeeProfile(id), fetchDepartments()]);
      if (cancelled) return;
      if (!prof) { setNotFound(true); setLoading(false); return; }
      setDepartments(depts);

      const { person, employee, assignment } = prof;
      const emp = employee as unknown as Record<string, unknown>;
      const per = person as unknown as Record<string, unknown>;
      const next: F = {};
      for (const k of PERSON_KEYS) next[k] = String(per[k] ?? "");
      for (const k of [...EMP_TEXT_KEYS, ...EMP_PRIVATE_TEXT_KEYS, ...EMP_EDU_KEYS]) {
        next[k] = emp[k] != null ? String(emp[k]) : "";
      }
      setForm(next);
      setDisplayName(person.full_name);
      setEmployeeNumber(employee.employee_number ?? null);
      setHasPrivate("initial_salary" in emp);

      const d = assignment?.department_id ?? "";
      const p = assignment?.position_id ?? "";
      setDeptId(d); setPosId(p); setOrigAssignment({ d, p });
      if (d) {
        const pos = await fetchPositionsByDepartment(d);
        if (!cancelled) setPositions(pos);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  /* Department change reloads its positions. */
  const onDeptChange = async (d: string) => {
    setDeptId(d); setPosId("");
    setPositions(d ? await fetchPositionsByDepartment(d) : []);
  };

  const deptOptions = useMemo(
    () => [{ value: "", label: "—" }, ...departments.map((d) => ({ value: d.id, label: d.name }))],
    [departments],
  );
  const posOptions = useMemo(
    () => [{ value: "", label: "—" }, ...positions.map((p) => ({ value: p.id, label: p.title }))],
    [positions],
  );

  /* ── Save ── */
  const onSave = async () => {
    if (!form.full_name.trim()) { setError("Full name is required."); return; }
    setSaving(true); setError(null); setSaved(false);

    const person: Record<string, unknown> = {};
    for (const k of PERSON_KEYS) person[k] = form[k].trim() || null;
    person.full_name = form.full_name.trim(); // never null

    const employee: Record<string, unknown> = {};
    /* Private columns are stripped from the GET for non-privileged viewers,
       so only send them back when we actually received them — otherwise a
       blank form would wipe real HR data (the server drops them too). */
    const empKeys = hasPrivate
      ? [...EMP_TEXT_KEYS, ...EMP_PRIVATE_TEXT_KEYS, ...EMP_EDU_KEYS]
      : [...EMP_TEXT_KEYS, ...EMP_EDU_KEYS];
    for (const k of empKeys) {
      const raw = form[k]?.trim() ?? "";
      if (NUMERIC_KEYS.has(k)) employee[k] = raw ? Number(raw) : null;
      else if (NULLABLE_KEYS.has(k) || !raw) employee[k] = raw || null;
      else employee[k] = raw;
    }

    const res = await updateEmployee(id, {
      employee,
      person,
      ...(deptId && posId && (deptId !== origAssignment.d || posId !== origAssignment.p)
        ? { assignment: { department_id: deptId, position_id: posId } }
        : {}),
    });
    setSaving(false);
    if (!res.ok) { setError(res.error ?? "Save failed."); return; }
    setSaved(true);
    router.push(`/employees/${id}`);
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <UserIcon size={32} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-sm text-[var(--text-primary)] font-medium mb-1">{t("profile.notFound")}</p>
          <Link href="/employees" className="text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] underline underline-offset-2">
            {t("back.toList")}
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <SpinnerIcon size={28} className="animate-spin text-[var(--text-dim)]" />
      </div>
    );
  }

  if (!perms.loading && !perms.can("Employees", "edit")) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <ShieldIcon size={32} className="mx-auto text-[var(--text-faint)] mb-3" />
          <p className="text-sm text-[var(--text-primary)] font-medium mb-1">You don&apos;t have permission to edit employees.</p>
          <Link href={`/employees/${id}`} className="text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] underline underline-offset-2">
            {t("back.toList")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="mx-auto max-w-[1200px] px-4 md:px-6 lg:px-10 py-6 md:py-8 pb-28">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/employees/${id}`}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
            aria-label={t("back.toList")}
          >
            <ArrowLeftIcon size={16} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-[var(--text-primary)] truncate">
              Edit — {displayName}
            </h1>
            {employeeNumber && (
              <p className="text-[11px] text-[var(--text-dim)]">{employeeNumber}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving ? <SpinnerIcon size={14} className="animate-spin" /> : saved ? <CheckIcon size={14} /> : null}
            Save changes
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-[13px] text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <SectionCard icon={UserIcon} title={t("ov.personal")}>
            <Field label="Full name" value={form.full_name} onChange={set("full_name")} />
            <Field label="Native name (中文)" value={form.name_alt} onChange={set("name_alt")} placeholder="e.g. 黎鑫燕" />
            <SelectField label="Gender" value={form.gender} onChange={set("gender")} options={GENDER_OPTIONS} />
            <Field label="Nationality" value={form.nationality} onChange={set("nationality")} />
            <Field label="Birthday" type="date" value={form.birth_date.slice(0, 10)} onChange={set("birth_date")} />
            <SelectField label="Marital status" value={form.marital_status} onChange={set("marital_status")} options={MARITAL_OPTIONS} />
            <Field label="Personal email" type="email" value={form.email} onChange={set("email")} />
            <Field label="Personal phone" value={form.phone} onChange={set("phone")} />
            <Field label="Languages" value={form.languages} onChange={set("languages")} placeholder="English, 中文…" />
          </SectionCard>

          <SectionCard icon={BriefcaseIcon} title={t("ov.employment")}>
            <SelectField label="Department" value={deptId} onChange={(v) => { void onDeptChange(v); }} options={deptOptions} />
            <SelectField label="Position" value={posId} onChange={setPosId} options={posOptions} />
            <SelectField label="Status" value={form.employment_status} onChange={set("employment_status")} options={STATUS_OPTIONS} />
            <SelectField label="Type" value={form.employment_type} onChange={set("employment_type")} options={TYPE_OPTIONS} />
            <SelectField label="Work location" value={form.work_location} onChange={set("work_location")} options={LOCATION_OPTIONS} />
            <Field label="Hire date" type="date" value={form.hire_date.slice(0, 10)} onChange={set("hire_date")} />
            <Field label="Contract end" type="date" value={form.contract_end_date.slice(0, 10)} onChange={set("contract_end_date")} />
            <Field label="Probation end" type="date" value={form.probation_end_date.slice(0, 10)} onChange={set("probation_end_date")} />
          </SectionCard>

          <SectionCard icon={Building2Icon} title={t("ov.workContact")}>
            <Field label="Work email" type="email" value={form.work_email} onChange={set("work_email")} />
            <Field label="Work phone" value={form.work_phone} onChange={set("work_phone")} />
            <Field label="Address line 1" value={form.address_line1} onChange={set("address_line1")} />
            <Field label="Address line 2" value={form.address_line2} onChange={set("address_line2")} />
            <Field label="City" value={form.city} onChange={set("city")} />
            <Field label="State / Province" value={form.state} onChange={set("state")} />
            <Field label="Country" value={form.country} onChange={set("country")} />
            <Field label="Postal code" value={form.postal_code} onChange={set("postal_code")} />
          </SectionCard>

          <SectionCard icon={ShieldIcon} title={t("ov.emergency")}>
            <Field label="Primary contact" value={form.emergency_contact_name} onChange={set("emergency_contact_name")} />
            <Field label="Primary phone" value={form.emergency_contact_phone} onChange={set("emergency_contact_phone")} />
            <SelectField label="Primary relation" value={form.emergency_contact_relationship} onChange={set("emergency_contact_relationship")} options={RELATIONSHIP_OPTIONS} />
            <Field label="Secondary contact" value={form.emergency_contact2_name} onChange={set("emergency_contact2_name")} />
            <Field label="Secondary phone" value={form.emergency_contact2_phone} onChange={set("emergency_contact2_phone")} />
            <SelectField label="Secondary relation" value={form.emergency_contact2_relationship} onChange={set("emergency_contact2_relationship")} options={RELATIONSHIP_OPTIONS} />
          </SectionCard>

          {hasPrivate && (
            <>
              <SectionCard icon={CreditCardIcon} title={t("hr.compensation")}>
                <Field label="Initial salary" type="number" value={form.initial_salary} onChange={set("initial_salary")} />
                <Field label="Salary currency" value={form.salary_currency} onChange={set("salary_currency")} placeholder="CNY / USD…" />
                <Field label="Bank" value={form.bank_name} onChange={set("bank_name")} />
                <Field label="Account holder" value={form.bank_account_holder} onChange={set("bank_account_holder")} />
                <Field label="Account #" value={form.bank_account_number} onChange={set("bank_account_number")} />
                <Field label="IBAN" value={form.bank_iban} onChange={set("bank_iban")} />
                <Field label="SWIFT" value={form.bank_swift} onChange={set("bank_swift")} />
                <Field label="Bank currency" value={form.bank_currency} onChange={set("bank_currency")} />
              </SectionCard>

              <SectionCard icon={DocumentIcon} title={t("hr.documents")}>
                <Field label="National ID" value={form.identification_id} onChange={set("identification_id")} />
                <Field label="Passport" value={form.passport_number} onChange={set("passport_number")} />
                <Field label="SSN" value={form.social_security_number} onChange={set("social_security_number")} />
                <Field label="Tax ID" value={form.tax_id} onChange={set("tax_id")} />
                <Field label="Visa #" value={form.visa_number} onChange={set("visa_number")} />
                <Field label="Visa expiry" type="date" value={form.visa_expiry_date.slice(0, 10)} onChange={set("visa_expiry_date")} />
              </SectionCard>

              <SectionCard icon={ShieldIcon} title={t("hr.insurance")}>
                <Field label="Provider" value={form.insurance_provider} onChange={set("insurance_provider")} />
                <Field label="Policy #" value={form.insurance_policy_number} onChange={set("insurance_policy_number")} />
                <Field label="Class" value={form.insurance_class} onChange={set("insurance_class")} />
                <Field label="Expiry" type="date" value={form.insurance_expiry_date.slice(0, 10)} onChange={set("insurance_expiry_date")} />
              </SectionCard>
            </>
          )}

          <SectionCard icon={BriefcaseIcon} title={t("hr.education")}>
            <SelectField label="Degree" value={form.education_degree} onChange={set("education_degree")} options={DEGREE_OPTIONS} />
            <Field label="Institution" value={form.education_institution} onChange={set("education_institution")} />
            <Field label="Field" value={form.education_field} onChange={set("education_field")} />
            <Field label="Graduation year" type="number" value={form.education_graduation_year} onChange={set("education_graduation_year")} />
            {hasPrivate && (
              <>
                <Field label="License #" value={form.driving_license_number} onChange={set("driving_license_number")} />
                <Field label="License expiry" type="date" value={form.driving_license_expiry.slice(0, 10)} onChange={set("driving_license_expiry")} />
              </>
            )}
          </SectionCard>
        </div>

        {/* ── Bottom save bar ── */}
        <div className="fixed bottom-0 inset-x-0 z-20 bg-[var(--bg-primary)]/90 backdrop-blur border-t border-[var(--border-subtle)]">
          <div className="mx-auto max-w-[1200px] px-4 md:px-6 lg:px-10 h-16 flex items-center justify-between gap-3">
            <span className="text-[12px] text-[var(--text-dim)] truncate">
              {error ? <span className="text-red-400">{error}</span> : `Editing ${displayName}`}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/employees/${id}`}
                className="h-10 px-4 rounded-xl border border-[var(--border-subtle)] text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center transition-colors"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
              >
                {saving && <SpinnerIcon size={14} className="animate-spin" />}
                Save changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
