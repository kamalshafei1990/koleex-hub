"use client";

/* ---------------------------------------------------------------------------
   EmployeeWizard — 4-step guided flow for adding a new employee.

   Step 1: Personal Info        → people table
   Step 2: Employment Details   → koleex_employees table
   Step 3: Department & Position (required) → koleex_assignments
   Step 4: Account (optional)   → accounts table
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import KeyIcon from "@/components/icons/ui/KeyIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import ArrowRightIcon from "@/components/icons/ui/ArrowRightIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import EyeOffIcon from "@/components/icons/ui/EyeOffIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import RefreshCcwIcon from "@/components/icons/ui/RefreshCcwIcon";
import {
  emptyWizardData,
  generateEmployeeNumber,
  fetchDepartments,
  fetchPositionsByDepartment,
  createFullEmployee,
  type EmployeeWizardData,
} from "@/lib/employees-admin";
import { generateTemporaryPassword, suggestUsername } from "@/lib/accounts-admin";
import type { DepartmentRow, PositionRow } from "@/types/supabase";

/* ── Shared styles (match hub form pattern) ── */
const inputClass =
  "w-full h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors";
const selectClass =
  "w-full h-10 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] transition-colors appearance-none";
const labelClass =
  "block text-[10px] font-semibold text-[var(--text-dim)] mb-1.5 uppercase tracking-wider";
const sectionWrap =
  "bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6";

const STEPS = [
  { label: "Personal Info", icon: UserIcon },
  { label: "Employment", icon: BriefcaseIcon },
  { label: "Department & Position", icon: Building2Icon },
  { label: "Account", icon: KeyIcon },
];

const TITLES = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Eng.", "Sheikh", "H.E."];
const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "intern", label: "Intern" },
  { value: "freelance", label: "Freelance" },
];
const WORK_LOCATIONS = [
  { value: "office", label: "Office" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
];

interface Props {
  onClose: () => void;
  onCreated?: (employeeId: string) => void;
}

export default function EmployeeWizard({ onClose, onCreated }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<EmployeeWizardData>(emptyWizardData());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Department & Position data
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [newDeptName, setNewDeptName] = useState("");
  const [newPosTitle, setNewPosTitle] = useState("");

  // Auto-generate employee number on mount
  useEffect(() => {
    generateEmployeeNumber().then((num) => setForm((f) => ({ ...f, employee_number: num })));
    fetchDepartments().then(setDepartments);
  }, []);

  // Fetch positions when department changes
  useEffect(() => {
    if (form.department_id && !form.create_new_department) {
      fetchPositionsByDepartment(form.department_id).then(setPositions);
    } else {
      setPositions([]);
    }
  }, [form.department_id, form.create_new_department]);

  // Auto-suggest username when name changes
  useEffect(() => {
    if (form.create_account && form.first_name) {
      const fullName = `${form.first_name} ${form.last_name}`.trim();
      setForm((f) => ({
        ...f,
        username: suggestUsername(fullName),
        login_email: f.login_email || f.work_email || f.personal_email || "",
      }));
    }
  }, [form.first_name, form.last_name, form.create_account, form.work_email, form.personal_email]);

  const set = (key: keyof EmployeeWizardData, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));

  /* ── Validation ── */
  const canProceed = (): boolean => {
    if (step === 0) return !!(form.first_name && form.last_name);
    if (step === 1) return !!form.hire_date;
    if (step === 2) {
      if (form.create_new_department) {
        if (!newDeptName) return false;
      } else {
        if (!form.department_id) return false;
      }
      if (form.create_new_position) {
        if (!newPosTitle) return false;
      } else {
        if (!form.position_id) return false;
      }
      return true;
    }
    return true; // step 4 is optional
  };

  /* ── Submit ── */
  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    const submitData: EmployeeWizardData = {
      ...form,
      department_name: form.create_new_department ? newDeptName : "",
      position_title: form.create_new_position ? newPosTitle : "",
    };

    const result = await createFullEmployee(submitData);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        onCreated?.(result.employeeId!);
        onClose();
      }, 1500);
    } else {
      setError(result.error || "Failed to create employee");
    }
    setSaving(false);
  };

  /* ── Success state ── */
  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className={`${sectionWrap} max-w-md w-full mx-4 text-center py-12`}>
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--bg-surface)", color: "#34C759" }}
          >
            <CheckCircleIcon className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Employee Created
          </h2>
          <p className="mt-2 text-[13px]" style={{ color: "var(--text-muted)" }}>
            {form.first_name} {form.last_name} has been added successfully.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col rounded-2xl border overflow-hidden"
        style={{ background: "var(--bg-primary)", borderColor: "var(--border-subtle)" }}
      >
        {/* ── Header ── */}
        <div className="shrink-0 px-6 pt-5 pb-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              Add New Employee
            </h2>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[var(--bg-surface)] transition-colors"
              style={{ color: "var(--text-dim)" }}
            >
              &times;
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex gap-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === step;
              const isDone = i < step;
              return (
                <button
                  key={s.label}
                  onClick={() => i < step && setStep(i)}
                  className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[11px] font-medium transition-all"
                  style={{
                    background: isActive
                      ? "var(--bg-surface-active, var(--bg-surface))"
                      : "transparent",
                    color: isActive
                      ? "var(--text-primary)"
                      : isDone
                        ? "#34C759"
                        : "var(--text-dim)",
                    border: isActive
                      ? "1px solid var(--border-focus, var(--border-subtle))"
                      : "1px solid transparent",
                    cursor: i < step ? "pointer" : "default",
                  }}
                >
                  {isDone ? (
                    <CheckIcon className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="hidden sm:inline truncate">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Step Content ── */}
        <div className="flex-1 overflow-auto px-6 py-5">
          {step === 0 && <Step1Personal form={form} set={set} />}
          {step === 1 && <Step2Employment form={form} set={set} />}
          {step === 2 && (
            <Step3Department
              form={form}
              set={set}
              departments={departments}
              positions={positions}
              newDeptName={newDeptName}
              setNewDeptName={setNewDeptName}
              newPosTitle={newPosTitle}
              setNewPosTitle={setNewPosTitle}
            />
          )}
          {step === 3 && (
            <Step4Account
              form={form}
              set={set}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
            />
          )}

          {error && (
            <div
              className="mt-4 rounded-xl px-4 py-3 text-[13px]"
              style={{ background: "rgba(255,59,48,0.1)", color: "#FF3B30" }}
            >
              {error}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          className="shrink-0 flex items-center justify-between px-6 py-4 border-t"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <button
            onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
            className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-medium transition-colors hover:bg-[var(--bg-surface)]"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            {step === 0 ? "Cancel" : "Back"}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-semibold text-white transition-opacity disabled:opacity-40"
              style={{ background: "#007AFF" }}
            >
              Next
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving || !canProceed()}
              className="flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-semibold text-white transition-opacity disabled:opacity-40"
              style={{ background: "#34C759" }}
            >
              {saving ? "Creating..." : "Create Employee"}
              {!saving && <CheckIcon className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   STEP 1 — Personal Info
   ═══════════════════════════════════════════════════ */

function Step1Personal({
  form,
  set,
}: {
  form: EmployeeWizardData;
  set: (k: keyof EmployeeWizardData, v: any) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
        Basic personal information for the employee record.
      </p>

      {/* Name row */}
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className={labelClass}>Title</label>
          <select
            className={selectClass}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          >
            <option value="">—</option>
            {TITLES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>First Name *</label>
          <input
            className={inputClass}
            placeholder="First name"
            value={form.first_name}
            onChange={(e) => set("first_name", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Middle Name</label>
          <input
            className={inputClass}
            placeholder="Middle name"
            value={form.middle_name}
            onChange={(e) => set("middle_name", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Last Name *</label>
          <input
            className={inputClass}
            placeholder="Last name"
            value={form.last_name}
            onChange={(e) => set("last_name", e.target.value)}
          />
        </div>
      </div>

      {/* Gender & Birthday */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Gender</label>
          <select
            className={selectClass}
            value={form.gender}
            onChange={(e) => set("gender", e.target.value)}
          >
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Birthday</label>
          <input
            className={inputClass}
            type="date"
            value={form.birthday}
            onChange={(e) => set("birthday", e.target.value)}
          />
        </div>
      </div>

      {/* Nationality & Contact */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Nationality</label>
          <input
            className={inputClass}
            placeholder="e.g. Egyptian"
            value={form.nationality}
            onChange={(e) => set("nationality", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Personal Phone</label>
          <input
            className={inputClass}
            placeholder="+1 234 567 8900"
            value={form.personal_phone}
            onChange={(e) => set("personal_phone", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Personal Email</label>
        <input
          className={inputClass}
          type="email"
          placeholder="personal@email.com"
          value={form.personal_email}
          onChange={(e) => set("personal_email", e.target.value)}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   STEP 2 — Employment Details
   ═══════════════════════════════════════════════════ */

function Step2Employment({
  form,
  set,
}: {
  form: EmployeeWizardData;
  set: (k: keyof EmployeeWizardData, v: any) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
        Employment details and work contact information.
      </p>

      {/* Employee number & hire date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Employee Number</label>
          <input
            className={inputClass}
            placeholder="EMP-001"
            value={form.employee_number}
            onChange={(e) => set("employee_number", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Hire Date *</label>
          <input
            className={inputClass}
            type="date"
            value={form.hire_date}
            onChange={(e) => set("hire_date", e.target.value)}
          />
        </div>
      </div>

      {/* Employment type & work location */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Employment Type</label>
          <select
            className={selectClass}
            value={form.employment_type}
            onChange={(e) => set("employment_type", e.target.value)}
          >
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Work Location</label>
          <select
            className={selectClass}
            value={form.work_location}
            onChange={(e) => set("work_location", e.target.value)}
          >
            {WORK_LOCATIONS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Contract & probation dates */}
      {(form.employment_type === "contract" || form.employment_type === "intern") && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Contract End Date</label>
            <input
              className={inputClass}
              type="date"
              value={form.contract_end_date}
              onChange={(e) => set("contract_end_date", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Probation End Date</label>
            <input
              className={inputClass}
              type="date"
              value={form.probation_end_date}
              onChange={(e) => set("probation_end_date", e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Work contact */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Work Email</label>
          <input
            className={inputClass}
            type="email"
            placeholder="name@koleex.com"
            value={form.work_email}
            onChange={(e) => set("work_email", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Work Phone</label>
          <input
            className={inputClass}
            placeholder="+1 234 567 8900"
            value={form.work_phone}
            onChange={(e) => set("work_phone", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   STEP 3 — Department & Position
   ═══════════════════════════════════════════════════ */

function Step3Department({
  form,
  set,
  departments,
  positions,
  newDeptName,
  setNewDeptName,
  newPosTitle,
  setNewPosTitle,
}: {
  form: EmployeeWizardData;
  set: (k: keyof EmployeeWizardData, v: any) => void;
  departments: DepartmentRow[];
  positions: PositionRow[];
  newDeptName: string;
  setNewDeptName: (v: string) => void;
  newPosTitle: string;
  setNewPosTitle: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
        Place the employee in the organizational structure. Both department and position are required.
      </p>

      {/* Department */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className={labelClass} style={{ marginBottom: 0 }}>Department *</label>
          <button
            onClick={() => {
              set("create_new_department", !form.create_new_department);
              set("department_id", "");
              set("position_id", "");
              set("create_new_position", false);
              setNewDeptName("");
              setNewPosTitle("");
            }}
            className="flex items-center gap-1 text-[11px] font-medium transition-colors"
            style={{ color: "#007AFF" }}
          >
            <PlusIcon className="h-3 w-3" />
            {form.create_new_department ? "Pick existing" : "Create new"}
          </button>
        </div>

        {form.create_new_department ? (
          <input
            className={inputClass}
            placeholder="New department name"
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            autoFocus
          />
        ) : (
          <select
            className={selectClass}
            value={form.department_id}
            onChange={(e) => {
              set("department_id", e.target.value);
              set("position_id", "");
            }}
          >
            <option value="">Select department...</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Position */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className={labelClass} style={{ marginBottom: 0 }}>Position *</label>
          <button
            onClick={() => {
              set("create_new_position", !form.create_new_position);
              set("position_id", "");
              setNewPosTitle("");
            }}
            className="flex items-center gap-1 text-[11px] font-medium transition-colors"
            style={{ color: "#007AFF" }}
          >
            <PlusIcon className="h-3 w-3" />
            {form.create_new_position ? "Pick existing" : "Create new"}
          </button>
        </div>

        {form.create_new_position ? (
          <input
            className={inputClass}
            placeholder="New position title"
            value={newPosTitle}
            onChange={(e) => setNewPosTitle(e.target.value)}
            autoFocus
          />
        ) : (
          <select
            className={selectClass}
            value={form.position_id}
            onChange={(e) => set("position_id", e.target.value)}
            disabled={!form.department_id && !form.create_new_department}
          >
            <option value="">
              {!form.department_id && !form.create_new_department
                ? "Select a department first..."
                : positions.length === 0
                  ? "No positions — create one"
                  : "Select position..."
              }
            </option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        )}
      </div>

      {/* Info note */}
      {(form.create_new_department || form.create_new_position) && (
        <div
          className="rounded-xl px-4 py-3 text-[12px]"
          style={{ background: "rgba(0,122,255,0.08)", color: "#007AFF" }}
        >
          New {form.create_new_department ? "department" : ""}{form.create_new_department && form.create_new_position ? " and " : ""}{form.create_new_position ? "position" : ""} will be created automatically and visible in the Management app.
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   STEP 4 — Account (Optional)
   ═══════════════════════════════════════════════════ */

function Step4Account({
  form,
  set,
  showPassword,
  setShowPassword,
}: {
  form: EmployeeWizardData;
  set: (k: keyof EmployeeWizardData, v: any) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
        Optionally create a system account so this employee can log into Koleex Hub.
      </p>

      {/* Toggle */}
      <div
        className="flex items-center justify-between rounded-xl px-4 py-3.5 cursor-pointer"
        style={{ background: "var(--bg-surface-subtle)" }}
        onClick={() => set("create_account", !form.create_account)}
      >
        <div>
          <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Create system account
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-dim)" }}>
            Employee will be able to log into the Hub
          </p>
        </div>
        <div
          className="h-6 w-11 rounded-full flex items-center px-0.5 transition-colors"
          style={{
            background: form.create_account ? "#34C759" : "var(--bg-surface)",
            border: form.create_account ? "none" : "1px solid var(--border-subtle)",
          }}
        >
          <div
            className="h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
            style={{ transform: form.create_account ? "translateX(20px)" : "translateX(0)" }}
          />
        </div>
      </div>

      {form.create_account && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Username */}
          <div>
            <label className={labelClass}>Username</label>
            <input
              className={inputClass}
              placeholder="john.doe"
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
            />
          </div>

          {/* Login email */}
          <div>
            <label className={labelClass}>Login Email</label>
            <input
              className={inputClass}
              type="email"
              placeholder="name@koleex.com"
              value={form.login_email}
              onChange={(e) => set("login_email", e.target.value)}
            />
          </div>

          {/* Temporary password */}
          <div>
            <label className={labelClass}>Temporary Password</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  className={inputClass}
                  type={showPassword ? "text" : "password"}
                  value={form.temp_password}
                  onChange={(e) => set("temp_password", e.target.value)}
                  readOnly
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-dim)" }}
                >
                  {showPassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
              <button
                onClick={() => set("temp_password", generateTemporaryPassword())}
                className="h-10 w-10 shrink-0 rounded-lg border flex items-center justify-center transition-colors hover:bg-[var(--bg-surface)]"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-dim)" }}
                title="Regenerate"
              >
                <RefreshCcwIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(form.temp_password)}
                className="h-10 w-10 shrink-0 rounded-lg border flex items-center justify-center transition-colors hover:bg-[var(--bg-surface)]"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-dim)" }}
                title="Copy"
              >
                <CopyIcon className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-[11px]" style={{ color: "var(--text-dim)" }}>
              Employee must change this on first login.
            </p>
          </div>
        </div>
      )}

      {!form.create_account && (
        <div
          className="rounded-xl px-4 py-3 text-[12px]"
          style={{ background: "var(--bg-surface-subtle)", color: "var(--text-dim)" }}
        >
          You can create an account later from the employee&apos;s profile page.
        </div>
      )}
    </div>
  );
}
