"use client";

/* ---------------------------------------------------------------------------
   PrivateTab — private HR data on koleex_employees.

   Fields (all stored on koleex_employees):
     - Private Address      — address_line1/2, city, state, country, postal_code
     - Emergency Contact    — name, phone, relationship
     - Identity             — birth_date, marital_status, nationality
     - Documents            — identification_id, passport_number, visa_number, visa_expiry_date

   Only shown for internal accounts. If no koleex_employees record exists yet,
   the tab auto-creates one on save via upsertEmployeeByAccountId.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import LockIcon from "@/components/icons/ui/LockIcon";
import MapPinIcon from "@/components/icons/ui/MapPinIcon";
import PhoneCallIcon from "@/components/icons/ui/PhoneCallIcon";
import IdCardIcon from "@/components/icons/ui/IdCardIcon";
import FileBadge2Icon from "@/components/icons/ui/FileBadge2Icon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import type {
  AccountWithLinks,
  EmployeeRow,
} from "@/types/supabase";
import { upsertEmployeeByAccountId } from "@/lib/accounts-admin";
import {
  tabCardClass,
  tabSectionTitle,
  inputClass,
  labelClass,
  TabEmptyState,
  TabActionBar,
} from "./shared";

interface Props {
  account: AccountWithLinks;
  onChanged?: (employee: EmployeeRow) => void;
}

/** All editable private-HR fields on koleex_employees. */
type PrivateFields = Pick<
  EmployeeRow,
  | "private_address_line1"
  | "private_address_line2"
  | "private_city"
  | "private_state"
  | "private_country"
  | "private_postal_code"
  | "emergency_contact_name"
  | "emergency_contact_phone"
  | "emergency_contact_relationship"
  | "birth_date"
  | "marital_status"
  | "nationality"
  | "identification_id"
  | "passport_number"
  | "visa_number"
  | "visa_expiry_date"
>;

function emptyPrivateFields(): PrivateFields {
  return {
    private_address_line1: null,
    private_address_line2: null,
    private_city: null,
    private_state: null,
    private_country: null,
    private_postal_code: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    emergency_contact_relationship: null,
    birth_date: null,
    marital_status: null,
    nationality: null,
    identification_id: null,
    passport_number: null,
    visa_number: null,
    visa_expiry_date: null,
  };
}

function pickPrivateFields(emp: EmployeeRow | null): PrivateFields {
  if (!emp) return emptyPrivateFields();
  return {
    private_address_line1: emp.private_address_line1,
    private_address_line2: emp.private_address_line2,
    private_city: emp.private_city,
    private_state: emp.private_state,
    private_country: emp.private_country,
    private_postal_code: emp.private_postal_code,
    emergency_contact_name: emp.emergency_contact_name,
    emergency_contact_phone: emp.emergency_contact_phone,
    emergency_contact_relationship: emp.emergency_contact_relationship,
    birth_date: emp.birth_date,
    marital_status: emp.marital_status,
    nationality: emp.nationality,
    identification_id: emp.identification_id,
    passport_number: emp.passport_number,
    visa_number: emp.visa_number,
    visa_expiry_date: emp.visa_expiry_date,
  };
}

export default function PrivateTab({ account, onChanged }: Props) {
  const initial = useMemo(() => pickPrivateFields(account.employee), [account.employee]);

  const [fields, setFields] = useState<PrivateFields>(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setFields(initial), [initial]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Only internal employees get private HR data.
  if (account.user_type !== "internal") {
    return (
      <TabEmptyState
        icon={<LockIcon className="h-5 w-5" />}
        title="Private HR data is internal-only"
        description="Customer accounts don't have private HR records. Switch the account type to Internal to manage this data."
      />
    );
  }

  const dirty = JSON.stringify(fields) !== JSON.stringify(initial);

  function set<K extends keyof PrivateFields>(key: K, value: PrivateFields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function blank(v: string) {
    return v.trim() === "" ? null : v.trim();
  }

  async function save() {
    setSaving(true);
    setError(null);
    const updated = await upsertEmployeeByAccountId(
      account.id,
      account.person_id,
      fields,
    );
    setSaving(false);
    if (!updated) {
      setError("Could not save private HR data.");
      return;
    }
    setToast("Private HR data saved.");
    onChanged?.(updated);
  }

  return (
    <div className="space-y-4">
      <section className={tabCardClass}>
        <h2 className={tabSectionTitle}>
          <LockIcon className="h-3.5 w-3.5" />
          Private & Confidential
        </h2>
        <p className="text-[12px] text-[var(--text-dim)]">
          HR data visible only to HR and admin roles. Stored on the Koleex
          Employees record — not the account — so customer users never see it.
        </p>
      </section>

      {/* Private Address */}
      <section className={tabCardClass}>
        <h3 className={tabSectionTitle}>
          <MapPinIcon className="h-3.5 w-3.5" />
          Private Address
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass}>Address Line 1</label>
            <input
              className={inputClass}
              value={fields.private_address_line1 ?? ""}
              onChange={(e) => set("private_address_line1", blank(e.target.value))}
              placeholder="Street and number"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Address Line 2</label>
            <input
              className={inputClass}
              value={fields.private_address_line2 ?? ""}
              onChange={(e) => set("private_address_line2", blank(e.target.value))}
              placeholder="Apartment, floor, etc."
            />
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input
              className={inputClass}
              value={fields.private_city ?? ""}
              onChange={(e) => set("private_city", blank(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass}>State / Region</label>
            <input
              className={inputClass}
              value={fields.private_state ?? ""}
              onChange={(e) => set("private_state", blank(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass}>Country</label>
            <input
              className={inputClass}
              value={fields.private_country ?? ""}
              onChange={(e) => set("private_country", blank(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass}>Postal Code</label>
            <input
              className={inputClass}
              value={fields.private_postal_code ?? ""}
              onChange={(e) => set("private_postal_code", blank(e.target.value))}
            />
          </div>
        </div>
      </section>

      {/* Emergency Contact */}
      <section className={tabCardClass}>
        <h3 className={tabSectionTitle}>
          <PhoneCallIcon className="h-3.5 w-3.5" />
          Emergency Contact
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Name</label>
            <input
              className={inputClass}
              value={fields.emergency_contact_name ?? ""}
              onChange={(e) => set("emergency_contact_name", blank(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input
              className={inputClass}
              value={fields.emergency_contact_phone ?? ""}
              onChange={(e) => set("emergency_contact_phone", blank(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass}>Relationship</label>
            <input
              className={inputClass}
              value={fields.emergency_contact_relationship ?? ""}
              onChange={(e) =>
                set("emergency_contact_relationship", blank(e.target.value))
              }
              placeholder="Spouse, parent, sibling…"
            />
          </div>
        </div>
      </section>

      {/* Personal */}
      <section className={tabCardClass}>
        <h3 className={tabSectionTitle}>
          <IdCardIcon className="h-3.5 w-3.5" />
          Personal
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Date of Birth</label>
            <input
              type="date"
              className={inputClass}
              value={fields.birth_date ?? ""}
              onChange={(e) => set("birth_date", blank(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass}>Marital Status</label>
            <input
              className={inputClass}
              value={fields.marital_status ?? ""}
              onChange={(e) => set("marital_status", blank(e.target.value))}
              placeholder="Single, married…"
            />
          </div>
          <div>
            <label className={labelClass}>Nationality</label>
            <input
              className={inputClass}
              value={fields.nationality ?? ""}
              onChange={(e) => set("nationality", blank(e.target.value))}
              placeholder="e.g. AE"
            />
          </div>
        </div>
      </section>

      {/* Documents */}
      <section className={tabCardClass}>
        <h3 className={tabSectionTitle}>
          <FileBadge2Icon className="h-3.5 w-3.5" />
          Documents
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>ID Number</label>
            <input
              className={inputClass}
              value={fields.identification_id ?? ""}
              onChange={(e) => set("identification_id", blank(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass}>Passport Number</label>
            <input
              className={inputClass}
              value={fields.passport_number ?? ""}
              onChange={(e) => set("passport_number", blank(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass}>Visa Number</label>
            <input
              className={inputClass}
              value={fields.visa_number ?? ""}
              onChange={(e) => set("visa_number", blank(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass}>Visa Expiry Date</label>
            <input
              type="date"
              className={inputClass}
              value={fields.visa_expiry_date ?? ""}
              onChange={(e) => set("visa_expiry_date", blank(e.target.value))}
            />
          </div>
        </div>
      </section>

      {toast && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300 px-4 py-3 text-[13px] flex items-start gap-2">
          <CheckCircleIcon className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{toast}</span>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.08] text-red-300 px-4 py-3 text-[13px] flex items-start gap-2">
          <ExclamationIcon className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className={tabCardClass}>
        <TabActionBar
          dirty={dirty}
          saving={saving}
          onSave={save}
          onReset={() => setFields(initial)}
        />
      </section>
    </div>
  );
}
